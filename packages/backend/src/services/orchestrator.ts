import type {
  SentinelUpdate,
  AgentRequest,
  AgentResponse,
  FireData,
  WeatherData,
  AirData,
  GeoJSONFeature,
  RouteData,
} from '@sentinel/types'
import { fetchWeather } from './openweather'
import { fetchFires } from './firms'
import { fetchAirQuality } from './openaq'

// Note: agent-weather returns WeatherAnalysis and agent-air returns AirAnalysis.
// These are agent-internal types — their analysis is logged but SentinelUpdate
// carries the raw WeatherData and AirData from the external APIs directly.

const DEFAULT_LAT = -38.5
const DEFAULT_LON = -72.0
const DEFAULT_AREA = {
  latSouth: -45,
  lonWest: -76,
  latNorth: -30,
  lonEast: -66,
}

const EMPTY_POLYGON: GeoJSONFeature = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [] as number[][][] },
  properties: { degraded: true, reason: 'agent-fire unavailable' },
}

const EMPTY_WEATHER: WeatherData = { speed: 0, deg: 0, humidity: 0 }
const EMPTY_AIR: AirData = { pm25: 0, aqi: 0, category: 'Unknown' }

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function callAgent<T>(url: string, body: AgentRequest): Promise<AgentResponse<T>> {
  const res = await fetch(`${url}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Agent at ${url} returned ${res.status}`)
  return res.json() as Promise<AgentResponse<T>>
}

function calculateRiskLevel(fires: FireData[], weather: WeatherData, air: AirData): SentinelUpdate['riskLevel'] {
  // highFrp: fires with Fire Radiative Power > 100 MW (severe intensity threshold)
  const highFrp = fires.filter(f => f.frp > 100).length
  const strongWind = weather.speed > 10   // m/s — accelerates spread significantly
  const badAir = air.aqi > 150            // Unhealthy range per US EPA

  if (highFrp > 5 || (highFrp > 2 && strongWind)) return 'critical'
  if (highFrp > 2 || (highFrp > 0 && strongWind) || badAir) return 'high'
  if (highFrp > 0 || air.aqi > 100) return 'medium'
  return 'low'
}

export async function runAnalysis(
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON
): Promise<SentinelUpdate> {
  // Step 1: fetch external APIs — fault-isolated so one failure doesn't block the rest
  const [firesSettled, weatherSettled, airSettled] = await Promise.allSettled([
    fetchFires(DEFAULT_AREA.latSouth, DEFAULT_AREA.lonWest, DEFAULT_AREA.latNorth, DEFAULT_AREA.lonEast),
    fetchWeather(lat, lon),
    fetchAirQuality(lat, lon),
  ])

  if (firesSettled.status === 'rejected') console.warn('[orchestrator] fetchFires failed:', firesSettled.reason)
  if (weatherSettled.status === 'rejected') console.warn('[orchestrator] fetchWeather failed:', weatherSettled.reason)
  if (airSettled.status === 'rejected') console.warn('[orchestrator] fetchAirQuality failed:', airSettled.reason)

  const fires = firesSettled.status === 'fulfilled' ? firesSettled.value : []
  const weather = weatherSettled.status === 'fulfilled' ? weatherSettled.value : EMPTY_WEATHER
  const airQuality = airSettled.status === 'fulfilled' ? airSettled.value : EMPTY_AIR

  // Step 2: call agents in parallel — fault-isolated via Promise.allSettled
  const fireUrl = requireEnv('AGENT_FIRE_URL')
  const weatherUrl = requireEnv('AGENT_WEATHER_URL')
  const airUrl = requireEnv('AGENT_AIR_URL')
  const routesUrl = requireEnv('AGENT_ROUTES_URL')

  const [fireSettled, weatherAgentSettled, airAgentSettled, routesSettled] = await Promise.allSettled([
    callAgent<GeoJSONFeature>(fireUrl, { firms: fires, weather }),
    callAgent<unknown>(weatherUrl, { weather, firms: fires }),
    callAgent<unknown>(airUrl, { openaq: airQuality, firms: fires }),
    callAgent<RouteData[]>(routesUrl, { firms: fires }),
  ])

  if (fireSettled.status === 'rejected') console.warn('[orchestrator] agent-fire failed:', fireSettled.reason)
  if (weatherAgentSettled.status === 'rejected') console.warn('[orchestrator] agent-weather failed:', weatherAgentSettled.reason)
  if (airAgentSettled.status === 'rejected') console.warn('[orchestrator] agent-air failed:', airAgentSettled.reason)
  if (routesSettled.status === 'rejected') console.warn('[orchestrator] agent-routes failed:', routesSettled.reason)

  // Step 3: consolidate — discriminated union narrowing eliminates unsafe casts
  const polygon =
    fireSettled.status === 'fulfilled' && fireSettled.value.success
      ? fireSettled.value.data
      : EMPTY_POLYGON

  const routes =
    routesSettled.status === 'fulfilled' && routesSettled.value.success
      ? routesSettled.value.data
      : []

  const riskLevel = calculateRiskLevel(fires, weather, airQuality)

  return {
    timestamp: new Date().toISOString(),
    fires,
    polygon,
    weather,
    airQuality,
    routes,
    riskLevel,
  }
}
