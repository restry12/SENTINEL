import type { FireData, WeatherData, FireAnalysis, RiskAssessment, ExpansionData, GeoJSONFeature, PerFireExpansion, RegionalContext } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

type PerFireExpansionFields = Pick<PerFireExpansion, 'expansion_2h_km2' | 'expansion_6h_km2' | 'expansion_12h_km2' | 'velocidad_kmh' | 'direccion'>

export function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function cardinalToDeg(dir: string): number {
  const map: Record<string, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  }
  return map[dir.toUpperCase()] ?? 0
}

export function centroid(fires: { lat: number; lon: number }[]): { lat: number; lon: number } {
  const lat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
  const lon = fires.reduce((s, f) => s + f.lon, 0) / fires.length
  return { lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) }
}

function toNasaData(fires: FireData[]) {
  const sorted = [...fires].sort((a, b) => b.frp - a.frp)
  const top50 = sorted.slice(0, 50)
  const center = centroid(fires)
  return {
    hotspots: top50.map(f => ({
      lat: f.lat,
      lon: f.lon,
      brightness: f.brightness,
      confidence: 85,
      frp: f.frp,
    })),
    total_hotspots: fires.length,
    acq_date: (() => {
      const d = new Date(fires[0]?.timestamp ?? '')
      return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
    })(),
    centroid: center,
    // LLM determines region name from actual coordinates
    region_hint: `centroide en lat ${center.lat}, lon ${center.lon}`,
  }
}

function toClimateData(weather: WeatherData) {
  return {
    wind_speed_kmh: Math.round(weather.speed * 3.6),
    wind_direction: degreesToCardinal(weather.deg),
    humidity_pct: weather.humidity,
    precipitation_mm: 0,
  }
}

// A_context: Regional fire behavior inference from coordinates
async function runAContext(fire: FireData): Promise<RegionalContext> {
  const system = `Eres un experto en comportamiento de incendios forestales en América Latina.
Recibes las coordenadas exactas de un foco de incendio y debes inferir el contexto regional de comportamiento del fuego.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "region_name": "nombre descriptivo de la región geográfica",
  "country": "país donde se localiza el foco",
  "vegetation_type": "tipo de vegetación predominante en la zona",
  "terrain_type": "tipo de terreno (montañoso, planicie, costal, etc.)",
  "spread_multiplier": número entre 0.5 y 2.0 que escala la tasa base de propagación relativa a un incendio típico,
  "max_ros_kmh": número máximo realista de tasa de propagación en km/h para esta región y vegetación,
  "reference_fires": ["array de 1-3 incendios reales históricos de la zona en formato 'Nombre Año: X ha en Y horas con vientos de Z km/h'"],
  "context_summary": "resumen breve del comportamiento típico del fuego en esta región para calibrar predicciones"
}
CRITERIOS DE CALIBRACIÓN:
- Estepa patagónica / pastizales secos: spread_multiplier 1.4-2.0, max_ros_kmh 15-20
- Bosque templado húmedo (Araucanía, Valdivia): spread_multiplier 0.6-0.8, max_ros_kmh 5-8
- Bosque mediterráneo / matorral (Chile central): spread_multiplier 1.0-1.3, max_ros_kmh 8-12
- Amazonia / selva tropical: spread_multiplier 0.4-0.6, max_ros_kmh 2-5
- Cerrado brasileño / sabana: spread_multiplier 1.2-1.6, max_ros_kmh 10-15
- Chaco: spread_multiplier 1.1-1.5, max_ros_kmh 8-14`

  const user = `Foco de incendio en lat ${fire.lat}, lon ${fire.lon} (FRP: ${fire.frp} MW).
Infiere el contexto regional y devuelve el JSON de calibración.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON<RegionalContext>(raw, 'A_context')
}

// A2 per-fire: expansion predictor calibrated with regional context
async function runA2PerFire(
  fire: FireData,
  weather: WeatherData,
  ctx: RegionalContext,
): Promise<PerFireExpansionFields> {
  const windKmh = Math.round(weather.speed * 3.6)
  const windDir = degreesToCardinal((weather.deg + 180) % 360)

  const system = `Eres un experto en modelado de propagación de incendios forestales en América Latina.
Recibes datos de un foco específico y un contexto regional que DEBES usar como restricción absoluta.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "expansion_2h_km2": número,
  "expansion_6h_km2": número,
  "expansion_12h_km2": número,
  "velocidad_kmh": número,
  "direccion": "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
}
RESTRICCIONES ABSOLUTAS (no negociables):
1. velocidad_kmh NUNCA puede superar max_ros_kmh del contexto regional
2. expansion_12h_km2 NUNCA puede superar 3 × (max_ros_kmh × 12)² × π / 4
3. Los valores deben ser coherentes con reference_fires del contexto regional
4. La progresión debe ser realista: expansion_2h_km2 < expansion_6h_km2 < expansion_12h_km2
5. Aplicar spread_multiplier del contexto regional sobre la tasa base calculada por el viento`

  const user = `FOCO: lat ${fire.lat}, lon ${fire.lon}, FRP ${fire.frp} MW
CLIMA: viento ${windKmh} km/h dirección ${windDir}, humedad ${weather.humidity}%
CONTEXTO REGIONAL:
${JSON.stringify(ctx, null, 2)}
Calcula la expansión del incendio respetando las restricciones absolutas del contexto regional.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON<PerFireExpansionFields>(raw, 'A2PerFire')
}

