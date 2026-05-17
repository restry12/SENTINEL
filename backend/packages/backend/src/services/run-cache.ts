import type { FireData } from '@sentinel/types'
import { randomUUID } from 'crypto'

// Cache en memoria de corridas. /api/fires/filter guarda la lista completa
// deduplicada bajo un runId; /api/trigger/full la recupera para superponer
// los focos enriquecidos. Single instance en Render → Map en memoria alcanza.
const TTL_MS = 15 * 60 * 1000
const MAX_ENTRIES = 20

interface Entry {
  fires: FireData[]
  createdAt: number
}

const store = new Map<string, Entry>()

function sweep(now: number): void {
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(id)
  }
  // Map preserva orden de inserción → la primera clave es la más vieja.
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function storeRun(fires: FireData[]): string {
  const now = Date.now()
  sweep(now)
  const runId = randomUUID()
  store.set(runId, { fires, createdAt: now })
  return runId
}

export function getRun(runId: string): FireData[] | undefined {
  const entry = store.get(runId)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(runId)
    return undefined
  }
  return entry.fires
}

// Solo para tests — limpia el estado del módulo entre casos.
export function _resetRunCache(): void {
  store.clear()
}
