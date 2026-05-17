import { describe, it, expect } from 'vitest'
import {
  calculateSevereStormPotential,
  calcWindGustRisk,
  calcWindShearProxy,
  calcHumidityTempRisk,
  calcPressureRisk,
  calcStormPrecipRisk,
  calcCloudCoverRisk,
  calculateConfidence,
  calcPressureDrop3h,
} from './calculate-sspi'
import { estimateImpactCorridor } from './impact-corridor'
import { extractVariablesAtIndex, findTimeIndices } from './open-meteo'
import type { SevereWeatherVariables } from '@sentinel/types'

// ─── SSPI Calculation Tests ──────────────────────────────────────────────────

describe('calcWindGustRisk', () => {
  it('returns 0 for null input', () => {
    expect(calcWindGustRisk(null).score).toBe(0)
  })

  it('returns low score for light gusts', () => {
    const result = calcWindGustRisk(15)
    expect(result.score).toBeLessThan(30)
    expect(result.driver).toBeNull()
  })

  it('returns moderate score for 40 km/h gusts', () => {
    const result = calcWindGustRisk(40)
    expect(result.score).toBeGreaterThanOrEqual(30)
    expect(result.score).toBeLessThan(75)
    expect(result.driver).toContain('Moderate')
  })

  it('returns high score for 60 km/h gusts', () => {
    const result = calcWindGustRisk(60)
    expect(result.score).toBeGreaterThanOrEqual(75)
    expect(result.driver).toContain('Strong')
  })

  it('returns critical score for 80 km/h gusts', () => {
    const result = calcWindGustRisk(80)
    expect(result.score).toBe(100)
    expect(result.driver).toContain('Critical')
  })
})

describe('calcWindShearProxy', () => {
  it('returns 0 when no upper-level data available', () => {
    const vars: SevereWeatherVariables = {
      wind_speed_10m: 20,
      wind_direction_10m: 180,
    }
    expect(calcWindShearProxy(vars).score).toBe(0)
  })

  it('detects speed shear between 10m and 80m', () => {
    const vars: SevereWeatherVariables = {
      wind_speed_10m: 10,
      wind_speed_80m: 45,
      wind_direction_10m: 180,
      wind_direction_80m: 180,
    }
    const result = calcWindShearProxy(vars)
    expect(result.score).toBeGreaterThan(40)
    expect(result.driver).toContain('shear')
  })

  it('detects directional shear', () => {
    const vars: SevereWeatherVariables = {
      wind_speed_10m: 20,
      wind_speed_80m: 25,
      wind_direction_10m: 90,
      wind_direction_80m: 210,
    }
    const result = calcWindShearProxy(vars)
    expect(result.score).toBeGreaterThan(30)
  })
})

describe('calcHumidityTempRisk', () => {
  it('returns 0 when both null', () => {
    const result = calcHumidityTempRisk({})
    expect(result.score).toBe(0)
  })

  it('returns high score for hot and humid conditions', () => {
    const result = calcHumidityTempRisk({
      temperature_2m: 33,
      relative_humidity_2m: 85,
    })
    expect(result.score).toBeGreaterThan(60)
    expect(result.driver).toContain('humidity')
  })

  it('returns low score for cool dry conditions', () => {
    const result = calcHumidityTempRisk({
      temperature_2m: 15,
      relative_humidity_2m: 40,
    })
    expect(result.score).toBeLessThan(30)
  })
})

describe('calcPressureRisk', () => {
  it('returns 0 for null pressure', () => {
    expect(calcPressureRisk(null, null).score).toBe(0)
  })

  it('returns high score for rapid pressure drop', () => {
    const result = calcPressureRisk(1002, 5)
    expect(result.score).toBeGreaterThan(60)
    expect(result.driver).toContain('pressure drop')
  })

  it('uses absolute pressure as fallback when no drop data', () => {
    const result = calcPressureRisk(995, null)
    expect(result.score).toBeGreaterThan(40)
    expect(result.driver).toContain('Low surface pressure')
  })

  it('returns low score for normal pressure without drop', () => {
    const result = calcPressureRisk(1015, null)
    expect(result.score).toBeLessThan(15)
  })
})

