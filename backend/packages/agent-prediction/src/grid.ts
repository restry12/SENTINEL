import type { WeatherData, RiskCategory, RiskFactors } from '@sentinel/types'

export function toTempCelsius(temp: number | undefined): number {
  if (temp === undefined) return 20
  return temp > 100 ? temp - 273.15 : temp
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1)
}

// Fire Weather Index proxy, 0-1, from a single weather point.
export function computeFwi(weather: WeatherData): number {
  const tempC = toTempCelsius(weather.temp)
  const drought = clamp01((100 - weather.humidity) / 100)
  const wind = clamp01(weather.speed / 20)
  const temp = clamp01((tempC - 15) / 25)
  return clamp01(drought * 0.5 + wind * 0.3 + temp * 0.2)
}

// Weighted blend of the three 0-100 factors → 0-100 score.
export function combineScore(f: RiskFactors): number {
  return Math.round(0.40 * f.fwi + 0.35 * f.historial + 0.25 * f.terreno)
}

export function categoryFor(score: number): RiskCategory {
  if (score >= 80) return 'critico'
  if (score >= 60) return 'alto'
  if (score >= 40) return 'medio'
  return 'bajo'
}

import { CELL_DEG } from './zones'

export interface Hotspot {
  lat: number
  lon: number
}

// Proximity kernel: each hotspot adds weight 1.0 to its own cell and a
// linear falloff to cells within a 2-cell radius. Result keyed "row,col"
// (integer grid indices), normalized so the hottest cell is 100.
export function computeHistorial(hotspots: Hotspot[]): Map<string, number> {
  const raw = new Map<string, number>()
  for (const h of hotspots) {
    const hRow = Math.floor(h.lat / CELL_DEG)
    const hCol = Math.floor(h.lon / CELL_DEG)
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const dist = Math.sqrt(dr * dr + dc * dc)
        const w = Math.max(0, 1 - dist / 3)
        if (w <= 0) continue
        const k = `${hRow + dr},${hCol + dc}`
        raw.set(k, (raw.get(k) ?? 0) + w)
      }
    }
  }
  const result = new Map<string, number>()
  if (raw.size === 0) return result
  const max = Math.max(...raw.values())
  for (const [k, v] of raw) {
    result.set(k, Math.round((v / max) * 100))
  }
  return result
}

import { createClient } from '@supabase/supabase-js'
import type { FireData, FireRiskCell, FireRiskGrid } from '@sentinel/types'
import { iterateCells, cellId } from './zones'

const HISTORY_DAYS = 30

async function fetchHistoryHotspots(): Promise<Hotspot[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return []
  try {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('fire_hotspot_history')
      .select('lat, lon')
      .gte('timestamp', since)
    if (error || !data) return []
    return data.map(r => ({ lat: r.lat as number, lon: r.lon as number }))
  } catch {
    return []
  }
}

function average(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

export async function buildFireRiskGrid(
  weather: WeatherData,
  firms: FireData[],
): Promise<FireRiskGrid> {
  const fwi = Math.round(computeFwi(weather) * 100)

  const history = await fetchHistoryHotspots()
  const live: Hotspot[] = firms.map(f => ({ lat: f.lat, lon: f.lon }))
  const historial = computeHistorial([...history, ...live])

  const cells: FireRiskCell[] = iterateCells().map(rc => {
    // A cell's SW corner is an exact 0.25 multiple, so round() here matches the
    // floor() that computeHistorial uses to bucket hotspots.
    const row = Math.round(rc.lat / CELL_DEG)
    const col = Math.round(rc.lon / CELL_DEG)
    const factors: RiskFactors = {
      fwi,
      historial: historial.get(`${row},${col}`) ?? 0,
      terreno: Math.round(rc.zone.terrain * 100),
    }
    const score = combineScore(factors)
    return {
      id: cellId(rc.lat, rc.lon),
      lat: rc.lat,
      lon: rc.lon,
      size: CELL_DEG,
      score,
      category: categoryFor(score),
      factors,
      zona: rc.zone.name,
    }
  })

  const weatherPoint = firms.length > 0
    ? { lat: average(firms.map(f => f.lat)), lon: average(firms.map(f => f.lon)) }
    : { lat: -38.5, lon: -72.0 }

  return {
    cells,
    generated_at: new Date().toISOString(),
    weather_point: weatherPoint,
    bbox: { latMin: -56, latMax: -17.5, lonMin: -76, lonMax: -66 },
  }
}
