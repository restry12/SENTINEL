import { describe, it, expect } from 'vitest'
import { parseCitizenBody } from './index'

describe('parseCitizenBody', () => {
  it('returns null when socketId is missing', () => {
    expect(parseCitizenBody({ fires: [], lat: -38, lon: -72 })).toBeNull()
  })

  it('returns null when socketId is empty string', () => {
    expect(parseCitizenBody({ fires: [], lat: -38, lon: -72, socketId: '' })).toBeNull()
  })

  it('returns null when fires is not an array', () => {
    expect(parseCitizenBody({ fires: 'bad', lat: -38, lon: -72, socketId: 'abc' })).toBeNull()
  })

  it('returns parsed body with valid input', () => {
    const fires = [{ lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '' }]
    const result = parseCitizenBody({ fires, lat: -38.5, lon: -72.5, socketId: 'abc123' })
    expect(result).not.toBeNull()
    expect(result?.socketId).toBe('abc123')
    expect(result?.lat).toBe(-38.5)
    expect(result?.lon).toBe(-72.5)
    expect(result?.firms).toBe(fires)
  })

  it('extracts max pm25 from fires', () => {
    const fires = [
      { lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '', pm25: 40 },
      { lat: -38.1, lon: -72.1, frp: 80, brightness: 280, timestamp: '', pm25: 80 },
    ]
    const result = parseCitizenBody({ fires, lat: -38, lon: -72, socketId: 'abc' })
    expect(result?.pm25).toBe(80)
  })

  it('sets pm25 to undefined when no fires have pm25', () => {
    const fires = [{ lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '' }]
    const result = parseCitizenBody({ fires, lat: -38, lon: -72, socketId: 'abc' })
    expect(result?.pm25).toBeUndefined()
  })
})
