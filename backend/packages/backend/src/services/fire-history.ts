import type { FireData } from '@sentinel/types'
import { getSupabaseAdmin } from './supabase'

export async function appendFireHistory(fires: FireData[]): Promise<void> {
  if (fires.length === 0) return

  try {
    const admin = getSupabaseAdmin()
    const rows = fires.map(f => ({
      lat: f.lat,
      lon: f.lon,
      frp: f.frp,
      brightness: f.brightness,
      timestamp: f.timestamp,
    }))

    const { error } = await admin.from('fire_hotspot_history').insert(rows)
    if (error) console.warn('[fire-history] insert failed:', error.message)
  } catch (err) {
    console.warn('[fire-history] error:', err instanceof Error ? err.message : err)
  }
}
