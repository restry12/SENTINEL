import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/orchestrator', () => ({
  runAnalysis: vi.fn(),
}))
vi.mock('../services/analysis-lock', () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  isLocked: vi.fn(),
}))
vi.mock('../services/last-update', () => ({
  setLastUpdate: vi.fn(),
  getLastUpdate: vi.fn(),
}))
vi.mock('../services/history', () => ({
  saveIncident: vi.fn(),
}))
vi.mock('../services/alert', () => ({
  triggerMakeWebhook: vi.fn(),
}))

import { executeAndBroadcast } from './handlers'
import { runAnalysis } from '../services/orchestrator'
import { acquireLock, releaseLock } from '../services/analysis-lock'
import { setLastUpdate } from '../services/last-update'
import { saveIncident } from '../services/history'
import { triggerMakeWebhook } from '../services/alert'
import type { SentinelUpdate } from '@sentinel/types'

const MOCK_UPDATE: SentinelUpdate = {
  timestamp: '2026-01-01T00:00:00Z',
  fires: [],
  polygon: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} },
  weather: { speed: 0, deg: 0, humidity: 0 },
  airQuality: { pm25: 0, aqi: 0, category: 'Good' },
  routes: [],
  riskLevel: 'low',
}

function makeMockIo() {
  const roomEmit = vi.fn()
  const to = vi.fn(() => ({ emit: roomEmit }))
  const emit = vi.fn()
  return { io: { emit, to } as any, roomEmit, to, emit }
}

describe('executeAndBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(acquireLock).mockReturnValue(true)
    vi.mocked(releaseLock).mockReturnValue(undefined as any)
    vi.mocked(runAnalysis).mockResolvedValue(MOCK_UPDATE)
    vi.mocked(setLastUpdate).mockReturnValue(undefined)
    vi.mocked(saveIncident).mockResolvedValue(undefined)
    vi.mocked(triggerMakeWebhook).mockResolvedValue(undefined)
  })

  it('broadcasts to ALL clients when no targetSocketId', async () => {
    const { io, emit, to } = makeMockIo()
    await executeAndBroadcast(io)
    expect(to).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith('update', MOCK_UPDATE)
    expect(vi.mocked(setLastUpdate)).toHaveBeenCalledWith(MOCK_UPDATE)
  })

  it('emits ONLY to target socket when targetSocketId provided', async () => {
    const { io, roomEmit, to, emit } = makeMockIo()
    await executeAndBroadcast(io, undefined, undefined, undefined, undefined, undefined, 'socket-abc')
    expect(to).toHaveBeenCalledWith('socket-abc')
    expect(roomEmit).toHaveBeenCalledWith('update', MOCK_UPDATE)
    expect(emit).not.toHaveBeenCalledWith('update', expect.anything())
  })

  it('does NOT call setLastUpdate when targetSocketId provided', async () => {
    const { io } = makeMockIo()
    await executeAndBroadcast(io, undefined, undefined, undefined, undefined, undefined, 'socket-abc')
    expect(vi.mocked(setLastUpdate)).not.toHaveBeenCalled()
  })

  it('skips if lock is not acquired', async () => {
    vi.mocked(acquireLock).mockReturnValue(false)
    const { io, emit } = makeMockIo()
    await executeAndBroadcast(io)
    expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})
