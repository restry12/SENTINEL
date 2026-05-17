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
