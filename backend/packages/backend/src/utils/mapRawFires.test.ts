import { describe, it, expect } from 'vitest'
import { mapRawFiresToFireData } from './mapRawFires'

describe('mapRawFiresToFireData', () => {
  it('adjunta clima+pm25 por foco cuando vienen', () => {
    const raw = [{
      lat: -16.4, lon: -92.1, frp: 210, brightness: 330, date: '2026-05-16T12:00:00Z',
      speed: 5.2, deg: 180, humidity: 40, temp: 28, pm25: 35,
    }]
    const out = mapRawFiresToFireData(raw)
    expect(out[0]).toEqual({
      lat: -16.4, lon: -92.1, frp: 210, brightness: 330, timestamp: '2026-05-16T12:00:00Z',
      weather: { speed: 5.2, deg: 180, humidity: 40, temp: 28 },
      pm25: 35,
    })
  })

  it('pm25 = null cuando no es número (OpenAQ sin estación)', () => {
    const raw = [{ lat: 1, lon: 2, frp: 10, brightness: 300, date: 'T', speed: 1, deg: 2, humidity: 3, pm25: null }]
    expect(mapRawFiresToFireData(raw)[0].pm25).toBeNull()
  })

  it('weather = undefined cuando no hay datos de clima', () => {
    const raw = [{ lat: 1, lon: 2, frp: 10, brightness: 300, timestamp: 'T' }]
    const out = mapRawFiresToFireData(raw)
    expect(out[0].weather).toBeUndefined()
    expect(out[0].timestamp).toBe('T')
  })

  it('devuelve [] con entrada vacía', () => {
    expect(mapRawFiresToFireData([])).toEqual([])
  })
})
