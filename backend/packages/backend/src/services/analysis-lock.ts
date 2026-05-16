// Single-flight lock: only one LLM analysis runs at a time.
// Concurrent trigger requests are rejected with a busy status instead of
// launching parallel pipelines that would exhaust the OpenRouter API key.

let busy = false
let busySince: number | null = null

// Safety valve: auto-release lock after 3 minutes in case of unhandled errors
const LOCK_TIMEOUT_MS = 3 * 60 * 1000

export function acquireLock(): boolean {
  if (busy) {
    // Auto-release if lock is stale
    if (busySince && Date.now() - busySince > LOCK_TIMEOUT_MS) {
      console.warn('[lock] stale lock detected — force releasing')
      busy = false
      busySince = null
    } else {
      return false
    }
  }
  busy = true
  busySince = Date.now()
  return true
}

export function releaseLock(): void {
  busy = false
  busySince = null
}

export function isLocked(): boolean {
  return busy
}

export function getLockStatus(): { busy: boolean; durationMs: number | null } {
  return {
    busy,
    durationMs: busySince ? Date.now() - busySince : null,
  }
}
