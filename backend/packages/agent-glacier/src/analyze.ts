import type { GlacierMassData } from '@sentinel/types'

export function thermalBaseline(altitudeM: number): number {
  if (altitudeM > 4000) return -8
  if (altitudeM > 2000) return -3
  return 2
}

export function estimateDaysAboveZero(
  lat: number,
  altitudeM: number,
  currentTempC: number,
  monthOfYear: number
): number {
  // Southern hemisphere: summer is Dec–Feb, invert season lookup
  const isSouthern = lat < 0
  const effectiveMonth = isSouthern ? ((monthOfYear + 5) % 12) + 1 : monthOfYear
  const seasonalFactor =
    effectiveMonth >= 6 && effectiveMonth <= 8 ? 1.3
    : effectiveMonth <= 2 || effectiveMonth >= 12 ? 0.7
    : 1.0

  const baseDays = altitudeM > 4000 ? 10 : altitudeM > 2000 ? 30 : 60

  const baseline = thermalBaseline(altitudeM)
  const tempAdjust = Math.max(-10, Math.min(10, (currentTempC - baseline) * 2))

  return Math.max(0, Math.min(365, Math.round(baseDays * seasonalFactor + tempAdjust)))
}

export function buildPrediction(
  history: GlacierMassData[],
  riskScore: number
): { trend: string; estimated_years_to_critical: number | null } {
  if (history.length === 0) return { trend: 'Sin datos', estimated_years_to_critical: null }

  if (riskScore > 75) {
    const last = history[history.length - 1].mass_change_mmwe
    return { trend: `${last} mm w.e./año (crítico)`, estimated_years_to_critical: null }
  }

  const last = history[history.length - 1].mass_change_mmwe
  const avg = history.reduce((s, h) => s + h.mass_change_mmwe, 0) / history.length
  const accelerating = last < avg
  const trend = `${last} mm w.e./año (${accelerating ? 'acelerando' : 'estable'})`

  const pointsToGo = Math.max(0, 76 - riskScore)
  const annualRate = accelerating ? Math.abs(last - avg) : 0
  const years =
    annualRate > 0
      ? Math.round(pointsToGo / (annualRate / 100))
      : Math.round(pointsToGo * 2)

  return { trend, estimated_years_to_critical: years > 50 ? null : years }
}
