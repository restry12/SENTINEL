export interface FirePerFireWeather {
  speed: number      // m/s
  deg: number        // grados meteorológicos
  humidity: number   // 0-100%
  temp?: number       // °C, opcional
}

export interface FireData {
  lat: number
  lon: number
  frp: number        // Fire Radiative Power (MW)
  brightness: number
  timestamp: string
  weather?: FirePerFireWeather   // clima de ESE foco (OpenWeather vía Make.com)
  pm25?: number | null            // pm25 de ESE foco (OpenAQ); null = sin estación cerca
}

export interface WeatherData {
  speed: number      // m/s
  deg: number        // meteorological degrees (0=N, 90=E, 180=S, 270=W)
  gust?: number      // optional — not always present in OpenWeather
  humidity: number   // 0-100%
  temp?: number      // °C — opcional, viene de OpenWeather main.temp
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
  // LLM enrichment — optional, degrade gracefully if agents fail
  riskAssessment?: RiskAssessment
  expansion?: ExpansionData
  perFireExpansions?: PerFireExpansion[]  // per-fire expansion data
  airAlerts?: AirAlerts
  report?: AuthorityReport
  naturalRoutes?: NaturalRoutes
}

export interface PredictionResult {
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  summary?: string
  [key: string]: unknown
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

// ─── LLM Agent output types ──────────────────────────────────────────────────

export interface RiskAssessment {
  risk_level: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO'
  zona_afectada: string
  confianza: number
  resumen: string
}

export interface ExpansionPolygon {
  type: 'Polygon'
  coordinates: number[][][]
  area_km2: number
}

export interface ExpansionData {
  expansion_2h: ExpansionPolygon
  expansion_6h: ExpansionPolygon
  expansion_12h: ExpansionPolygon
  velocidad_propagacion_kmh: number
  direccion_principal: string
  direccion_principal_deg?: number
}

export interface PerFireExpansion {
  lat: number
  lon: number
  frp: number
  expansion_2h_km2: number
  expansion_6h_km2: number
  expansion_12h_km2: number
  velocidad_kmh: number
  direccion: string
  regional_context: RegionalContext
}

export interface RegionalContext {
  region_name: string
  country: string
  vegetation_type: string
  terrain_type: string
  spread_multiplier: number   // 0.5–2.0 relative to base rate
  max_ros_kmh: number         // absolute ceiling for rate of spread in this region
  reference_fires: string[]   // real historical fires used as calibration anchors
  context_summary: string     // brief narrative fed to A2
}

// Combined output of agent-fire (A1 + A2)
export interface FireAnalysis {
  polygon: GeoJSONFeature        // expansion_2h wrapped as GeoJSONFeature for map display
  riskAssessment: RiskAssessment
  expansion: ExpansionData
  perFireExpansions: PerFireExpansion[]
}

export interface AirAlert {
  zona: string
  aqi: number
  color: string
  nivel: string
  recomendacion: string
}

export interface AirAlerts {
  alertas: AirAlert[]
  resumen_general: string
}

export interface AuthorityReport {
  reporte_id: string
  timestamp: string
  nivel_emergencia: 'NIVEL 1' | 'NIVEL 2' | 'NIVEL 3'
  zona_impacto: string
  poblacion_en_riesgo_estimada: number
  recursos_recomendados: string[]
  acciones_inmediatas: string[]
  zonas_evacuacion_prioritaria: string[]
  resumen_ejecutivo: string
}

export interface NaturalRoute {
  nombre: string
  origen: string
  destino: string
  distancia_km: number
  tiempo_estimado_min: number
  instrucciones: string
  estado: 'LIBRE' | 'CONGESTIONADA' | 'BLOQUEADA'
  prioridad: 1 | 2 | 3
  bearing_deg?: number
}

export interface NaturalRoutes {
  rutas: NaturalRoute[]
  punto_encuentro_principal: string
  mensaje_alerta: string
  weather?: WeatherData // Local weather for the citizen
}

export interface RoutesResult {
  routes: RouteData[]
  naturalRoutes: NaturalRoutes | null
}

// ─── Agent 6 — Fire Risk by Region ───────────────────────────────────────────

export type RiskCategory = 'bajo' | 'medio' | 'alto' | 'critico'

export interface RiskFactors {
  fwi: number        // 0-100 — weather (single point)
  historial: number  // 0-100 — real fire history + live FIRMS
  terreno: number    // 0-100 — vegetation zone proxy
}

export interface RegionGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export interface FireRiskRegion {
  id: number               // codregion 1-16
  nombre: string           // region name from GeoJSON properties.Region
  score: number            // 0-100
  category: RiskCategory
  factors: RiskFactors     // each 0-100
  geometry: RegionGeometry
}

export interface FireRiskRegionMap {
  regions: FireRiskRegion[]
  generated_at: string
  weather_point: { lat: number; lon: number }   // single-weather-point limitation
}

export interface RegionDetail {
  region_id: number
  nombre: string
  infraestructura_total: number          // count of sensible facilities (Overpass)
  resumen_infraestructura: string
  explicacion: string                    // Mistral
  recomendaciones: string[]              // Mistral
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
}

// Agent contract — POST /analyze
export interface AgentRequest {
  firms?: FireData[]
  weather?: WeatherData
  openaq?: AirData
  polygon?: GeoJSONFeature
  // LLM pipeline — passed by orchestrator to agent-report
  riskAssessment?: RiskAssessment
  expansion?: ExpansionData
  airAlerts?: AirAlerts
}

export type AgentResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; data: null; error: string }
