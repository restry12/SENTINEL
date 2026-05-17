import { createClient } from '@supabase/supabase-js'
import type { WeatherData, PredictionCell, PredictionResult } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

const LAT_MIN = -45
const LAT_MAX = -30
const LON_MIN = -76
const LON_MAX = -66
const CELL_DEG = 0.25

export function toTempCelsius(temp: number | undefined): number {
  if (temp === undefined) return 20
  return temp > 100 ? temp - 273.15 : temp
}

export function buildFwiGrid(weather: WeatherData): PredictionCell[] {
  const tempC = toTempCelsius(weather.temp)
  const drought = (100 - weather.humidity) / 100
  const wind = Math.min(weather.speed / 20, 1)
  const temp = Math.max(0, (tempC - 15) / 25)
  const fwi_score = Math.min(drought * 0.5 + wind * 0.3 + temp * 0.2, 1)

  const cells: PredictionCell[] = []
  for (let lat = LAT_MIN; lat < LAT_MAX; lat += CELL_DEG) {
    for (let lon = LON_MIN; lon < LON_MAX; lon += CELL_DEG) {
      cells.push({
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        fwi_score,
        historical_weight: 0,
        risk_score: 0,
      })
    }
  }
  return cells
}

export function combineScores(cells: PredictionCell[]): PredictionCell[] {
  return cells
    .map(c => ({
      ...c,
      risk_score: Math.min(c.fwi_score * 0.6 + c.historical_weight * 0.4, 1),
    }))
    // Only show cells with real spatial variation: historical hotspot OR extreme FWI.
    // Without this, the grid renders as a uniform color across the entire region.
    .filter(c => c.historical_weight > 0 || c.fwi_score > 0.75)
}

function snapToGrid(v: number): number {
  return Math.round(Math.floor(v / CELL_DEG) * CELL_DEG * 100) / 100
}

async function fetchHistoricalWeights(): Promise<Map<string, number>> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return new Map()

  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('fire_hotspot_history')
      .select('lat, lon')
      .gte('timestamp', since)

    if (error || !data) return new Map()

    const counts = new Map<string, number>()
    for (const row of data) {
      const k = `${snapToGrid(row.lat as number)},${snapToGrid(row.lon as number)}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return counts
  } catch {
    return new Map()
  }
}

async function fetchConfidence(): Promise<'baja' | 'media' | 'alta'> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return 'baja'

  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('fire_hotspot_history')
      .select('timestamp')
      .gte('timestamp', since)
      .limit(1000)

    if (error || !data || data.length === 0) return 'baja'

    const days = new Set(data.map(r => (r.timestamp as string).slice(0, 10)))
    if (days.size >= 7) return 'alta'
    if (days.size >= 1) return 'media'
    return 'baja'
  } catch {
    return 'baja'
  }
}

function applyHistory(cells: PredictionCell[], counts: Map<string, number>): PredictionCell[] {
  if (counts.size === 0) return cells
  const maxCount = Math.max(...counts.values())
  return cells.map(c => {
    const k = `${c.lat},${c.lon}`
    const count = counts.get(k) ?? 0
    return { ...c, historical_weight: count / maxCount }
  })
}

async function runLLM(
  topCells: PredictionCell[],
  weather: WeatherData,
): Promise<Pick<PredictionResult, 'top_zones' | 'analisis_6h' | 'analisis_24h' | 'analisis_72h'>> {
  const system = `Eres un experto en predicción de incendios forestales en la región de Patagonia y Araucanía (Chile-Argentina).
Recibes datos de riesgo de ignición calculados con el Índice de Peligro de Incendio (FWI) y patrones históricos.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "top_zones": [
    {
      "lat": número,
      "lon": número,
      "risk_score": número,
      "zona": "nombre descriptivo de la zona geográfica",
      "razon": "explicación breve de por qué está en riesgo"
    }
  ],
  "analisis_6h": "análisis de riesgo para las próximas 6 horas",
  "analisis_24h": "análisis de riesgo para las próximas 24 horas",
  "analisis_72h": "análisis de riesgo para las próximas 72 horas"
}`

  const snapshot = {
    zonas_mayor_riesgo: topCells.slice(0, 15).map(c => ({
      lat: c.lat,
      lon: c.lon,
      risk_score: c.risk_score.toFixed(2),
      fwi: c.fwi_score.toFixed(2),
      historial: c.historical_weight.toFixed(2),
    })),
    clima_actual: {
      viento_ms: weather.speed,
      humedad_pct: weather.humidity,
      temp_c: toTempCelsius(weather.temp),
    },
  }

  const user = `Zonas de mayor riesgo de ignición (calculadas):\n${JSON.stringify(snapshot, null, 2)}\n\nGenera el análisis de predicción.`
  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON(raw, 'Agent 6 (Prediction)')
}

export async function predictIgnitionRisk(weather: WeatherData): Promise<PredictionResult> {
  let cells = buildFwiGrid(weather)

  const [counts, confianza] = await Promise.all([
    fetchHistoricalWeights(),
    fetchConfidence(),
  ])
  cells = applyHistory(cells, counts)
  const grid = combineScores(cells)

  if (grid.length === 0) {
    return { grid: [], top_zones: [], analisis_6h: '', analisis_24h: '', analisis_72h: '', confianza }
  }

  const topCells = [...grid].sort((a, b) => b.risk_score - a.risk_score).slice(0, 15)

  try {
    const llm = await runLLM(topCells, weather)
    return { grid, ...llm, confianza }
  } catch {
    return { grid, top_zones: [], analisis_6h: '', analisis_24h: '', analisis_72h: '', confianza }
  }
}
