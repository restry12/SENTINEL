import { createClient } from '@supabase/supabase-js'
import type {
  WeatherData,
  RiskCategory,
  RiskFactors,
  FireData,
  FireRiskRegion,
  FireRiskRegionMap,
} from '@sentinel/types'
import { CHILE_REGIONS, TERRAIN_BY_REGION, pointInRegion } from './regions'

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

export interface Hotspot {
  lat: number
  lon: number
}

const HISTORY_DAYS = 30

// 30-day fire history from Supabase. Degrades to [] without env / on error.
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

// Builds a 16-region risk map: each of Chile's administrative regions gets an
// aggregate 0-100 score from weather (FWI), real fire history and terrain.
export async function buildFireRiskRegionMap(
  weather: WeatherData,
  firms: FireData[],
): Promise<FireRiskRegionMap> {
  const fwi = Math.round(computeFwi(weather) * 100)

  const history = await fetchHistoryHotspots()
  const live: Hotspot[] = firms.map(f => ({ lat: f.lat, lon: f.lon }))
  const hotspots: Hotspot[] = [...history, ...live]

  // Count hotspots per region, then normalize so the busiest region = 100.
  const counts = CHILE_REGIONS.map(region => {
    let count = 0
    for (const h of hotspots) {
      if (pointInRegion(h.lon, h.lat, region.geometry)) count++
    }
    return count
  })
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0

  const regions: FireRiskRegion[] = CHILE_REGIONS.map((region, i) => {
    const historial = maxCount > 0 ? Math.round((counts[i] / maxCount) * 100) : 0
    const terreno = Math.round((TERRAIN_BY_REGION[region.id] ?? 0) * 100)
    const factors: RiskFactors = { fwi, historial, terreno }
    const score = combineScore(factors)
    return {
      id: region.id,
      nombre: region.nombre,
      score,
      category: categoryFor(score),
      factors,
      geometry: region.geometry,
    }
  })

  const weatherPoint = firms.length > 0
    ? { lat: average(firms.map(f => f.lat)), lon: average(firms.map(f => f.lon)) }
    : { lat: -38.5, lon: -72.0 }

  return {
    regions,
    generated_at: new Date().toISOString(),
    weather_point: weatherPoint,
  }
}
