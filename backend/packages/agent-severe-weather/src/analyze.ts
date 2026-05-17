import type { SevereWeatherResponse, SevereWeatherForecastRisk } from '@sentinel/types'
import { fetchOpenMeteoForecast, extractVariablesAtIndex, findTimeIndices } from './open-meteo'
import type { OpenMeteoHourlyData } from './open-meteo'
import { fetchNoaaActiveAlerts } from './noaa-alerts'
import { calculateSevereStormPotential, calcPressureDrop3h } from './calculate-sspi'
import { estimateImpactCorridor } from './impact-corridor'
import { analyzeWithMistral, MISTRAL_FALLBACK } from './openrouter'
import type { MistralAnalysisInput } from './openrouter'
import { buildDemoResponse } from './demo'

const LIMITATIONS = [
  'This is not an exact tornado prediction.',
  'The index estimates favorable conditions for severe storms using available forecast variables.',
  'Official NWS alerts are mainly available for the United States and territories.',
]

type WindowLabel = 'Now' | '+1h' | '+3h' | '+6h'

function buildForecastRisk(
  hourly: OpenMeteoHourlyData,
  indices: { now: number; plus1h: number; plus3h: number; plus6h: number }
): SevereWeatherForecastRisk[] {
  const windows: Array<{ label: WindowLabel; idx: number }> = [
    { label: 'Now', idx: indices.now },
    { label: '+1h', idx: indices.plus1h },
    { label: '+3h', idx: indices.plus3h },
    { label: '+6h', idx: indices.plus6h },
  ]

  return windows.map(({ label, idx }) => {
    const vars = extractVariablesAtIndex(hourly, idx)
    const pressureDrop = calcPressureDrop3h(hourly.surface_pressure, idx)
    const sspi = calculateSevereStormPotential(vars, pressureDrop)
    const corridor = estimateImpactCorridor(vars, sspi.score)
    const timestamp = hourly.time[idx] ?? new Date().toISOString()

    return {
      window: label,
      timestamp,
      score: sspi.score,
      risk_level: sspi.risk_level,
      variables: vars,
      drivers: sspi.drivers,
      confidence: sspi.confidence,
      impact_corridor: corridor,
    }
  })
}

/**
 * Main analysis function — orchestrates all data fetching, calculation, and AI analysis.
 */
export async function buildSevereWeatherResponse(
  lat: number,
  lon: number,
  mode: 'live' | 'demo' = 'live'
): Promise<SevereWeatherResponse> {
  // Demo mode: return simulated high-risk scenario
  if (mode === 'demo') {
    return buildDemoResponse(lat, lon)
  }

  // Live mode: fetch real data
  const [meteoResult, noaaResult] = await Promise.allSettled([
    fetchOpenMeteoForecast(lat, lon),
    fetchNoaaActiveAlerts(lat, lon),
  ])

  // Handle Open-Meteo failure (critical — can't compute index)
  if (meteoResult.status === 'rejected') {
    throw new Error(`Open-Meteo fetch failed: ${meteoResult.reason}`)
  }

  const meteo = meteoResult.value
  const noaa = noaaResult.status === 'fulfilled' ? noaaResult.value : { alerts: [], note: 'NOAA fetch failed' }

  // Build forecast risk for all time windows
  const indices = findTimeIndices(meteo.hourly.time)
  const forecastRisk = buildForecastRisk(meteo.hourly, indices)

  // Add NOAA note to limitations if applicable
  const limitations = [...LIMITATIONS]
  if (noaa.note) limitations.push(noaa.note)

  // Build base response (works even without Mistral)
  const response: SevereWeatherResponse = {
    location: { lat, lon },
    sources: {
      forecast: 'Open-Meteo',
      active_alerts: 'NOAA/NWS Alerts API',
    },
    limitations,
    active_alerts: noaa.alerts,
    forecast_risk: forecastRisk,
    mistral_analysis: MISTRAL_FALLBACK,
  }

  // Attempt Mistral analysis (non-blocking — fallback already set)
  try {
    const mistralInput: MistralAnalysisInput = {
      location: { lat, lon },
      active_alerts: noaa.alerts.map(a => ({
        event: a.event,
        severity: a.severity,
        headline: a.headline,
      })),
      forecast_risk: forecastRisk.map(r => ({
        window: r.window,
        score: r.score,
        risk_level: r.risk_level,
        drivers: r.drivers,
        confidence: r.confidence,
      })),
      impact_corridor: forecastRisk[0]?.impact_corridor ?? {
        direction_label: 'Unknown',
        bearing_degrees: 0,
        estimated_distance_km_1h: 0,
        estimated_distance_km_3h: 0,
        estimated_distance_km_6h: 0,
      },
      limitations,
    }

    response.mistral_analysis = await analyzeWithMistral(mistralInput)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[agent-severe-weather] Mistral analysis failed: ${msg}`)
    // Fallback already set — endpoint continues
  }

  return response
}
