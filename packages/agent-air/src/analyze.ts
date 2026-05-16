import type { AirData, FireData } from '@sentinel/types'

export interface AirAnalysis {
  safe: boolean
  recommendation: string
  fireContribution: boolean
}

export function analyzeAir(air: AirData, fires: FireData[]): AirAnalysis {
  const safe = air.aqi <= 100
  const fireContribution = fires.length > 0 && air.pm25 > 35

  let recommendation: string
  if (air.aqi <= 50) {
    recommendation = 'Air quality is good. No restrictions needed.'
  } else if (air.aqi <= 100) {
    recommendation = 'Moderate air quality. Sensitive groups should limit outdoor activity.'
  } else if (air.aqi <= 150) {
    recommendation = 'Unhealthy for sensitive groups. Masks recommended for outdoor activity.'
  } else if (air.aqi <= 200) {
    recommendation = 'Unhealthy. Everyone should limit outdoor exposure. Use N95 masks.'
  } else {
    recommendation = 'Very unhealthy or hazardous. Avoid all outdoor activity. Evacuate if possible.'
  }

  return { safe, recommendation, fireContribution }
}
