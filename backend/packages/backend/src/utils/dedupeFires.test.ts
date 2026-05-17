import { describe, it, expect } from 'vitest'
import { dedupeFires } from './dedupeFires'
import type { FireData } from '@sentinel/types'

const f = (lat: number, lon: number, frp: number): FireData => ({
  lat, lon, frp, brightness: 300, timestamp: '2026-05-16T00:00:00Z',
})

describe('dedupeFires', () => {
  it('colapsa detecciones del mismo punto (≈ misma coord) en una, conservando mayor FRP', () => {
    const input = [f(-16.451, -92.103, 210), f(-16.450, -92.101, 198), f(-16.452, -92.099, 215)]
    const out = dedupeFires(input)
    expect(out).toHaveLength(1)
    expect(out[0].frp).toBe(215)
  })

  it('mantiene focos en puntos distintos', () => {
    const input = [f(-16.45, -92.10, 100), f(-17.90, -93.20, 80)]
    expect(dedupeFires(input)).toHaveLength(2)
  })

  it('ordena por FRP descendente', () => {
    const input = [f(-1, -1, 50), f(-2, -2, 300), f(-3, -3, 120)]
    expect(dedupeFires(input).map(x => x.frp)).toEqual([300, 120, 50])
  })

  it('devuelve [] con entrada vacía', () => {
    expect(dedupeFires([])).toEqual([])
  })
})
