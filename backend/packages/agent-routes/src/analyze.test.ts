import { describe, it, expect } from 'vitest'
import { initialBearing, computeEscapeBearing } from './analyze'

describe('initialBearing', () => {
  it('returns ~0° when destination is due north', () => {
    expect(initialBearing(0, 0, 1, 0)).toBeCloseTo(0, 0)
  })

  it('returns ~90° when destination is due east', () => {
    expect(initialBearing(0, 0, 0, 1)).toBeCloseTo(90, 0)
  })

  it('returns ~180° when destination is due south', () => {
    expect(initialBearing(1, 0, 0, 0)).toBeCloseTo(180, 0)
  })

  it('returns ~270° when destination is due west', () => {
    expect(initialBearing(0, 1, 0, 0)).toBeCloseTo(270, 0)
  })

  it('returns a value in [0, 360)', () => {
    const b = initialBearing(-38.7, -72.5, -37.7, -72.7)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })

  it('returns a rounded integer', () => {
    const b = initialBearing(-38.7, -72.5, -37.7, -72.7)
    expect(b).toBe(Math.round(b))
  })
})

describe('computeEscapeBearing', () => {
  it('returns bearing opposite to the fire', () => {
    // User at origin, fire due north — escape should be ~180° (south)
    const fires = [{ lat: 1, lon: 0, frp: 100, brightness: 300, timestamp: '' }]
    const bearing = computeEscapeBearing(0, 0, fires, 270) // wind from west, no correction
    expect(bearing).toBeCloseTo(180, 0)
  })

  it('shifts 90° when wind blows fire toward escape direction', () => {
    // Fire north of user → escape = south (180°)
    // windDirDeg=180 (FROM south) blows fire NORTH → away from escape path → no shift
    // windDirDeg=0 (FROM north) blows fire SOUTH → INTO escape path → shift
    const fires = [{ lat: 1, lon: 0, frp: 100, brightness: 300, timestamp: '' }]
    const bearingNoShift = computeEscapeBearing(0, 0, fires, 180)
    const bearingShifted  = computeEscapeBearing(0, 0, fires, 0)
    expect(bearingNoShift).toBeCloseTo(180, 0)
    expect([90, 270]).toContain(Math.round(bearingShifted / 90) * 90)
  })

  it('returns a value in [0, 360)', () => {
    const fires = [{ lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '' }]
    const b = computeEscapeBearing(-38.5, -72.5, fires, 45)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })
})
