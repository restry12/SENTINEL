import { describe, it, expect } from 'vitest'
import { mergeEnriched } from './mergeEnriched'
import type { FireData } from '@sentinel/types'

const raw = (lat: number, lon: number, frp: number): FireData => ({
  lat, lon, frp, brightness: 300, timestamp: '2026-05-16T00:00:00Z',
})
const enrich = (lat: number, lon: number, frp: number): FireData => ({
  ...raw(lat, lon, frp),
  weather: { speed: 5, deg: 180, humidity: 40 },
  pm25: 35,
})

describe('mergeEnriched', () => {
  it('full vacío → devuelve enriched tal cual (degradación)', () => {
    const e = [enrich(-16.4, -92.1, 200)]
    expect(mergeEnriched([], e)).toBe(e)
  })

  it('superpone el enriquecido sobre el crudo del mismo punto (~2 decimales)', () => {
    const full = [raw(-16.451, -92.103, 210), raw(-17.90, -93.20, 80)]
    const enriched = [enrich(-16.450, -92.101, 210)]   // mismo cell a 2 decimales
    const out = mergeEnriched(full, enriched)
    expect(out).toHaveLength(2)
    expect(out[0].weather).toEqual({ speed: 5, deg: 180, humidity: 40 })
    expect(out[0].pm25).toBe(35)
    expect(out[1].weather).toBeUndefined()
    expect(out[1].pm25).toBeUndefined()
  })

  it('mantiene el largo de full y no agrega enriquecidos sin match', () => {
    const full = [raw(1, 1, 10), raw(2, 2, 20)]
    const enriched = [enrich(9, 9, 99)]   // no matchea ninguno
    const out = mergeEnriched(full, enriched)
    expect(out).toHaveLength(2)
    expect(out.every(f => f.weather === undefined)).toBe(true)
  })
})
