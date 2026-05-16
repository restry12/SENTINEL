import type { PollingState } from '@sentinel/types'

type RunFn = () => Promise<void>

export class PollingController {
  private timer: ReturnType<typeof setInterval> | null = null
  private state: PollingState = {
    active: false,
    intervalMs: 0,
    lastRun: null,
    nextRun: null,
  }

  constructor(private readonly run: RunFn) {}

  start(intervalMs: number): void {
    if (this.state.active) this.stop()

    this.state.intervalMs = intervalMs
    this.state.active = true
    this.state.nextRun = new Date(Date.now() + intervalMs).toISOString()

    this.timer = setInterval(async () => {
      this.state.lastRun = new Date().toISOString()
      this.state.nextRun = new Date(Date.now() + intervalMs).toISOString()
      await this.run()
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.state.active = false
    this.state.nextRun = null
  }

  getState(): PollingState {
    return { ...this.state }
  }
}