async function analyzePerFire(fire: FireData, weather: WeatherData): Promise<PerFireExpansion> {
  const ctx = await runAContext(fire)
  const exp = await runA2PerFire(fire, weather, ctx)
  return {
    lat: fire.lat,
    lon: fire.lon,
    frp: fire.frp,
    ...exp,
    regional_context: ctx,
  }
}

// A1: Risk Evaluator
async function runA1(
  nasaData: ReturnType<typeof toNasaData>,
  climateData: ReturnType<typeof toClimateData>
): Promise<RiskAssessment> {
  const system = `Eres un evaluador experto de riesgo de incendios forestales para Latinoamérica.
Recibes datos satelitales NASA FIRMS y datos climáticos.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "risk_level": "CRITICO" | "ALTO" | "MEDIO" | "BAJO",
  "zona_afectada": "nombre descriptivo de la zona geográfica",
  "confianza": número entre 0 y 1,
  "resumen": "descripción breve en español de la situación"
}`

  const user = `Datos NASA FIRMS:\n${JSON.stringify(nasaData, null, 2)}\n\nDatos climáticos:\n${JSON.stringify(climateData, null, 2)}\n\nEvalúa el riesgo de incendio y responde con el JSON estructurado.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON<RiskAssessment>(raw, 'Agent 1 (Risk)')
}

// A2: Expansion Predictor — uses A1 output + real coordinates
async function runA2(
  a1: RiskAssessment,
  climateData: ReturnType<typeof toClimateData>,
  center: { lat: number; lon: number }
): Promise<ExpansionData> {
  const system = `Eres un experto en modelado de propagación de incendios forestales.
Recibes una evaluación de riesgo, datos de viento y las coordenadas reales del centroide del incendio.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "expansion_2h": { "type": "Polygon", "coordinates": [[[lon, lat], ...]], "area_km2": número },
  "expansion_6h": { "type": "Polygon", "coordinates": [[[lon, lat], ...]], "area_km2": número },
  "expansion_12h": { "type": "Polygon", "coordinates": [[[lon, lat], ...]], "area_km2": número },
  "velocidad_propagacion_kmh": número,
  "direccion_principal": "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
}
IMPORTANTE: Los polígonos deben estar centrados en las coordenadas reales del incendio proporcionadas. Genera coordenadas GeoJSON realistas y geográficamente correctas.`

  const user = `Centroide real del incendio: lat ${center.lat}, lon ${center.lon}\n\nEvaluación de riesgo (Agent 1):\n${JSON.stringify(a1, null, 2)}\n\nDatos climáticos:\n${JSON.stringify(climateData, null, 2)}\n\nPredice la expansión a 2h, 6h y 12h con polígonos GeoJSON centrados en las coordenadas reales.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  const a2 = parseJSON<ExpansionData>(raw, 'Agent 2 (Expansion)')
  a2.direccion_principal_deg = cardinalToDeg(a2.direccion_principal)
  return a2
}

function expansionToGeoJSON(expansion: ExpansionData): GeoJSONFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: expansion.expansion_2h.coordinates,
    },
    properties: {
      expansion_2h_km2: expansion.expansion_2h.area_km2,
      expansion_6h_km2: expansion.expansion_6h.area_km2,
      expansion_12h_km2: expansion.expansion_12h.area_km2,
      velocidad_kmh: expansion.velocidad_propagacion_kmh,
      direccion: expansion.direccion_principal,
    },
  }
}

const EMPTY: FireAnalysis = {
  polygon: {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [] as number[][][] },
    properties: { degraded: true, reason: 'no fires or LLM unavailable' },
  },
  riskAssessment: { risk_level: 'BAJO', zona_afectada: 'Desconocida', confianza: 0, resumen: 'Sin datos' },
  expansion: {
    expansion_2h: { type: 'Polygon', coordinates: [], area_km2: 0 },
    expansion_6h: { type: 'Polygon', coordinates: [], area_km2: 0 },
    expansion_12h: { type: 'Polygon', coordinates: [], area_km2: 0 },
    velocidad_propagacion_kmh: 0,
    direccion_principal: 'N',
    direccion_principal_deg: 0,
  },
  perFireExpansions: [],
}

export async function analyzeFireExpansion(fires: FireData[], weather: WeatherData): Promise<FireAnalysis> {
  if (fires.length === 0) return EMPTY

  const nasaData = toNasaData(fires)
  const climateData = toClimateData(weather)
  const center = centroid(fires)

  // Top 50 fires by FRP — per-fire agents in parallel
  const top50 = [...fires].sort((a, b) => b.frp - a.frp).slice(0, 50)
  const [a1Result, perFireResults] = await Promise.all([
    runA1(nasaData, climateData),
    Promise.allSettled(top50.map(f => analyzePerFire(f, weather))),
  ])

  const perFireExpansions = perFireResults
    .filter((r): r is PromiseFulfilledResult<PerFireExpansion> => r.status === 'fulfilled')
    .map(r => r.value)

  try {
    const a2 = await runA2(a1Result, climateData, center)
    return {
      polygon: expansionToGeoJSON(a2),
      riskAssessment: a1Result,
      expansion: a2,
      perFireExpansions,
    }
  } catch {
    return {
      ...EMPTY,
      riskAssessment: a1Result,
      perFireExpansions,
    }
  }
}
