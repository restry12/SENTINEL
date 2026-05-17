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

import { computeHistorial } from './grid'

describe('computeHistorial', () => {
  it('returns an empty map when there are no hotspots', () => {
    expect(computeHistorial([]).size).toBe(0)
  })

  it('the hottest cell normalizes to 100', () => {
    const map = computeHistorial([{ lat: -38.4, lon: -72.1 }])
    const max = Math.max(...map.values())
    expect(max).toBe(100)
  })

  it('neighbouring cells receive a falloff weight below the centre', () => {
    const map = computeHistorial([{ lat: -38.4, lon: -72.1 }])
    const row = Math.floor(-38.4 / 0.25)
    const col = Math.floor(-72.1 / 0.25)
    const centre = map.get(`${row},${col}`) ?? 0
    const neighbour = map.get(`${row + 1},${col}`) ?? 0
    expect(neighbour).toBeGreaterThan(0)
    expect(neighbour).toBeLessThan(centre)
  })
})

import { buildFireRiskGrid } from './grid'
import type { FireData } from '@sentinel/types'

describe('buildFireRiskGrid', () => {
  it('builds a grid of cells with valid 0-100 scores and categories', async () => {
    const weather: WeatherData = { speed: 10, deg: 0, humidity: 30, temp: 30 }
    const fires: FireData[] = [
      { lat: -38.4, lon: -72.1, frp: 120, brightness: 330, timestamp: '2026-05-17T00:00:00Z' },
    ]
    const grid = await buildFireRiskGrid(weather, fires)
    expect(grid.cells.length).toBeGreaterThan(1500)
    for (const c of grid.cells.slice(0, 100)) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
      expect(['bajo', 'medio', 'alto', 'critico']).toContain(c.category)
      expect(c.size).toBe(0.25)
    }
    expect(grid.bbox.latMin).toBe(-56)
    expect(grid.weather_point).toEqual({ lat: -38.4, lon: -72.1 })
  })

  it('cells near a live fire score higher than far-away cells', async () => {
    const weather: WeatherData = { speed: 5, deg: 0, humidity: 50, temp: 20 }
    const fires: FireData[] = [
      { lat: -38.4, lon: -72.1, frp: 200, brightness: 340, timestamp: '2026-05-17T00:00:00Z' },
    ]
    const grid = await buildFireRiskGrid(weather, fires)
    // Cell whose centre is closest to the fire, vs a far Atacama cell.
    const fireCell = grid.cells.reduce((best, c) => {
      const d = Math.hypot(c.lat + 0.125 - -38.4, c.lon + 0.125 - -72.1)
      const bd = Math.hypot(best.lat + 0.125 - -38.4, best.lon + 0.125 - -72.1)
      return d < bd ? c : best
    })
    const desertCell = grid.cells.find(c => c.lat > -25)!
    expect(fireCell.factors.historial).toBeGreaterThan(desertCell.factors.historial)
  })
})
