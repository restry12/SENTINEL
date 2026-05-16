import type { FireData, WeatherData, FireAnalysis, RiskAssessment, ExpansionData, GeoJSONFeature } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function centroid(fires: FireData[]): { lat: number; lon: number } {
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
    acq_date: fires[0]?.timestamp?.split('T')[0] ?? new Date().toISOString().split('T')[0],
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
  return parseJSON<ExpansionData>(raw, 'Agent 2 (Expansion)')
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
  },
}

export async function analyzeFireExpansion(fires: FireData[], weather: WeatherData): Promise<FireAnalysis> {
  if (fires.length === 0) return EMPTY

  const nasaData = toNasaData(fires)
  const climateData = toClimateData(weather)
  const center = centroid(fires)

  // A1 first, then A2 uses A1 output + real coordinates (sequential by design)
  const a1 = await runA1(nasaData, climateData)
  const a2 = await runA2(a1, climateData, center)

  return {
    polygon: expansionToGeoJSON(a2),
    riskAssessment: a1,
    expansion: a2,
  }
}
