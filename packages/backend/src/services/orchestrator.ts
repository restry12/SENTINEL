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

// Default zone: central Chile (wildfire-prone area)
const DEFAULT_LAT = -38.5
const DEFAULT_LON = -72.0
const DEFAULT_AREA = {
  latSouth: -45,
  lonWest: -76,
  latNorth: -30,
  lonEast: -66,
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
  const highFrp = fires.filter(f => f.frp > 100).length
  const strongWind = weather.speed > 10
  const badAir = air.aqi > 150

  if (highFrp > 5 || (highFrp > 2 && strongWind)) return 'critical'
  if (highFrp > 2 || (highFrp > 0 && strongWind) || badAir) return 'high'
  if (highFrp > 0 || air.aqi > 100) return 'medium'
  return 'low'
}

export async function runAnalysis(
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON
): Promise<SentinelUpdate> {
  // Step 1: fetch all external APIs
  const [fires, weather, airQuality] = await Promise.all([
    fetchFires(DEFAULT_AREA.latSouth, DEFAULT_AREA.lonWest, DEFAULT_AREA.latNorth, DEFAULT_AREA.lonEast),
    fetchWeather(lat, lon),
    fetchAirQuality(lat, lon),
  ])

  // Step 2: call agents in parallel
  const fireUrl = process.env.AGENT_FIRE_URL!
  const weatherUrl = process.env.AGENT_WEATHER_URL!
  const airUrl = process.env.AGENT_AIR_URL!
  const routesUrl = process.env.AGENT_ROUTES_URL!

  // agent-fire  → returns GeoJSONFeature (expansion polygon)
  // agent-weather → returns WeatherAnalysis (agent-internal type, not used in SentinelUpdate directly)
  // agent-air     → returns AirAnalysis (agent-internal type, not used in SentinelUpdate directly)
  // agent-routes  → returns RouteData[] (evacuation routes)
  // Raw weather + air data come from the external APIs above, not from agents
  const [fireResult, weatherResult, airResult, routesResult] = await Promise.all([
    callAgent<GeoJSONFeature>(fireUrl, { firms: fires, weather }),
    callAgent<unknown>(weatherUrl, { weather, firms: fires }),
    callAgent<unknown>(airUrl, { openaq: airQuality, firms: fires }),
    callAgent<RouteData[]>(routesUrl, { firms: fires }),
  ])

  // Step 3: consolidate
  const polygon = fireResult.success
    ? (fireResult.data as GeoJSONFeature)
    : { type: 'Feature' as const, geometry: { type: 'Polygon', coordinates: [] }, properties: {} }

  const routes = routesResult.success ? (routesResult.data as RouteData[]) : []
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
