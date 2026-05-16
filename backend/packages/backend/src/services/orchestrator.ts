import type {
  SentinelUpdate,
  AgentRequest,
  AgentResponse,
  FireData,
  WeatherData,
  AirData,
  GeoJSONFeature,
  FireAnalysis,
  AirAlerts,
  AuthorityReport,
} from '@sentinel/types'
import type { RoutesResult } from '../../../agent-routes/src/analyze'
import { fetchWeather } from './openweather'
import { fetchFires } from './firms'
import { fetchAirQuality } from './openaq'

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
  // Step 1: fetch external APIs — fault-isolated
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

  // Step 2: call agents in parallel (fire, air, routes) — fault-isolated
  // agent-fire runs A1→A2 internally (sequential), others are independent
  const fireUrl = requireEnv('AGENT_FIRE_URL')
  const weatherUrl = requireEnv('AGENT_WEATHER_URL')
  const airUrl = requireEnv('AGENT_AIR_URL')
  const routesUrl = requireEnv('AGENT_ROUTES_URL')
  const reportUrl = process.env.AGENT_REPORT_URL  // optional — skip silently if not set

  const [fireSettled, weatherAgentSettled, airAgentSettled, routesSettled] = await Promise.allSettled([
    callAgent<FireAnalysis>(fireUrl, { firms: fires, weather }),
    callAgent<unknown>(weatherUrl, { weather, firms: fires }),
    callAgent<AirAlerts>(airUrl, { openaq: airQuality, firms: fires }),
    callAgent<RoutesResult>(routesUrl, { firms: fires }),
  ])

  if (fireSettled.status === 'rejected') console.warn('[orchestrator] agent-fire failed:', fireSettled.reason)
  if (weatherAgentSettled.status === 'rejected') console.warn('[orchestrator] agent-weather failed:', weatherAgentSettled.reason)
  if (airAgentSettled.status === 'rejected') console.warn('[orchestrator] agent-air failed:', airAgentSettled.reason)
  if (routesSettled.status === 'rejected') console.warn('[orchestrator] agent-routes failed:', routesSettled.reason)

  // Extract LLM outputs
  const fireAnalysis =
    fireSettled.status === 'fulfilled' && fireSettled.value.success
      ? fireSettled.value.data
      : null

  const airAlerts =
    airAgentSettled.status === 'fulfilled' && airAgentSettled.value.success
      ? airAgentSettled.value.data
      : null

  const routesResult =
    routesSettled.status === 'fulfilled' && routesSettled.value.success
      ? routesSettled.value.data
      : null

  // Step 3: agent-report (A4) — needs A1+A2+A3 output, runs after step 2
  let report: AuthorityReport | undefined
  if (reportUrl && fireAnalysis?.riskAssessment && fireAnalysis?.expansion && airAlerts) {
    const [reportSettled] = await Promise.allSettled([
      callAgent<AuthorityReport>(reportUrl, {
        riskAssessment: fireAnalysis.riskAssessment,
        expansion: fireAnalysis.expansion,
        airAlerts,
      }),
    ])
    if (reportSettled.status === 'fulfilled' && reportSettled.value.success) {
      report = reportSettled.value.data
    } else if (reportSettled.status === 'rejected') {
      console.warn('[orchestrator] agent-report failed:', reportSettled.reason)
    }
  }

  // Step 4: consolidate
  const polygon = fireAnalysis?.polygon ?? EMPTY_POLYGON
  const routes = routesResult?.routes ?? []
  const riskLevel = calculateRiskLevel(fires, weather, airQuality)

  return {
    timestamp: new Date().toISOString(),
    fires,
    polygon,
    weather,
    airQuality,
    routes,
    riskLevel,
    riskAssessment: fireAnalysis?.riskAssessment,
    expansion: fireAnalysis?.expansion,
    airAlerts: airAlerts ?? undefined,
    report,
    naturalRoutes: routesResult?.naturalRoutes ?? undefined,
  }
}
