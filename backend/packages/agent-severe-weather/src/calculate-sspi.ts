import type { SevereWeatherVariables } from '@sentinel/types'

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export interface SSPIResult {
  score: number
  risk_level: RiskLevel
  drivers: string[]
  confidence: number
}

// ─── Weight Constants ────────────────────────────────────────────────────────

const WEIGHT_WIND_GUST = 0.25
const WEIGHT_WIND_SHEAR = 0.25
const WEIGHT_HUMIDITY_TEMP = 0.20
const WEIGHT_PRESSURE = 0.15
const WEIGHT_STORM_PRECIP = 0.10
const WEIGHT_CLOUD = 0.05

// ─── Factor 1: Wind Gust Risk (25%) ─────────────────────────────────────────

export function calcWindGustRisk(gusts_kmh: number | null): { score: number; driver: string | null } {
  if (gusts_kmh == null) return { score: 0, driver: null }

  let score: number
  let driver: string | null = null

  if (gusts_kmh >= 70) {
    score = 100
    driver = `Critical wind gusts (${gusts_kmh} km/h)`
  } else if (gusts_kmh >= 50) {
    score = 75 + ((gusts_kmh - 50) / 20) * 25
    driver = `Strong wind gusts (${gusts_kmh} km/h)`
  } else if (gusts_kmh >= 30) {
    score = 30 + ((gusts_kmh - 30) / 20) * 45
    driver = `Moderate wind gusts (${gusts_kmh} km/h)`
  } else {
    score = (gusts_kmh / 30) * 30
  }

  return { score: Math.min(100, score), driver }
}

// ─── Factor 2: Wind Shear Proxy (25%) ───────────────────────────────────────

export function calcWindShearProxy(vars: SevereWeatherVariables): { score: number; driver: string | null } {
  const speed10 = vars.wind_speed_10m
  const speed80 = vars.wind_speed_80m
  const speed120 = vars.wind_speed_120m
  const dir10 = vars.wind_direction_10m
  const dir80 = vars.wind_direction_80m
  const dir120 = vars.wind_direction_120m

  let speedShear = 0
  let dirShear = 0
  let hasData = false

  // Speed shear: difference between surface and upper levels
  if (speed10 != null && speed120 != null) {
    speedShear = Math.abs(speed120 - speed10)
    hasData = true
  } else if (speed10 != null && speed80 != null) {
    speedShear = Math.abs(speed80 - speed10)
    hasData = true
  }

  // Directional shear: difference in wind direction
  if (dir10 != null && dir120 != null) {
    dirShear = Math.abs(dir120 - dir10)
    if (dirShear > 180) dirShear = 360 - dirShear
    hasData = true
  } else if (dir10 != null && dir80 != null) {
    dirShear = Math.abs(dir80 - dir10)
    if (dirShear > 180) dirShear = 360 - dirShear
    hasData = true
  }

  if (!hasData) return { score: 0, driver: null }

  // Speed shear scoring: 0-10 low, 10-25 moderate, 25-40 high, 40+ critical
  let speedScore: number
  if (speedShear >= 40) speedScore = 100
  else if (speedShear >= 25) speedScore = 70 + ((speedShear - 25) / 15) * 30
  else if (speedShear >= 10) speedScore = 30 + ((speedShear - 10) / 15) * 40
  else speedScore = (speedShear / 10) * 30

  // Direction shear scoring: 0-30° low, 30-90° moderate, 90-150° high, 150°+ critical
  let dirScore: number
  if (dirShear >= 150) dirScore = 100
  else if (dirShear >= 90) dirScore = 70 + ((dirShear - 90) / 60) * 30
  else if (dirShear >= 30) dirScore = 30 + ((dirShear - 30) / 60) * 40
  else dirScore = (dirShear / 30) * 30

  const combined = speedScore * 0.6 + dirScore * 0.4
  const driver = combined >= 40
    ? `Wind shear proxy detected (speed diff ${speedShear.toFixed(0)} km/h, direction diff ${dirShear.toFixed(0)}°)`
    : null

  return { score: Math.min(100, combined), driver }
}

// ─── Factor 3: Humidity + Temperature Instability Proxy (20%) ───────────────

