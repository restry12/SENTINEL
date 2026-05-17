import { describe, it, expect } from 'vitest'
import { haversineKm, socialImpact } from './cell-detail'
import type { CellInfrastructure } from '@sentinel/types'

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(-38, -72, -38, -72)).toBeCloseTo(0, 5)
  })
  it('~111 km for one degree of latitude', () => {
    expect(haversineKm(-38, -72, -39, -72)).toBeGreaterThan(105)
    expect(haversineKm(-38, -72, -39, -72)).toBeLessThan(115)
  })
})

describe('socialImpact', () => {
  it('reports zero impact and a clear message when no infrastructure', () => {
    const r = socialImpact([])
    expect(r.score).toBe(0)
    expect(r.resumen).toMatch(/sin infraestructura/i)
  })
  it('a hospital weighs more than a fire station', () => {
    const hospital: CellInfrastructure = { name: 'H', type: 'hospital', lat: 0, lon: 0, distance_km: 1 }
    const station: CellInfrastructure = { name: 'B', type: 'fire_station', lat: 0, lon: 0, distance_km: 1 }
    expect(socialImpact([hospital]).score).toBeGreaterThan(socialImpact([station]).score)
  })
  it('caps the score at 100', () => {
    const many: CellInfrastructure[] = Array.from({ length: 20 }, (_, i) => ({
      name: `H${i}`, type: 'hospital', lat: 0, lon: 0, distance_km: 1,
    }))
    expect(socialImpact(many).score).toBe(100)
  })
})
