export interface FirePoint {
  id: string
  lat: number
  lng: number
  intensity: number  // 0–1
  name: string
}

export interface WindData {
  speed: number    // km/h
  fromDeg: number  // meteorological: FROM this bearing (0=N, 90=E, 180=S, 270=W)
}

export interface EnvData {
  wind: WindData
  humidity: number      // %
  tempC: number
  visibilityKm: number
}

export interface AQIInfo {
  current: number
  predicted2h: number
  colorHex: string
  label: string
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "VERY HIGH"
  affectedPopulation: number
}

export type ThreatLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL"

export interface InfrastructurePoint {
  id: string
  name: string
  lat: number
  lng: number
  type: "hospital" | "school" | "emergency"
}

export type ScenarioId = "none" | "wind" | "humidity" | "worst"

export interface Scenario {
  id: ScenarioId
  label: string
  env: EnvData
  fires: FirePoint[]
}

// ── Mock data ────────────────────────────────────────────────────
export const MOCK_FIRES: FirePoint[] = [
  { id: "fire-001", lat: -38.14, lng: -71.73, intensity: 0.75, name: "FIRE-001" },
  { id: "fire-002", lat: -38.42, lng: -72.08, intensity: 1.00, name: "FIRE-002 (PRIMARY)" },
]

export const MOCK_ENV: EnvData = {
  wind:         { speed: 24, fromDeg: 315 },
  humidity:     23,
  tempC:        31,
  visibilityKm: 2.1,
}

export const MAP_CENTER = { lat: -38.28, lng: -71.90 }

export const MOCK_INFRASTRUCTURE: InfrastructurePoint[] = [
  { id: "h-001", name: "Hosp. Hernán Henríquez", lat: -38.24, lng: -72.35, type: "hospital"  },
  { id: "s-001", name: "Escuela La Araucanía",    lat: -38.18, lng: -71.62, type: "school"    },
  { id: "s-002", name: "Liceo Técnico Curacautín",lat: -38.44, lng: -71.89, type: "school"    },
  { id: "s-003", name: "Colegio Los Volcanes",     lat: -38.35, lng: -72.12, type: "school"    },
  { id: "e-001", name: "Bomberos Lonquimay",       lat: -38.44, lng: -71.24, type: "emergency" },
]

// ── Scenarios ────────────────────────────────────────────────────
export const SCENARIOS: Record<ScenarioId, Scenario> = {
  none: {
    id: "none", label: "Current",
    env: MOCK_ENV,
    fires: MOCK_FIRES,
  },
  wind: {
    id: "wind", label: "Wind Intensifies",
    env: { ...MOCK_ENV, wind: { speed: 52, fromDeg: 315 } },
    fires: MOCK_FIRES,
  },
  humidity: {
    id: "humidity", label: "Humidity Drops",
    env: { ...MOCK_ENV, humidity: 8, tempC: 37 },
    fires: MOCK_FIRES,
  },
  worst: {
    id: "worst", label: "Worst Case",
    env: { wind: { speed: 65, fromDeg: 315 }, humidity: 5, tempC: 42, visibilityKm: 0.8 },
    fires: [
      { id: "fire-001", lat: -38.14, lng: -71.73, intensity: 1.00, name: "FIRE-001"          },
      { id: "fire-002", lat: -38.42, lng: -72.08, intensity: 1.00, name: "FIRE-002 (PRIMARY)" },
    ],
  },
}

// ── AQI thresholds ───────────────────────────────────────────────
export const AQI_THRESHOLDS: Array<{
  max: number; color: string; label: string; risk: AQIInfo["riskLevel"]
}> = [
  { max: 50,       color: "#22c55e", label: "Good",          risk: "LOW"       },
  { max: 100,      color: "#eab308", label: "Moderate",      risk: "MODERATE"  },
  { max: 150,      color: "#f97316", label: "Unhealthy (S)", risk: "HIGH"      },
  { max: Infinity, color: "#ef4444", label: "Unhealthy",     risk: "VERY HIGH" },
]

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  LOW:      "#22c55e",
  MODERATE: "#eab308",
  HIGH:     "#f97316",
  CRITICAL: "#ef4444",
}

export function aqiColor(aqi: number): string {
  return (AQI_THRESHOLDS.find(t => aqi <= t.max) ?? AQI_THRESHOLDS[AQI_THRESHOLDS.length - 1]).color
}

export function aqiInfo(rawAqi: number, population: number): AQIInfo {
  const clamped = Math.min(500, rawAqi)
  const t = AQI_THRESHOLDS.find(threshold => clamped <= threshold.max) ?? AQI_THRESHOLDS[AQI_THRESHOLDS.length - 1]
  return {
    current:            Math.round(clamped),
    predicted2h:        Math.round(clamped * 1.25),
    colorHex:           t.color,
    label:              t.label,
    riskLevel:          t.risk,
    affectedPopulation: population,
  }
}

export function computeThreatLevel(aqi: number): ThreatLevel {
  if (aqi < 50)  return "LOW"
  if (aqi < 100) return "MODERATE"
  if (aqi < 150) return "HIGH"
  return "CRITICAL"
}

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function computeAQI(
  fires: FirePoint[],
  wind: WindData,
  centerLat: number,
  centerLng: number
): number {
  const toRad = ((wind.fromDeg + 180) % 360) * (Math.PI / 180)
  const wX = Math.sin(toRad)
  const wY = Math.cos(toRad)
  const raw = fires.reduce((sum, fire) => {
    const dist = haversineKm(centerLat, centerLng, fire.lat, fire.lng)
    const dLat = fire.lat - centerLat
    const dLng = fire.lng - centerLng
    const len = Math.sqrt(dLat ** 2 + dLng ** 2) || 1
    const alignment = wX * (dLng / len) + wY * (dLat / len)
    const base = (300 * fire.intensity) / (dist + 1)
    return sum + base * (1 + Math.max(0, alignment) * wind.speed / 15)
  }, 0)
  return Math.min(500, raw)
}
