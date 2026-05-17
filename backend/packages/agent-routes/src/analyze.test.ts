import { describe, it, expect } from 'vitest'
import { initialBearing } from './analyze'

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
