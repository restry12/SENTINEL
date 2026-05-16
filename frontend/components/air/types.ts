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

// ── Mock data (swap for socket.io later) ────────────────────────
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

// ── AQI thresholds ───────────────────────────────────────────────
export const AQI_THRESHOLDS: Array<{
  max: number
  color: string
  label: string
  risk: AQIInfo["riskLevel"]
}> = [
  { max: 50,       color: "#22c55e", label: "Good",           risk: "LOW"       },
  { max: 100,      color: "#eab308", label: "Moderate",       risk: "MODERATE"  },
  { max: 150,      color: "#f97316", label: "Unhealthy (S)",  risk: "HIGH"      },
  { max: Infinity, color: "#ef4444", label: "Unhealthy",      risk: "VERY HIGH" },
]

export function aqiColor(aqi: number): string {
  return AQI_THRESHOLDS.find(t => aqi <= t.max)!.color
}

export function aqiInfo(rawAqi: number, population: number): AQIInfo {
  const clamped = Math.min(500, rawAqi)
  const t = AQI_THRESHOLDS.find(t => clamped <= t.max)!
  return {
    current:            Math.round(clamped),
    predicted2h:        Math.round(clamped * 1.25),
    colorHex:           t.color,
    label:              t.label,
    riskLevel:          t.risk,
    affectedPopulation: population,
  }
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
