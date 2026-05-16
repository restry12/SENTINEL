import type { SentinelUpdate } from '@sentinel/types'
import { getSupabaseAdmin } from './supabase'

// Single-row snapshot of the most recent SentinelUpdate so the dashboard has
// "memory": on page load / socket connect we replay the last known state
// instead of waiting for the next Make.com run.

const SNAPSHOT_ID = 'global'

let lastUpdate: SentinelUpdate | null = null

export function getLastUpdate(): SentinelUpdate | null {
  return lastUpdate
}

export function setLastUpdate(update: SentinelUpdate): void {
  lastUpdate = update
  // Persist to Supabase so it survives Render cold starts. Fire-and-forget;
  // degrades silently if the last_snapshot table doesn't exist yet.
  void persistSnapshot(update)
}

async function persistSnapshot(update: SentinelUpdate): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('last_snapshot')
      .upsert({ id: SNAPSHOT_ID, data: update, updated_at: new Date().toISOString() })
    if (error) console.error('[last-update] snapshot persist failed:', error.message)
  } catch (err) {
    console.error('[last-update] snapshot persist error:', err instanceof Error ? err.message : err)
  }
}

// Called once at startup so a freshly-booted instance already has memory.
export async function loadLastUpdateFromDb(): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('last_snapshot')
      .select('data')
      .eq('id', SNAPSHOT_ID)
      .single()
    if (error) {
      console.warn('[last-update] no snapshot loaded:', error.message)
      return
    }
    if (data?.data) {
      lastUpdate = data.data as SentinelUpdate
      console.log('[last-update] snapshot loaded from Supabase')
    }
  } catch (err) {
    console.warn('[last-update] snapshot load error:', err instanceof Error ? err.message : err)
  }
}
