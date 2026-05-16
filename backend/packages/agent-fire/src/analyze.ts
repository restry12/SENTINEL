import type { FireData, WeatherData, FireAnalysis, RiskAssessment, ExpansionData, GeoJSONFeature } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function toNasaData(fires: FireData[]) {
  return {
    hotspots: fires.slice(0, 50).map(f => ({
      lat: f.lat,
      lon: f.lon,
      brightness: f.brightness,
      confidence: 85,
      frp: f.frp,
    })),
    acq_date: new Date().toISOString().split('T')[0],
    region: 'Patagonia / Araucanía, Chile-Argentina',
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

// A2: Expansion Predictor — uses A1 output
async function runA2(
  a1: RiskAssessment,
  climateData: ReturnType<typeof toClimateData>
): Promise<ExpansionData> {
  const system = `Eres un experto en modelado de propagación de incendios forestales.
Recibes una evaluación de riesgo y datos de viento.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "expansion_2h": { "type": "Polygon", "coordinates": [[[lon, lat], ...]], "area_km2": número },
  "expansion_6h": { "type": "Polygon", "coordinates": [[[lon, lat], ...]], "area_km2": número },
  "expansion_12h": { "type": "Polygon", "coordinates": [[[lon, lat], ...]], "area_km2": número },
  "velocidad_propagacion_kmh": número,
  "direccion_principal": "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
}
Genera polígonos realistas basados en la dirección e intensidad del viento.`

  const user = `Evaluación de riesgo (Agent 1):\n${JSON.stringify(a1, null, 2)}\n\nDatos climáticos:\n${JSON.stringify(climateData, null, 2)}\n\nPredice la expansión del incendio a 2h, 6h y 12h con polígonos GeoJSON.`

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

  // A1 first, then A2 uses A1 output (sequential by design)
  const a1 = await runA1(nasaData, climateData)
  const a2 = await runA2(a1, climateData)

  return {
    polygon: expansionToGeoJSON(a2),
    riskAssessment: a1,
    expansion: a2,
  }
}
