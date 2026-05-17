import type { SevereWeatherVariables, SevereWeatherImpactCorridor } from '@sentinel/types'

const CARDINAL_LABELS: Record<string, string> = {
  '0': 'N', '45': 'NE', '90': 'E', '135': 'SE',
  '180': 'S', '225': 'SW', '270': 'W', '315': 'NW',
}

function bearingToLabel(bearing: number): string {
  // Normalize to 0-360
  bearing = ((bearing % 360) + 360) % 360

  // Find closest cardinal/intercardinal
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(bearing / 45) % 8
  return directions[index]
}

/**
 * Estimate the probable impact corridor based on wind direction and speed.
 * Uses low-level wind direction as the primary storm motion vector.
 *
 * Does NOT claim to predict tornado path — estimates projected storm movement corridor.
 */
export function estimateImpactCorridor(
  vars: SevereWeatherVariables,
  riskScore: number
): SevereWeatherImpactCorridor {
  const windDir = vars.wind_direction_10m
  const windSpeed = vars.wind_speed_10m
  const windGusts = vars.wind_gusts_10m

  // If no wind data, return a null-safe default
  if (windDir == null || windSpeed == null) {
    return {
      direction_label: 'Unknown',
      bearing_degrees: 0,
      estimated_distance_km_1h: 0,
      estimated_distance_km_3h: 0,
      estimated_distance_km_6h: 0,
      explanation: 'Insufficient wind data to estimate impact corridor.',
    }
  }

  // Storm cells generally move with the mean wind — use surface wind as proxy.
  // Wind direction is "from", so storm moves in the wind direction (from → to).
  // Meteorological convention: wind_direction is where wind comes FROM.
  // Storm moves TO = wind_direction (where it's going is the opposite of where it comes from)
  // Actually in meteorology, wind_direction 90 means wind FROM the east, storm moves WEST.
  // No — for storm motion, we use the direction the wind is blowing TOWARD.
  // wind_direction_10m = 90 means wind is coming FROM the east, blowing TOWARD the west.
  // Storm motion bearing = (wind_direction + 180) % 360
  const stormBearing = (windDir + 180) % 360

  // Effective speed for storm motion: use gusts as upper bound, surface as lower bound
  const effectiveSpeed = windGusts != null
    ? (windSpeed + windGusts) / 2
    : windSpeed

  // Scale distance by risk: higher risk → storms persist longer, cover more ground
  const riskMultiplier = 0.8 + (riskScore / 100) * 0.4  // 0.8 to 1.2

  // Distance estimates (km) — speed is km/h
  const dist1h = Math.round(effectiveSpeed * 1 * riskMultiplier)
  const dist3h = Math.round(effectiveSpeed * 3 * riskMultiplier)
  const dist6h = Math.round(effectiveSpeed * 6 * riskMultiplier)

  const label = bearingToLabel(stormBearing)

  return {
    direction_label: label,
    bearing_degrees: Math.round(stormBearing),
    estimated_distance_km_1h: dist1h,
    estimated_distance_km_3h: dist3h,
    estimated_distance_km_6h: dist6h,
    explanation: `Probable impact corridor follows the dominant low-level wind direction (${label}, bearing ${Math.round(stormBearing)}°). Distances estimated from mean wind speed and gust intensity.`,
  }
}
