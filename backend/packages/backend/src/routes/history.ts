import { Router } from 'express'
import { getSupabaseAdmin } from '../services/supabase'

const router = Router()

// GET /api/history — recent incidents, optional filters: ?limit=50&risk_level=critical&from=ISO&to=ISO
router.get('/', async (req, res) => {
  try {
    const admin = getSupabaseAdmin()
    const limit = Math.min(Number(req.query.limit) || 50, 500)
    const risk_level = req.query.risk_level as string | undefined
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined

    let query = admin
      .from('fire_incidents')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (risk_level) query = query.eq('risk_level', risk_level)
    if (from) query = query.gte('timestamp', from)
    if (to) query = query.lte('timestamp', to)

    const { data, error } = await query

    if (error) {
      res.status(500).json({ ok: false, error: error.message })
      return
    }

    res.json({ ok: true, count: data.length, incidents: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, error: message })
  }
})

// GET /api/history/stats — aggregated statistics
router.get('/stats', async (_req, res) => {
  try {
    const admin = getSupabaseAdmin()

    const { data, error } = await admin
      .from('fire_incidents')
      .select('risk_level, frp_max, frp_total, fire_count, aqi, humidity, wind_speed, alerts_sent, timestamp')
      .order('timestamp', { ascending: false })
      .limit(1000)

    if (error) {
      res.status(500).json({ ok: false, error: error.message })
      return
    }

    if (!data || data.length === 0) {
      res.json({ ok: true, stats: null, message: 'No incidents recorded yet' })
      return
    }

    const total = data.length
    const byRisk = data.reduce<Record<string, number>>((acc, r) => {
      acc[r.risk_level] = (acc[r.risk_level] ?? 0) + 1
      return acc
    }, {})

    const avgFrpMax = data.reduce((s, r) => s + (r.frp_max ?? 0), 0) / total
    const avgAqi = data.reduce((s, r) => s + (r.aqi ?? 0), 0) / total
    const avgHumidity = data.reduce((s, r) => s + (r.humidity ?? 0), 0) / total
    const alertsSentCount = data.filter(r => r.alerts_sent).length
    const maxFrp = Math.max(...data.map(r => r.frp_max ?? 0))

    res.json({
      ok: true,
      stats: {
        total_incidents: total,
        by_risk_level: byRisk,
        avg_frp_max_mw: Math.round(avgFrpMax * 10) / 10,
        max_frp_mw: maxFrp,
        avg_aqi: Math.round(avgAqi),
        avg_humidity_pct: Math.round(avgHumidity),
        alerts_sent_count: alertsSentCount,
        first_incident: data[data.length - 1]?.timestamp,
        last_incident: data[0]?.timestamp,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, error: message })
  }
})

// GET /api/history/zone?lat=&lon=&radius=500 — incidents near a geographic point
router.get('/zone', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string)
    const lon = parseFloat(req.query.lon as string)
    const radiusKm = parseFloat(req.query.radius as string) || 500

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ ok: false, error: 'lat and lon are required numeric parameters' })
      return
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('fire_incidents')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000)

    if (error) {
      res.status(500).json({ ok: false, error: error.message })
      return
    }

    const R = 6371
    const toRad = (d: number) => (d * Math.PI) / 180
    const nearby = (data ?? []).filter(incident => {
      const dLat = toRad(incident.centroid_lat - lat)
      const dLon = toRad(incident.centroid_lon - lon)
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(incident.centroid_lat)) * Math.sin(dLon / 2) ** 2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return dist <= radiusKm
    })

    res.json({ ok: true, count: nearby.length, radius_km: radiusKm, incidents: nearby })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, error: message })
  }
})

export default router
