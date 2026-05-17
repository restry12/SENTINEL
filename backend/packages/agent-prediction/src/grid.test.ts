import { describe, it, expect } from 'vitest'
import { toTempCelsius, computeFwi, combineScore, categoryFor } from './grid'
import type { WeatherData } from '@sentinel/types'

describe('toTempCelsius', () => {
  it('passes Celsius through and converts Kelvin', () => {
    expect(toTempCelsius(25)).toBe(25)
    expect(toTempCelsius(298.15)).toBeCloseTo(25, 1)
    expect(toTempCelsius(undefined)).toBe(20)
  })
})

describe('computeFwi', () => {
  it('hot/dry/windy scores higher than cold/wet', () => {
    const hot: WeatherData = { speed: 15, deg: 0, humidity: 20, temp: 35 }
    const cold: WeatherData = { speed: 1, deg: 0, humidity: 90, temp: 5 }
    expect(computeFwi(hot)).toBeGreaterThan(computeFwi(cold))
  })
  it('always returns 0..1', () => {
    const extreme: WeatherData = { speed: 99, deg: 0, humidity: 0, temp: 99 }
    expect(computeFwi(extreme)).toBeLessThanOrEqual(1)
    expect(computeFwi(extreme)).toBeGreaterThanOrEqual(0)
  })
})

describe('combineScore', () => {
  it('blends factors 0.40/0.35/0.25 and rounds', () => {
    expect(combineScore({ fwi: 100, historial: 100, terreno: 100 })).toBe(100)
    expect(combineScore({ fwi: 0, historial: 0, terreno: 0 })).toBe(0)
    expect(combineScore({ fwi: 50, historial: 0, terreno: 0 })).toBe(20)
  })
})

describe('categoryFor', () => {
  it('maps score ranges to categories', () => {
    expect(categoryFor(10)).toBe('bajo')
    expect(categoryFor(45)).toBe('medio')
    expect(categoryFor(70)).toBe('alto')
    expect(categoryFor(90)).toBe('critico')
  })
})

import { CHILE_REGIONS, TERRAIN_BY_REGION, pointInRegion, regionBbox } from './regions'

describe('CHILE_REGIONS', () => {
  it('has 16 regions with codregion ids 1-16', () => {
    expect(CHILE_REGIONS).toHaveLength(16)
    const ids = CHILE_REGIONS.map(r => r.id).sort((a, b) => a - b)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
  })
  it('every region has a terrain proxy', () => {
    for (const r of CHILE_REGIONS) {
      expect(typeof TERRAIN_BY_REGION[r.id]).toBe('number')
    }
  })
})

describe('pointInRegion', () => {
  it('a point clearly inside the Metropolitana region returns true', () => {
    const rm = CHILE_REGIONS.find(r => r.id === 13)!
    // Santiago city centre — well inside the Metropolitana region.
    expect(pointInRegion(-70.65, -33.45, rm.geometry)).toBe(true)
  })
  it('a point clearly outside (mid-Pacific) returns false', () => {
    const rm = CHILE_REGIONS.find(r => r.id === 13)!
    expect(pointInRegion(-90, -33.45, rm.geometry)).toBe(false)
  })
  it('a point in another region is not inside Metropolitana', () => {
    const rm = CHILE_REGIONS.find(r => r.id === 13)!
    // Punta Arenas — far south, in Magallanes.
    expect(pointInRegion(-70.9, -53.16, rm.geometry)).toBe(false)
  })
})

describe('regionBbox', () => {
  it('bbox lat/lon are ordered and contain an interior point', () => {
    const rm = CHILE_REGIONS.find(r => r.id === 13)!
    const b = regionBbox(rm.geometry)
    expect(b.latMin).toBeLessThan(b.latMax)
    expect(b.lonMin).toBeLessThan(b.lonMax)
    // Santiago centre lies within the Metropolitana bbox.
    expect(-33.45).toBeGreaterThanOrEqual(b.latMin)
    expect(-33.45).toBeLessThanOrEqual(b.latMax)
    expect(-70.65).toBeGreaterThanOrEqual(b.lonMin)
    expect(-70.65).toBeLessThanOrEqual(b.lonMax)
  })
})

import { buildFireRiskRegionMap } from './grid'
import type { FireData } from '@sentinel/types'

describe('buildFireRiskRegionMap', () => {
  it('builds 16 regions with valid 0-100 scores and categories', async () => {
    const weather: WeatherData = { speed: 10, deg: 0, humidity: 30, temp: 30 }
    const fires: FireData[] = [
      { lat: -38.4, lon: -72.1, frp: 120, brightness: 330, timestamp: '2026-05-17T00:00:00Z' },
    ]
    const map = await buildFireRiskRegionMap(weather, fires)
    expect(map.regions).toHaveLength(16)
    for (const r of map.regions) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
      expect(['bajo', 'medio', 'alto', 'critico']).toContain(r.category)
      expect(r.geometry).toBeDefined()
    }
    expect(map.weather_point).toEqual({ lat: -38.4, lon: -72.1 })
  })

  it('the region containing a live fire scores higher historial than empty regions', async () => {
    const weather: WeatherData = { speed: 5, deg: 0, humidity: 50, temp: 20 }
    // Fire inside La Araucanía (id 9).
    const fires: FireData[] = [
      { lat: -38.7, lon: -72.6, frp: 200, brightness: 340, timestamp: '2026-05-17T00:00:00Z' },
    ]
    const map = await buildFireRiskRegionMap(weather, fires)
    const araucania = map.regions.find(r => r.id === 9)!
    const atacama = map.regions.find(r => r.id === 3)!
    expect(araucania.factors.historial).toBeGreaterThan(atacama.factors.historial)
  })
})
