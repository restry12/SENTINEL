import { describe, it, expect } from 'vitest'
import { columnLabel, cellId, terrainFor, zoneNameFor, iterateCells, CELL_DEG } from './zones'

describe('columnLabel', () => {
  it('maps 0 to A, 25 to Z, 26 to AA', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
  })
})

describe('cellId', () => {
  it('produces a stable global id from SW corner', () => {
    expect(cellId(-56, -76)).toBe('A-0')
  })
  it('different cells get different ids', () => {
    expect(cellId(-38.5, -72.0)).not.toBe(cellId(-38.25, -72.0))
  })
})

describe('terrainFor', () => {
  it('desert north is low, forestal centre-south is max', () => {
    expect(terrainFor(-22)).toBeLessThan(terrainFor(-37))
    expect(terrainFor(-37)).toBe(1)
  })
  it('returns 0 outside all bands', () => {
    expect(terrainFor(-10)).toBe(0)
  })
})

describe('zoneNameFor', () => {
  it('returns a band name for a latitude inside Chile', () => {
    expect(zoneNameFor(-37)).toContain('Centro-Sur')
  })
})

describe('iterateCells', () => {
  it('produces land cells only, all aligned to the 0.25 grid', () => {
    const cells = iterateCells()
    expect(cells.length).toBeGreaterThan(1500)
    expect(cells.length).toBeLessThan(4000)
    for (const c of cells.slice(0, 200)) {
      expect(Math.abs(Math.round((c.lat / CELL_DEG) * 1e6) % 1e6)).toBe(0)
    }
  })
})
