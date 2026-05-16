import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PollingController } from './polling'

describe('PollingController', () => {
  let controller: PollingController
  const mockRun = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.useFakeTimers()
    mockRun.mockClear()
    controller = new PollingController(mockRun)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive', () => {
    expect(controller.getState().active).toBe(false)
  })

  it('starts polling and calls run fn after interval', async () => {
    controller.start(1000)
    expect(controller.getState().active).toBe(true)
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('stop disables polling', () => {
    controller.start(1000)
    controller.stop()
    expect(controller.getState().active).toBe(false)
  })

  it('calling start twice does not create double interval', () => {
    controller.start(1000)
    controller.start(1000)
    vi.advanceTimersByTime(1000)
    expect(mockRun).toHaveBeenCalledTimes(1)
  })

  it('stop actually clears the timer and prevents further runs', () => {
    controller.start(1000)
    controller.stop()
    vi.advanceTimersByTime(3000)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('sets nextRun on start and updates lastRun after tick', async () => {
    controller.start(1000)
    expect(controller.getState().nextRun).not.toBeNull()
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
    expect(controller.getState().lastRun).not.toBeNull()
  })
})
