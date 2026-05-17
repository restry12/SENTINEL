import type { SevereWeatherAlert } from '@sentinel/types'

const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active'

const RELEVANT_EVENTS = new Set([
  'Tornado Warning',
  'Tornado Watch',
  'Severe Thunderstorm Warning',
  'Severe Thunderstorm Watch',
  'Extreme Wind Warning',
])

/**
 * Returns true if the coordinates are roughly within the US + territories
 * bounding box. This is a coarse check — NOAA may still return empty for
 * valid US coords near borders, and that's fine.
 */
function isLikelyUS(lat: number, lon: number): boolean {
  // Continental US + Alaska + Hawaii + territories (generous bounds)
  if (lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -66.5) return true  // CONUS
  if (lat >= 51 && lat <= 71.5 && lon >= -180 && lon <= -129) return true      // Alaska
  if (lat >= 18.5 && lat <= 22.5 && lon >= -160.5 && lon <= -154.5) return true // Hawaii
  if (lat >= 17.5 && lat <= 18.6 && lon >= -67.5 && lon <= -65.5) return true  // Puerto Rico
  if (lat >= 17 && lat <= 18.5 && lon >= -65.5 && lon <= -64.5) return true    // USVI
  if (lat >= 13 && lat <= 15 && lon >= 144 && lon <= 146) return true          // Guam
  return false
}

interface NWSAlertFeature {
  properties: {
    event: string
    severity: string
    urgency: string
    headline: string | null
    areaDesc: string
    effective: string
    expires: string
  }
  geometry: Record<string, unknown> | null
}

interface NWSAlertsResponse {
  features: NWSAlertFeature[]
}

export interface NoaaAlertResult {
  alerts: SevereWeatherAlert[]
  note: string | null
}

export async function fetchNoaaActiveAlerts(lat: number, lon: number): Promise<NoaaAlertResult> {
  if (!isLikelyUS(lat, lon)) {
    return {
      alerts: [],
      note: 'Official NWS active alerts are only available for the United States and territories.',
    }
  }

  const url = `${NWS_ALERTS_URL}?point=${lat.toFixed(4)},${lon.toFixed(4)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SENTINEL-severe-weather-agent/1.0 (contact: sentinel@example.com)',
        Accept: 'application/geo+json',
      },
    })

    if (!res.ok) {
      console.warn(`[agent-severe-weather] NOAA returned ${res.status} for point ${lat},${lon}`)
      return { alerts: [], note: `NOAA API returned status ${res.status}. Alerts unavailable.` }
    }

    const data = await res.json() as NWSAlertsResponse
    const features = data.features ?? []

    const relevant = features
      .filter(f => RELEVANT_EVENTS.has(f.properties.event))
      .map((f): SevereWeatherAlert => ({
        event: f.properties.event,
        severity: f.properties.severity,
        urgency: f.properties.urgency,
        headline: f.properties.headline ?? '',
        area_description: f.properties.areaDesc,
        effective: f.properties.effective,
        expires: f.properties.expires,
        geometry: f.geometry,
      }))

    return { alerts: relevant, note: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[agent-severe-weather] NOAA fetch failed: ${msg}`)
    return { alerts: [], note: `NOAA alerts fetch failed: ${msg}` }
  } finally {
    clearTimeout(timeout)
  }
}