export function calcHumidityTempRisk(vars: SevereWeatherVariables): { score: number; driver: string | null } {
  const rh = vars.relative_humidity_2m
  const temp = vars.temperature_2m

  if (rh == null && temp == null) return { score: 0, driver: null }

  let humidityScore = 0
  let tempScore = 0

  if (rh != null) {
    if (rh >= 80) humidityScore = 100
    else if (rh >= 65) humidityScore = 50 + ((rh - 65) / 15) * 50
    else humidityScore = (rh / 65) * 50
  }

  if (temp != null) {
    if (temp >= 35) tempScore = 100
    else if (temp >= 28) tempScore = 60 + ((temp - 28) / 7) * 40
    else if (temp >= 24) tempScore = 30 + ((temp - 24) / 4) * 30
    else tempScore = Math.max(0, (temp / 24) * 30)
  }

  const combined = humidityScore * 0.5 + tempScore * 0.5
  const driver = (rh != null && rh >= 65 && temp != null && temp >= 24)
    ? `High humidity (${rh}%) and temperature (${temp}°C) favor convection`
    : null

  return { score: Math.min(100, combined), driver }
}

// ─── Factor 4: Pressure Risk (15%) ─────────────────────────────────────────

export function calcPressureRisk(
  currentPressure: number | null,
  pressureDrop3h: number | null
): { score: number; driver: string | null } {
  if (currentPressure == null) return { score: 0, driver: null }

  let score = 0
  let driver: string | null = null

  // Rapid pressure drop is a strong storm signal
  if (pressureDrop3h != null && pressureDrop3h > 0) {
    if (pressureDrop3h >= 6) {
      score = 100
      driver = `Rapid pressure drop (${pressureDrop3h.toFixed(1)} hPa in 3h)`
    } else if (pressureDrop3h >= 4) {
      score = 70 + ((pressureDrop3h - 4) / 2) * 30
      driver = `Notable pressure drop (${pressureDrop3h.toFixed(1)} hPa in 3h)`
    } else if (pressureDrop3h >= 2) {
      score = 40 + ((pressureDrop3h - 2) / 2) * 30
      driver = `Pressure dropping (${pressureDrop3h.toFixed(1)} hPa in 3h)`
    } else {
      score = (pressureDrop3h / 2) * 40
    }
  } else {
    // Fallback: use absolute pressure (low pressure = more risk)
    if (currentPressure < 1000) {
      score = 60 + ((1000 - currentPressure) / 20) * 40
      driver = `Low surface pressure (${currentPressure} hPa)`
    } else if (currentPressure < 1008) {
      score = 30 + ((1008 - currentPressure) / 8) * 30
    } else if (currentPressure < 1013) {
      score = (1013 - currentPressure) / 5 * 30
    }
  }

  return { score: Math.min(100, score), driver }
}

// ─── Factor 5: Storm / Precipitation Risk (10%) ─────────────────────────────

/** WMO weather codes that indicate thunderstorms */
const STORM_CODES = new Set([95, 96, 99])
const HEAVY_PRECIP_CODES = new Set([65, 67, 75, 77, 82, 85, 86])

export function calcStormPrecipRisk(vars: SevereWeatherVariables): { score: number; driver: string | null } {
  const code = vars.weather_code
  const precip = vars.precipitation
  const rain = vars.rain
  const showers = vars.showers

  let score = 0
  let driver: string | null = null

  // Weather code is the strongest signal
  if (code != null) {
    if (STORM_CODES.has(code)) {
      score = 90
      driver = `Thunderstorm weather code (${code})`
    } else if (HEAVY_PRECIP_CODES.has(code)) {
      score = 50
      driver = `Heavy precipitation code (${code})`
    }
  }

  // Precipitation intensity adds to risk
  const totalPrecip = Math.max(precip ?? 0, rain ?? 0, showers ?? 0)
  if (totalPrecip >= 10) {
    score = Math.max(score, 70)
    if (!driver) driver = `Heavy precipitation (${totalPrecip} mm/h)`
  } else if (totalPrecip >= 5) {
    score = Math.max(score, 45)
    if (!driver) driver = `Moderate precipitation (${totalPrecip} mm/h)`
  } else if (totalPrecip >= 2) {
    score = Math.max(score, 25)
  }

  return { score: Math.min(100, score), driver }
}

// ─── Factor 6: Cloud Cover Risk (5%) ────────────────────────────────────────

