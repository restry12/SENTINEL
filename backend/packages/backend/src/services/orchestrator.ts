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
  RoutesResult,
} from '@sentinel/types'

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
  const retryDelays = [0, 20000, 40000] // 0s, 20s, 40s — cold start de Render free tier (~60s total)
  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt] > 0) {
      console.warn(`[orchestrator] retrying ${url} in ${retryDelays[attempt] / 1000}s (attempt ${attempt + 1})...`)
      await new Promise(r => setTimeout(r, retryDelays[attempt]))
    }
    const res = await fetch(`${url}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    })
    if (res.ok) return res.json() as Promise<AgentResponse<T>>
    if (res.status !== 502 && res.status !== 503) throw new Error(`Agent at ${url} returned ${res.status}`)
    if (attempt < retryDelays.length - 1) console.warn(`[orchestrator] ${url} returned ${res.status}, will retry`)
    else throw new Error(`Agent at ${url} returned ${res.status} after ${retryDelays.length} attempts`)
  }
  throw new Error(`Agent at ${url} unreachable`)
}

function calculateRiskLevel(fires: FireData[], weather: WeatherData, air: AirData): SentinelUpdate['riskLevel'] {
  const highFrp = fires.filter(f => f.frp > 35).length
  const strongWind = weather.speed > 10
  const badAir = air.aqi > 150

  if (highFrp > 5 || (highFrp > 2 && strongWind)) return 'critical'
  if (highFrp > 2 || (highFrp > 0 && strongWind) || badAir) return 'high'
  if (highFrp > 0 || air.aqi > 100) return 'medium'
  return 'low'
}

function isWeatherData(v: unknown): v is WeatherData {
  if (typeof v !== 'object' || v === null) return false
  const w = v as Record<string, unknown>
  return typeof w.speed === 'number' && typeof w.deg === 'number' && typeof w.humidity === 'number'
}

// OpenWeather raw response → WeatherData interno
function parseOpenWeatherResponse(v: unknown): WeatherData | null {
  if (typeof v !== 'object' || v === null) return null
  const w = v as Record<string, unknown>
  const wind = w.wind as Record<string, unknown> | undefined
  const main = w.main as Record<string, unknown> | undefined
  if (!wind || !main) return null
  const speed = typeof wind.speed === 'number' ? wind.speed : null
  const deg = typeof wind.deg === 'number' ? wind.deg : 0
  const humidity = typeof main.humidity === 'number' ? main.humidity : 0
  if (speed === null) return null
  return { speed, deg, humidity, gust: typeof wind.gust === 'number' ? wind.gust : undefined }
}

function pm25ToAqi(pm25: number): number {
  const v = Math.max(0, pm25)
  if (v <= 12) return Math.round((50 / 12) * v)
  if (v <= 35.4) return Math.round(50 + ((100 - 51) / (35.4 - 12.1)) * (v - 12.1))
  if (v <= 55.4) return Math.round(100 + ((150 - 101) / (55.4 - 35.5)) * (v - 35.5))
  if (v <= 150.4) return Math.round(150 + ((200 - 151) / (150.4 - 55.5)) * (v - 55.5))
  if (v <= 250.4) return Math.round(200 + ((300 - 201) / (250.4 - 150.5)) * (v - 150.5))
  return Math.round(300 + ((400 - 301) / (350.4 - 250.5)) * (v - 250.5))
}

function aqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}

export async function runAnalysis(
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
  externalFirms?: unknown[],
  externalWeather?: unknown,
  externalPm25?: number
): Promise<SentinelUpdate> {
  // All data comes from Make.com — no external API fetches
  const fires = externalFirms ? (externalFirms as FireData[]) : []
  // Acepta WeatherData interno o respuesta cruda de OpenWeather API
  const weather = isWeatherData(externalWeather)
    ? externalWeather
    : parseOpenWeatherResponse(externalWeather) ?? EMPTY_WEATHER

  if (fires.length === 0) console.warn('[orchestrator] no FIRMS data received')
  if (!isWeatherData(externalWeather) && !parseOpenWeatherResponse(externalWeather))
    console.warn('[orchestrator] no weather data received, using defaults')

  const airQuality: AirData = externalPm25 !== undefined
    ? { pm25: externalPm25, aqi: pm25ToAqi(externalPm25), category: aqiCategory(pm25ToAqi(externalPm25)) }
    : EMPTY_AIR

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
    perFireExpansions: fireAnalysis?.perFireExpansions ?? [],
    airAlerts: airAlerts ?? undefined,
    report,
    naturalRoutes: routesResult?.naturalRoutes ?? undefined,
  }
}
