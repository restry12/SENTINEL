import type { RiskCat, ScoreInputs } from '@/lib/glacier-types'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function normalize(v: number, min: number, max: number): number {
  return clamp((v - min) / (max - min), 0, 1) * 100
}

export function calcRiesgo(inputs: ScoreInputs): number {
  const { areaNow, areaRef, tempAnomaly, elevation, cuencaFactor } = inputs

  // Factor 1: retroceso de área (30%)
  const retrocesoPct = areaRef > 0 ? Math.max(0, (areaRef - areaNow) / areaRef * 100) : 0
  const retrocesoScore = clamp(retrocesoPct * 1.2, 0, 100)

  // Factor 2: anomalía de temperatura (25%)
  const tempScore = normalize(tempAnomaly, 0, 3)

  // Factor 3: elevación (15%) — glaciares más bajos son más vulnerables
  // elevation 0m → elevScore 100 (most vulnerable), 5500m → elevScore 0
  const elevScore = normalize(5500 - Math.max(0, elevation), 0, 5500)

  // Factor 4: tamaño (20%) — glaciares pequeños retroceden más rápido
  const areaScore = areaNow < 1
    ? 90
    : areaNow < 10
      ? 70
      : areaNow < 100
        ? 50
        : areaNow < 500
          ? 30
          : 15

  // Factor 5: importancia hídrica (10%)
  const cuencaScore = clamp(cuencaFactor, 0, 100)

  const raw = (
    retrocesoScore * 0.30 +
    tempScore      * 0.25 +
    elevScore      * 0.15 +
    areaScore      * 0.20 +
    cuencaScore    * 0.10
  )

  return Math.round(clamp(raw, 0, 100))
}

export function getCat(riesgo: number): RiskCat {
  if (riesgo >= 76) return 'Crítico'
  if (riesgo >= 51) return 'Riesgo Alto'
  if (riesgo >= 26) return 'Observación'
  return 'Estable'
}

export function getTrend(massHistory: number[]): 'Retroceso acelerado' | 'Retroceso lento' | 'Estable' {
  if (massHistory.length < 4) return 'Estable'
  const last = massHistory.slice(-4)
  const slope = (last[3] - last[0]) / 3
  if (slope < -0.05) return 'Retroceso acelerado'
  if (slope < -0.01) return 'Retroceso lento'
  return 'Estable'
}

export function getMasaVar(massHistory: number[]): string {
  if (massHistory.length === 0) return '−0.00 m EH/año'
  const last = massHistory.at(-1) ?? 0
  const formatted = last.toFixed(2)
  const display = formatted.startsWith('-') ? '−' + formatted.slice(1) : formatted
  return `${display} m EH/año`
}

// Derivar riskHistory (12 puntos) a partir de los arrays históricos
export function buildRiskHistory(
  areaHistory: number[],   // % relativo, 12 puntos
  tempHistory: number[],   // anomalía °C, 12 puntos
  baseRiesgo: number,
): number[] {
  return areaHistory.map((areaPct, i) => {
    const areaFactor = (100 - areaPct) * 0.6
    const tempFactor = (tempHistory[i] ?? 0) * 8
    const estimated = clamp(Math.round(baseRiesgo - (areaFactor + tempFactor) * 0.3 + i * 0.5), 20, 99)
    return estimated
  })
}
