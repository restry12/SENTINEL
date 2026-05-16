export interface FireData {
  lat: number
  lon: number
  frp: number        // Fire Radiative Power (MW)
  brightness: number
  timestamp: string
}

export interface WeatherData {
  speed: number      // m/s
  deg: number        // meteorological degrees (0=N, 90=E, 180=S, 270=W)
  gust?: number      // optional — not always present in OpenWeather
  humidity: number   // 0-100%
}

export interface AirData {
  pm25: number
  aqi: number
  category: string   // e.g. "Good", "Unhealthy", "Hazardous"
}

export interface RouteData {
  id: string
  geometry: GeoJSONLineString
  distance: number   // meters
  duration: number   // seconds
}

// Minimal GeoJSON types (avoids @types/geojson dependency in shared package)
export interface GeoJSONLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

export interface SentinelUpdate {
  timestamp: string
  fires: FireData[]
  polygon: GeoJSONFeature
  weather: WeatherData
  airQuality: AirData
  routes: RouteData[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface AlertPayload {
  riskLevel: 'high' | 'critical'
  fires: FireData[]
  timestamp: string
}

export interface StatusPayload {
  state: 'loading' | 'ok' | 'error'
  message?: string
}

export interface PollingState {
  active: boolean
  intervalMs: number
  lastRun: string | null
  nextRun: string | null
}

// Agent contract — POST /analyze
export interface AgentRequest {
  firms?: FireData[]
  weather?: WeatherData
  openaq?: AirData
  polygon?: GeoJSONFeature
}

export type AgentResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; data: null; error: string }
