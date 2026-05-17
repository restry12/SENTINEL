import { describe, it, expect } from 'vitest'
import { buildFwiGrid, combineScores, toTempCelsius } from './analyze'
import type { WeatherData } from '@sentinel/types'

describe('toTempCelsius', () => {
  it('returns value as-is if likely already Celsius (< 100)', () => {
    expect(toTempCelsius(25)).toBe(25)
  })

  it('converts Kelvin to Celsius if value > 100', () => {
    expect(toTempCelsius(298.15)).toBeCloseTo(25, 1)
  })

  it('uses fallback 20 if undefined', () => {
    expect(toTempCelsius(undefined)).toBe(20)
  })
})

describe('buildFwiGrid', () => {
  const hotDryWindy: WeatherData = { speed: 15, deg: 270, humidity: 20, temp: 35 }
  const coldWet: WeatherData = { speed: 1, deg: 0, humidity: 90, temp: 5 }

  it('returns array of cells covering the region', () => {
    const grid = buildFwiGrid(hotDryWindy)
    // Region lat [-45,-30] lon [-76,-66] at 0.25° resolution
    // lat steps: (15/0.25)=60, lon steps: (10/0.25)=40 → 2400 cells
    expect(grid.length).toBe(2400)
  })

  it('hot dry windy conditions produce higher fwi_score than cold wet', () => {
    const hotGrid = buildFwiGrid(hotDryWindy)
    const coldGrid = buildFwiGrid(coldWet)
    const avgHot = hotGrid.reduce((s, c) => s + c.fwi_score, 0) / hotGrid.length
    const avgCold = coldGrid.reduce((s, c) => s + c.fwi_score, 0) / coldGrid.length
    expect(avgHot).toBeGreaterThan(avgCold)
  })

  it('all fwi_score values are between 0 and 1', () => {
    const grid = buildFwiGrid(hotDryWindy)
    for (const cell of grid) {
      expect(cell.fwi_score).toBeGreaterThanOrEqual(0)
      expect(cell.fwi_score).toBeLessThanOrEqual(1)
    }
  })

  it('historical_weight is 0 for all cells when no history provided', () => {
    const grid = buildFwiGrid(hotDryWindy)
    for (const cell of grid) {
      expect(cell.historical_weight).toBe(0)
    }
  })
})

describe('combineScores', () => {
  it('applies 0.6 FWI + 0.4 historical weighting', () => {
    const cells = [{ lat: -38, lon: -72, fwi_score: 1, historical_weight: 1, risk_score: 0 }]
    const result = combineScores(cells)
    expect(result[0].risk_score).toBeCloseTo(1.0, 5)
  })

  it('filters out cells with risk_score <= 0.2', () => {
    const cells = [
      { lat: -38, lon: -72, fwi_score: 0.1, historical_weight: 0, risk_score: 0 },
      { lat: -39, lon: -73, fwi_score: 0.8, historical_weight: 0.5, risk_score: 0 },
    ]
    const result = combineScores(cells)
    // 0.1×0.6 + 0×0.4 = 0.06 → filtered
    // 0.8×0.6 + 0.5×0.4 = 0.68 → kept
    expect(result.length).toBe(1)
    expect(result[0].lat).toBe(-39)
  })

  it('risk_score stays between 0 and 1', () => {
    const cells = [{ lat: -38, lon: -72, fwi_score: 1, historical_weight: 1, risk_score: 0 }]
    const result = combineScores(cells)
    expect(result[0].risk_score).toBeLessThanOrEqual(1)
    expect(result[0].risk_score).toBeGreaterThanOrEqual(0)
  })
})
