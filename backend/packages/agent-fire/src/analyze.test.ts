import { describe, it, expect } from 'vitest'
import { degreesToCardinal, centroid, cardinalToDeg } from './analyze'

describe('degreesToCardinal', () => {
  it('returns N for 0°', () => {
    expect(degreesToCardinal(0)).toBe('N')
  })

  it('returns E for 90°', () => {
    expect(degreesToCardinal(90)).toBe('E')
  })

  it('returns S for 180°', () => {
    expect(degreesToCardinal(180)).toBe('S')
  })

  it('returns W for 270°', () => {
    expect(degreesToCardinal(270)).toBe('W')
  })

  it('returns NE for 45°', () => {
    expect(degreesToCardinal(45)).toBe('NE')
  })

  it('returns SW for 225°', () => {
    expect(degreesToCardinal(225)).toBe('SW')
  })
})

describe('centroid', () => {
  it('returns the average lat/lon of a single fire', () => {
    const result = centroid([{ lat: -38.5, lon: -71.2 }])
    expect(result.lat).toBe(-38.5)
    expect(result.lon).toBe(-71.2)
  })

  it('averages lat/lon across multiple fires', () => {
    const result = centroid([
      { lat: -38.0, lon: -71.0 },
      { lat: -40.0, lon: -73.0 },
    ])
    expect(result.lat).toBe(-39.0)
    expect(result.lon).toBe(-72.0)
  })

  it('rounds to 4 decimal places', () => {
    const result = centroid([
      { lat: -38.12345678, lon: -71.98765432 },
      { lat: -38.12345678, lon: -71.98765432 },
    ])
    expect(result.lat.toString().split('.')[1]?.length).toBeLessThanOrEqual(4)
  })
})

describe('cardinalToDeg', () => {
  it('returns 0 for N', () => {
    expect(cardinalToDeg('N')).toBe(0)
  })
  it('returns 45 for NE', () => {
    expect(cardinalToDeg('NE')).toBe(45)
  })
  it('returns 90 for E', () => {
    expect(cardinalToDeg('E')).toBe(90)
  })
  it('returns 135 for SE', () => {
    expect(cardinalToDeg('SE')).toBe(135)
  })
  it('returns 180 for S', () => {
    expect(cardinalToDeg('S')).toBe(180)
  })
  it('returns 225 for SW', () => {
    expect(cardinalToDeg('SW')).toBe(225)
  })
  it('returns 270 for W', () => {
    expect(cardinalToDeg('W')).toBe(270)
  })
  it('returns 315 for NW', () => {
    expect(cardinalToDeg('NW')).toBe(315)
  })
  it('is case-insensitive', () => {
    expect(cardinalToDeg('se')).toBe(135)
    expect(cardinalToDeg('Nw')).toBe(315)
  })
  it('returns 0 for unknown string', () => {
    expect(cardinalToDeg('X')).toBe(0)
  })
})