describe('calcStormPrecipRisk', () => {
  it('returns high score for thunderstorm weather code 95', () => {
    const result = calcStormPrecipRisk({ weather_code: 95 })
    expect(result.score).toBe(90)
    expect(result.driver).toContain('Thunderstorm')
  })

  it('returns moderate score for heavy precipitation', () => {
    const result = calcStormPrecipRisk({ precipitation: 12, weather_code: 61 })
    expect(result.score).toBeGreaterThanOrEqual(70)
  })

  it('returns 0 for no data', () => {
    expect(calcStormPrecipRisk({}).score).toBe(0)
  })
})

describe('calcCloudCoverRisk', () => {
  it('returns 0 for null', () => {
    expect(calcCloudCoverRisk(null).score).toBe(0)
  })

  it('returns moderate score for high cloud cover', () => {
    const result = calcCloudCoverRisk(92)
    expect(result.score).toBeGreaterThanOrEqual(50)
  })

  it('returns low score for partial clouds', () => {
    const result = calcCloudCoverRisk(30)
    expect(result.score).toBeLessThan(25)
  })
})

// ─── Main SSPI Calculator ──────────────────────────────────────────────────��

describe('calculateSevereStormPotential', () => {
  it('returns LOW for calm conditions', () => {
    const vars: SevereWeatherVariables = {
      temperature_2m: 18,
      relative_humidity_2m: 45,
      surface_pressure: 1018,
      precipitation: 0,
      weather_code: 0,
      cloud_cover: 20,
      wind_speed_10m: 8,
      wind_direction_10m: 180,
      wind_gusts_10m: 15,
    }
    const result = calculateSevereStormPotential(vars, null)
    expect(result.risk_level).toBe('LOW')
    expect(result.score).toBeLessThanOrEqual(25)
    expect(result.drivers.length).toBe(0)
  })

  it('returns HIGH/CRITICAL for severe conditions', () => {
    const vars: SevereWeatherVariables = {
      temperature_2m: 32,
      relative_humidity_2m: 80,
      surface_pressure: 1000,
      precipitation: 8,
      weather_code: 95,
      cloud_cover: 95,
      wind_speed_10m: 35,
      wind_direction_10m: 180,
      wind_gusts_10m: 75,
      wind_speed_80m: 60,
      wind_direction_80m: 240,
      wind_speed_120m: 70,
      wind_direction_120m: 270,
    }
    const result = calculateSevereStormPotential(vars, 5)
    expect(result.risk_level === 'HIGH' || result.risk_level === 'CRITICAL').toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(51)
    expect(result.drivers.length).toBeGreaterThan(3)
  })

  it('score is always between 0 and 100', () => {
    const extreme: SevereWeatherVariables = {
      temperature_2m: 40,
      relative_humidity_2m: 100,
      surface_pressure: 980,
      precipitation: 50,
      weather_code: 99,
      cloud_cover: 100,
      wind_speed_10m: 50,
      wind_gusts_10m: 120,
      wind_speed_80m: 90,
      wind_direction_10m: 0,
      wind_direction_80m: 180,
    }
    const result = calculateSevereStormPotential(extreme, 10)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})

// ─── Confidence Tests ────────────────────────────────────────────────────────

describe('calculateConfidence', () => {
  it('returns high confidence when all variables present', () => {
    const vars: SevereWeatherVariables = {
      wind_speed_10m: 20,
      wind_gusts_10m: 40,
      temperature_2m: 28,
      relative_humidity_2m: 70,
      surface_pressure: 1005,
      precipitation: 2,
      weather_code: 80,
      wind_speed_80m: 35,
      wind_direction_80m: 200,
    }
    expect(calculateConfidence(vars)).toBeGreaterThanOrEqual(85)
  })

  it('returns low confidence when variables missing', () => {
    const vars: SevereWeatherVariables = {
      temperature_2m: 25,
      wind_speed_10m: 15,
    }
    expect(calculateConfidence(vars)).toBeLessThanOrEqual(30)
  })

  it('increases confidence with upper-level wind data', () => {
    const base: SevereWeatherVariables = {
      wind_speed_10m: 20,
      wind_gusts_10m: 40,
      temperature_2m: 28,
      relative_humidity_2m: 70,
      surface_pressure: 1005,
      precipitation: 2,
      weather_code: 80,
    }
    const withUpper: SevereWeatherVariables = {
      ...base,
      wind_speed_80m: 35,
      wind_direction_80m: 200,
    }
    expect(calculateConfidence(withUpper)).toBeGreaterThan(calculateConfidence(base))
  })
})

// ─── Pressure Drop ──────────────────────────────────────────────────────────

describe('calcPressureDrop3h', () => {
  it('returns null if array too short', () => {
    expect(calcPressureDrop3h([1010, 1008], 1)).toBeNull()
  })

  it('returns positive value for dropping pressure', () => {
    const pressures = [1015, 1013, 1011, 1009]
    expect(calcPressureDrop3h(pressures, 3)).toBe(6) // 1015 - 1009
  })

  it('returns null for rising pressure', () => {
    const pressures = [1005, 1008, 1010, 1013]
    expect(calcPressureDrop3h(pressures, 3)).toBeNull() // 1005 - 1013 = -8 → null
  })

  it('returns null for null values', () => {
    const pressures = [null, 1010, 1008, 1005]
    expect(calcPressureDrop3h(pressures, 3)).toBeNull()
  })
})

// ─── Impact Corridor Tests ──────────────────────────────────────────────────

describe('estimateImpactCorridor', () => {
  it('returns Unknown when no wind data', () => {
    const result = estimateImpactCorridor({}, 50)
    expect(result.direction_label).toBe('Unknown')
    expect(result.estimated_distance_km_1h).toBe(0)
  })

  it('calculates storm bearing opposite to wind source direction', () => {
    // Wind FROM south (180°) → storm moves NORTH (0°)
    const vars: SevereWeatherVariables = {
      wind_speed_10m: 30,
      wind_direction_10m: 180, // FROM south
      wind_gusts_10m: 50,
    }
    const result = estimateImpactCorridor(vars, 60)
    expect(result.bearing_degrees).toBe(0) // Storm moves north
    expect(result.direction_label).toBe('N')
  })

  it('scales distance with wind speed', () => {
    const slow: SevereWeatherVariables = {
      wind_speed_10m: 10,
      wind_direction_10m: 90,
      wind_gusts_10m: 15,
    }
    const fast: SevereWeatherVariables = {
      wind_speed_10m: 40,
      wind_direction_10m: 90,
      wind_gusts_10m: 60,
    }
    const rSlow = estimateImpactCorridor(slow, 50)
    const rFast = estimateImpactCorridor(fast, 50)
    expect(rFast.estimated_distance_km_1h).toBeGreaterThan(rSlow.estimated_distance_km_1h)
  })

  it('distance scales proportionally over time', () => {
    const vars: SevereWeatherVariables = {
      wind_speed_10m: 30,
      wind_direction_10m: 270,
      wind_gusts_10m: 45,
    }
    const result = estimateImpactCorridor(vars, 50)
    expect(result.estimated_distance_km_3h).toBeGreaterThan(result.estimated_distance_km_1h)
    expect(result.estimated_distance_km_6h).toBeGreaterThan(result.estimated_distance_km_3h)
  })
})

// ─── Open-Meteo Helpers ─────────────────────────────────────────────────────

describe('extractVariablesAtIndex', () => {
  it('extracts values at given index', () => {
    const hourly = {
      time: ['2026-05-17T12:00', '2026-05-17T13:00'],
      temperature_2m: [25.5, 27.0],
      wind_speed_10m: [12, 18],
      wind_gusts_10m: [null, 35],
    }
    const vars = extractVariablesAtIndex(hourly, 1)
    expect(vars.temperature_2m).toBe(27.0)
    expect(vars.wind_speed_10m).toBe(18)
    expect(vars.wind_gusts_10m).toBe(35)
  })

  it('returns null for missing arrays', () => {
    const hourly = { time: ['2026-05-17T12:00'] }
    const vars = extractVariablesAtIndex(hourly, 0)
    expect(vars.temperature_2m).toBeNull()
    expect(vars.wind_speed_80m).toBeNull()
  })
})

describe('findTimeIndices', () => {
  it('finds closest time to now', () => {
    const now = new Date()
    const times = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now)
      d.setHours(d.getHours() - 12 + i)
      d.setMinutes(0, 0, 0)
      return d.toISOString()
    })
    const result = findTimeIndices(times)
    expect(result.now).toBeGreaterThanOrEqual(0)
    expect(result.plus1h).toBe(result.now + 1)
    expect(result.plus3h).toBe(Math.min(result.now + 3, 23))
    expect(result.plus6h).toBe(Math.min(result.now + 6, 23))
  })

  it('clamps indices to array length', () => {
    const times = ['2026-05-17T00:00', '2026-05-17T01:00', '2026-05-17T02:00']
    const result = findTimeIndices(times)
    expect(result.plus6h).toBeLessThan(times.length)
  })
})
