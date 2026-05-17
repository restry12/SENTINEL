import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { storeRun, getRun, _resetRunCache } from './run-cache'
import type { FireData } from '@sentinel/types'

const fire = (frp: number): FireData => ({
  lat: -16.4, lon: -92.1, frp, brightness: 300, timestamp: '2026-05-16T00:00:00Z',
})

describe('run-cache', () => {
  beforeEach(() => { _resetRunCache() })
  afterEach(() => { vi.useRealTimers() })

  it('storeRun devuelve un runId y getRun recupera lo guardado', () => {
    const fires = [fire(100), fire(50)]
    const id = storeRun(fires)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(getRun(id)).toBe(fires)
  })

  it('runIds distintos para llamadas distintas', () => {
    expect(storeRun([fire(1)])).not.toBe(storeRun([fire(2)]))
  })

  it('getRun de un id inexistente devuelve undefined', () => {
    expect(getRun('no-existe')).toBeUndefined()
  })

  it('una entrada expirada (>15 min) devuelve undefined', () => {
    vi.useFakeTimers()
    const id = storeRun([fire(10)])
    expect(getRun(id)).toBeDefined()
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(getRun(id)).toBeUndefined()
  })

  it('al superar el tope de 20 entradas se descarta la más vieja', () => {
    const first = storeRun([fire(0)])
    for (let i = 1; i < 21; i++) storeRun([fire(i)])
    expect(getRun(first)).toBeUndefined()
  })
})
