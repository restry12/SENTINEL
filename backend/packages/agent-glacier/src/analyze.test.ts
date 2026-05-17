import { describe, it, expect } from 'vitest'
import { estimateDaysAboveZero, thermalBaseline, buildPrediction } from './analyze'

describe('thermalBaseline', () => {
  it('returns -8 for altitude above 4000m', () => {
    expect(thermalBaseline(5000)).toBe(-8)
  })
  it('returns -3 for altitude 2000–4000m', () => {
    expect(thermalBaseline(3000)).toBe(-3)
  })
  it('returns 2 for altitude below 2000m', () => {
    expect(thermalBaseline(500)).toBe(2)
  })
})

describe('estimateDaysAboveZero', () => {
  it('returns fewer days for high altitude', () => {
    const highAlt = estimateDaysAboveZero(-46, 5000, -5, 7)
    const lowAlt = estimateDaysAboveZero(-46, 300, -5, 7)
    expect(highAlt).toBeLessThan(lowAlt)
  })
  it('returns 0 or more (never negative)', () => {
    const result = estimateDaysAboveZero(65, 4500, -20, 1)
    expect(result).toBeGreaterThanOrEqual(0)
  })
  it('returns 365 or fewer (never over a year)', () => {
    const result = estimateDaysAboveZero(0, 0, 30, 7)
    expect(result).toBeLessThanOrEqual(365)
  })
})

describe('buildPrediction', () => {
  it('returns trend string with year/mass and label', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -850 },
      { year: 2021, mass_change_mmwe: -920 },
      { year: 2022, mass_change_mmwe: -1050 },
    ]
    const { trend } = buildPrediction(history, 55)
    expect(trend).toContain('-1050')
    expect(trend).toContain('mm w.e./año')
  })

  it('returns null estimated_years_to_critical when riskScore > 75', () => {
    const history = [{ year: 2022, mass_change_mmwe: -2000 }]
    const { estimated_years_to_critical } = buildPrediction(history, 80)
    expect(estimated_years_to_critical).toBeNull()
  })

  it('returns "Sin datos" trend for empty history', () => {
    const { trend } = buildPrediction([], 30)
    expect(trend).toBe('Sin datos')
  })

  it('marks accelerating when last year worse than average', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -500 },
      { year: 2021, mass_change_mmwe: -600 },
      { year: 2022, mass_change_mmwe: -1000 },
    ]
    const { trend } = buildPrediction(history, 50)
    expect(trend).toContain('acelerando')
  })

  it('marks estable when last year not worse than average', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -1000 },
      { year: 2021, mass_change_mmwe: -900 },
      { year: 2022, mass_change_mmwe: -800 },
    ]
    const { trend } = buildPrediction(history, 40)
    expect(trend).toContain('estable')
  })

  it('returns numeric years estimate for accelerating glacier below critical threshold', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -500 },
      { year: 2021, mass_change_mmwe: -600 },
      { year: 2022, mass_change_mmwe: -1000 },
    ]
    // avg = (-500 + -600 + -1000) / 3 = -700
    // last = -1000, accelerating = true (last < avg)
    // annualRate = |(-1000) - (-700)| = 300
    // pointsToGo = 76 - 50 = 26
    // years = round(26 / (300/100)) = round(26/3) = 9
    const { estimated_years_to_critical } = buildPrediction(history, 50)
    expect(estimated_years_to_critical).toBe(9)
  })
})
