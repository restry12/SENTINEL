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