export function calcCloudCoverRisk(cloudCover: number | null): { score: number; driver: string | null } {
  if (cloudCover == null) return { score: 0, driver: null }

  let score: number
  if (cloudCover >= 90) score = 80
  else if (cloudCover >= 75) score = 50
  else if (cloudCover >= 50) score = 25
  else score = (cloudCover / 50) * 25

  const driver = cloudCover >= 85 ? `Dense cloud cover (${cloudCover}%)` : null
  return { score, driver }
}

// ─── Confidence Calculation ─────────────────────────────────────────────────

export function calculateConfidence(vars: SevereWeatherVariables): number {
  let score = 0
  const maxScore = 100

  // Core variables (10 points each = 70 base)
  if (vars.wind_speed_10m != null) score += 10
  if (vars.wind_gusts_10m != null) score += 10
  if (vars.temperature_2m != null) score += 10
  if (vars.relative_humidity_2m != null) score += 10
  if (vars.surface_pressure != null) score += 10
  if (vars.precipitation != null || vars.showers != null) score += 10
  if (vars.weather_code != null) score += 10

  // Upper-level wind data (15 points each = up to 30 bonus)
  if (vars.wind_speed_80m != null || vars.wind_speed_120m != null) score += 15
  if (vars.wind_direction_80m != null || vars.wind_direction_120m != null) score += 15

  return Math.min(maxScore, score)
}

// ─── Main SSPI Calculator ───────────────────────────────────────────────────

/**
 * Calculate the Severe Storm Potential Index (SSPI) from Open-Meteo variables.
 * Returns a score 0-100, risk level, drivers and confidence.
 *
 * @param vars - Weather variables for the target hour
 * @param pressureDrop3h - Pressure drop over past 3 hours (if available)
 */
export function calculateSevereStormPotential(
  vars: SevereWeatherVariables,
  pressureDrop3h: number | null = null
): SSPIResult {
  const gustResult = calcWindGustRisk(vars.wind_gusts_10m ?? null)
  const shearResult = calcWindShearProxy(vars)
  const humTempResult = calcHumidityTempRisk(vars)
  const pressureResult = calcPressureRisk(vars.surface_pressure ?? null, pressureDrop3h)
  const stormResult = calcStormPrecipRisk(vars)
  const cloudResult = calcCloudCoverRisk(vars.cloud_cover ?? null)

  // Weighted sum
  const score = Math.round(
    gustResult.score * WEIGHT_WIND_GUST +
    shearResult.score * WEIGHT_WIND_SHEAR +
    humTempResult.score * WEIGHT_HUMIDITY_TEMP +
    pressureResult.score * WEIGHT_PRESSURE +
    stormResult.score * WEIGHT_STORM_PRECIP +
    cloudResult.score * WEIGHT_CLOUD
  )

  // Clamp 0-100
  const finalScore = Math.max(0, Math.min(100, score))

  // Classification
  let risk_level: RiskLevel
  if (finalScore >= 76) risk_level = 'CRITICAL'
  else if (finalScore >= 51) risk_level = 'HIGH'
  else if (finalScore >= 26) risk_level = 'MODERATE'
  else risk_level = 'LOW'

  // Collect active drivers
  const drivers: string[] = []
  if (gustResult.driver) drivers.push(gustResult.driver)
  if (shearResult.driver) drivers.push(shearResult.driver)
  if (humTempResult.driver) drivers.push(humTempResult.driver)
  if (pressureResult.driver) drivers.push(pressureResult.driver)
  if (stormResult.driver) drivers.push(stormResult.driver)
  if (cloudResult.driver) drivers.push(cloudResult.driver)

  const confidence = calculateConfidence(vars)

  return { score: finalScore, risk_level, drivers, confidence }
}

/**
 * Calculate pressure drop over 3 hours from hourly pressure data.
 * Returns positive number if pressure is dropping, null if data insufficient.
 */
export function calcPressureDrop3h(
  pressureArray: (number | null)[] | undefined,
  currentIndex: number
): number | null {
  if (!pressureArray) return null
  const threeHoursAgoIdx = currentIndex - 3
  if (threeHoursAgoIdx < 0) return null

  const current = pressureArray[currentIndex]
  const past = pressureArray[threeHoursAgoIdx]
  if (current == null || past == null) return null

  const drop = past - current  // positive = pressure dropping
  return drop > 0 ? drop : null
}
