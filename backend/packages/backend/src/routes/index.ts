import type { Express } from 'express'
import type { Server } from 'socket.io'
import type { PollingController } from '../controllers/polling'
import { rateLimit } from 'express-rate-limit'
import { executeAndBroadcast } from '../socket/handlers'
import { parseFirmsCSV } from '../utils/parseFirmsCSV'
import { dedupeFires } from '../utils/dedupeFires'
import { mapRawFiresToFireData } from '../utils/mapRawFires'
import { storeRun, getRun } from '../services/run-cache'
import { mergeEnriched } from '../utils/mergeEnriched'
import { isLocked, getLockStatus } from '../services/analysis-lock'
import { getLastUpdate } from '../services/last-update'
import { fetchRiskGrid, fetchCellDetail } from '../services/prediction-proxy'
import type { RiskCategory, RiskFactors } from '@sentinel/types'
import authRouter from './auth'
import geoRouter from './geo'
import historyRouter from './history'

const ENRICH_LIMIT = 50

// Citizen session store: maps lat+lon key → socketId for the duration of a Make.com round-trip.
// Make.com echoes back {{1.lat}} and {{1.lon}} verbatim, so we can recover the socketId without
// passing it through Make.com's entire scenario.
const CITIZEN_SESSION_TTL_MS = 10 * 60 * 1000
const citizenSessions = new Map<string, { socketId: string; createdAt: number }>()

function citizenSessionKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`
}

function storeCitizenSession(lat: number, lon: number, socketId: string): void {
  const now = Date.now()
  for (const [k, v] of citizenSessions) {
    if (now - v.createdAt > CITIZEN_SESSION_TTL_MS) citizenSessions.delete(k)
  }
  citizenSessions.set(citizenSessionKey(lat, lon), { socketId, createdAt: now })
}

function getCitizenSocketId(lat: number, lon: number): string | undefined {
  const entry = citizenSessions.get(citizenSessionKey(lat, lon))
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > CITIZEN_SESSION_TTL_MS) {
    citizenSessions.delete(citizenSessionKey(lat, lon))
    return undefined
  }
  return entry.socketId
}

type RawCitizenBody = { fires?: unknown; lat?: unknown; lon?: unknown; socketId?: unknown }

export function parseCitizenBody(body: RawCitizenBody): {
  firms: unknown[]; socketId: string; lat: number | undefined; lon: number | undefined; pm25: number | undefined
} | null {
  const socketId = typeof body.socketId === 'string' && body.socketId.length > 0 ? body.socketId : null
  if (!socketId) return null
  const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : null
  if (!rawFires) return null
  const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
  const lon = typeof body.lon === 'number' && isFinite(body.lon) ? body.lon : undefined
  const pm25Values = rawFires.map(f => f.pm25).filter((v): v is number => typeof v === 'number')
  const pm25 = pm25Values.length > 0 ? Math.max(...pm25Values) : undefined
  return { firms: rawFires, socketId, lat, lon, pm25 }
}

// Max 10 analysis requests per IP every 15 minutes
const triggerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
})

// Grid endpoints hit Overpass + Mistral — more generous than triggerLimiter
// but still capped to protect the upstreams.
const gridLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
})

export function registerRoutes(app: Express, io: Server, polling: PollingController): void {
  // Auth, geo, history
  app.use('/api/auth', authRouter)
  app.use('/api/geo', geoRouter)
  app.use('/api/history', historyRouter)

  // GET /api/last — last known SentinelUpdate (page memory: hydrate on load
  // without waiting for the next Make.com trigger)
  app.get('/api/last', (_req, res) => {
    const update = getLastUpdate()
    res.json({ ok: true, update })
  })

  // GET /api/status — system status for monitoring
  app.get('/api/status', (_req, res) => {
    res.json({
      lock: getLockStatus(),
      polling: polling.getState(),
    })
  })

  // GET /api/risk-grid — Fire Risk Grid, lazy-loaded by the dashboard toggle.
  // Weather + live fires come from the last analysis already in memory.
  app.get('/api/risk-grid', gridLimiter, async (_req, res) => {
    const last = getLastUpdate()
    const weather = last?.weather ?? { speed: 0, deg: 0, humidity: 0 }
    const firms = last?.fires ?? []
    try {
      const grid = await fetchRiskGrid(weather, firms)
      res.json({ ok: true, grid })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(502).json({ ok: false, error: message })
    }
  })

  // POST /api/cell-detail — per-region infrastructure + AI detail.
  app.post('/api/cell-detail', gridLimiter, async (req, res) => {
    const body = req.body as {
      region_id?: unknown
      nombre?: unknown
      score?: unknown
      category?: unknown
      factors?: unknown
    }
    if (typeof body.region_id !== 'number') {
      res.status(400).json({ ok: false, error: 'Missing region_id' })
      return
    }
    try {
      const detail = await fetchCellDetail({
        region_id: body.region_id,
        nombre: typeof body.nombre === 'string' ? body.nombre : '',
        score: typeof body.score === 'number' ? body.score : 0,
        category: (body.category as RiskCategory) ?? 'bajo',
        factors: (body.factors as RiskFactors) ?? { fwi: 0, historial: 0, terreno: 0 },
      })
      res.json({ ok: true, detail })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(502).json({ ok: false, error: message })
    }
  })

  // POST /api/trigger — manual single analysis run (rate limited)
  // Accepts optional `firms` (FireData[]) or `firmsCSV` (raw NASA CSV string)
  // Data is broadcast to all socket subscribers; HTTP caller receives confirmation only
  app.post('/api/trigger', triggerLimiter, async (req, res) => {
    if (isLocked()) {
      res.status(429).json({ ok: false, error: 'Analysis in progress — try again shortly' })
      return
    }
    const body = req.body as { lat?: number; lon?: number; firms?: unknown; firmsCSV?: string }
    const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
    const lon = typeof body.lon === 'number' && isFinite(body.lon) ? body.lon : undefined
    const firms = Array.isArray(body.firms)
      ? body.firms
      : typeof body.firmsCSV === 'string'
        ? parseFirmsCSV(body.firmsCSV)
        : undefined
    try {
      await executeAndBroadcast(io, lat, lon, firms)
      res.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ ok: false, error: message })
    }
  })

  // POST /api/fires/filter — recibe CSV de NASA. Deduplica, guarda la lista
  // completa bajo un runId, y devuelve solo el top ENRICH_LIMIT por FRP.
  app.post('/api/fires/filter', (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : ''
    const all = csv ? parseFirmsCSV(csv) : []

    const deduped = dedupeFires(all)
    const runId = storeRun(deduped)

    res.json({
      runId,
      fires: deduped.slice(0, ENRICH_LIMIT),
      total: all.length,
      dangerous: deduped.length,
    })
  })

  // POST /api/trigger/full — recibe fires[] de Make.com (rate limited)
  // Cada fire trae: { lat, lon, frp, brightness, speed, deg, humidity, date, pm25 }
  app.post('/api/trigger/full', triggerLimiter, async (req, res) => {
    const body = req.body as { fires?: unknown[]; runId?: unknown }
    const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : []

    const enriched = mapRawFiresToFireData(rawFires)
    const runId = typeof body.runId === 'string' ? body.runId : undefined
    const full = runId ? (getRun(runId) ?? []) : []
    const firms = mergeEnriched(full, enriched)

    const first = rawFires[0]
    const lat = typeof first?.lat === 'number' ? first.lat : undefined
    const lon = typeof first?.lon === 'number' ? first.lon : undefined
    // Sin weather global: cada foco trae sus propios datos de clima por lat/lon.
    // El orchestrator usará EMPTY_WEATHER como fallback (speed:0, deg:0, humidity:0).

    // pm25 más alto entre todos los focos — el peor aire es el más relevante para riesgo
    // Make.com manda null cuando OpenAQ no tiene estación cerca → el filtro lo descarta
    const pm25Values = rawFires
      .map(f => f.pm25)
      .filter((v): v is number => typeof v === 'number')
    const pm25 = pm25Values.length > 0 ? Math.max(...pm25Values) : undefined

    // Respond immediately. The full pipeline (Render cold start + 5 LLM agents)
    // exceeds Make.com's 40s HTTP timeout; results are broadcast over Socket.io,
    // not via this HTTP response, so Make.com only needs the ACK.
    res.status(202).json({ ok: true, accepted: true, fires: firms.length })

    executeAndBroadcast(io, lat, lon, firms, undefined, pm25).catch((err) => {
      console.error('[trigger/full] background analysis error:', err instanceof Error ? err.message : err)
    })
  })

  // POST /api/trigger/citizen-init — called by the frontend to kick off the citizen flow.
  // Accepts { lat, lon, socketId? } and fires the Make.com citizen webhook.
  // Uses the same webhook + bbox logic as the trigger-citizen socket handler.
  app.post('/api/trigger/citizen-init', triggerLimiter, (req, res) => {
    if (isLocked()) {
      res.status(429).json({ ok: false, error: 'Analysis in progress — try again shortly' })
      return
    }
    const body = req.body as { lat?: unknown; lon?: unknown; socketId?: unknown }
    const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
    const lon = typeof body.lon === 'number' && isFinite(body.lon) ? body.lon : undefined
    const socketId = typeof body.socketId === 'string' && body.socketId.length > 0 ? body.socketId : undefined

    if (lat === undefined || lon === undefined) {
      res.status(400).json({ ok: false, error: 'lat and lon required' })
      return
    }

    // Store socketId server-side keyed by lat+lon. Make.com echoes back {{1.lat}} and {{1.lon}}
    // verbatim, so we can recover the socketId in /api/trigger/citizen without passing it through
    // Make.com's entire scenario (where it would arrive empty if the socket wasn't connected yet).
    if (socketId) storeCitizenSession(lat, lon, socketId)

    const citizenWebhookUrl = process.env.MAKE_CITIZEN_WEBHOOK_URL
    if (citizenWebhookUrl) {
      const webhookHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      const secret = process.env.MAKE_CITIZEN_WEBHOOK_SECRET
      if (secret) webhookHeaders['x-make-apikey'] = secret
      fetch(citizenWebhookUrl, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          lat, lon,
          west:  Math.round((lon - 0.018) * 10000) / 10000,
          south: Math.round((lat - 0.018) * 10000) / 10000,
          east:  Math.round((lon + 0.018) * 10000) / 10000,
          north: Math.round((lat + 0.018) * 10000) / 10000,
        }),
      }).catch((err) => console.error('[citizen-init] webhook error:', err instanceof Error ? err.message : err))
    } else {
      // Without Make.com we have no local fires — the citizen flow needs fresh NASA data.
      // Log and no-op; the frontend /api/citizen-routes endpoint handles stale-fire filtering.
      console.warn('[citizen-init] MAKE_CITIZEN_WEBHOOK_URL not set — citizen analysis unavailable')
    }

    res.status(202).json({ ok: true, accepted: true })
  })

  // POST /api/citizen-routes — calls agent-routes/analyze/citizen with user GPS + last fires.
  // Returns 202 immediately and emits `citizen-routes` to the requesting socket.
  app.post('/api/citizen-routes', triggerLimiter, async (req, res) => {
    const body = req.body as { userLat?: unknown; userLon?: unknown; socketId?: unknown }
    const userLat = typeof body.userLat === 'number' && isFinite(body.userLat) ? body.userLat : undefined
    const userLon = typeof body.userLon === 'number' && isFinite(body.userLon) ? body.userLon : undefined
    const socketId = typeof body.socketId === 'string' && body.socketId.length > 0 ? body.socketId : undefined

    if (userLat === undefined || userLon === undefined) {
      res.status(400).json({ ok: false, error: 'userLat and userLon required' })
      return
    }

    res.status(202).json({ ok: true, accepted: true })

    const agentRoutesUrl = process.env.AGENT_ROUTES_URL
    if (!agentRoutesUrl) {
      console.warn('[citizen-routes] AGENT_ROUTES_URL not set')
      return
    }

    const last = getLastUpdate()
    const allFires = last?.fires ?? []
    const weather = last?.weather ?? { speed: 0, deg: 0 }

    // Exclude fires from unrelated regions — only keep fires within 300 km of the user.
    // The last analysis may cover a different area (e.g. southern Chile) if Make.com's
    // citizen webhook hasn't responded yet, which would produce nonsensical distances.
    const MAX_FIRE_RADIUS_KM = 2
    const fires = allFires.filter((f) => {
      const dLat = (f.lat - userLat) * Math.PI / 180
      const dLon = (f.lon - userLon) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(userLat * Math.PI / 180) * Math.cos(f.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= MAX_FIRE_RADIUS_KM
    })

    if (fires.length === 0) {
      console.warn(`[citizen-routes] no fires within ${MAX_FIRE_RADIUS_KM} km of user (${allFires.length} total in last update) — Make.com webhook likely still in flight`)
      return
    }

    try {
      const response = await fetch(`${agentRoutesUrl}/analyze/citizen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLat,
          userLon,
          fires,
          weather: {
            wind_speed_kmh: Math.round((weather.speed ?? 0) * 3.6),
            wind_dir_deg: weather.deg ?? 0,
          },
        }),
      })
      const data = await response.json() as { success: boolean; data: unknown }
      if (data.success) {
        const emitter = socketId ? io.to(socketId) : io
        emitter.emit('citizen-routes', data.data)
      }
    } catch (err) {
      console.error('[citizen-routes] agent-routes call failed:', err instanceof Error ? err.message : err)
    }
  })

  // POST /api/trigger/citizen — Make.com citizen scenario callback (rate limited)
  // Receives { fires, socketId, lat, lon } — fires are already local to the user's 2 km bbox.
  // Does NOT run executeAndBroadcast (that would overwrite the global last-update and clear
  // all hotspots for every connected client). Only computes escape routes and emits
  // citizen-routes to the requesting socket.
  app.post('/api/trigger/citizen', triggerLimiter, async (req, res) => {
    const body = req.body as {
      runId?: unknown
      fires?: unknown
      socketId?: unknown
      lat?: unknown
      lon?: unknown
      weather?: unknown
      pm25?: unknown
    }

    const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
    const lon = typeof body.lon === 'number' && isFinite(body.lon) ? body.lon : undefined

    // Recover socketId from the server-side session store (keyed by lat+lon) as primary source.
    // Make.com echoes back the original lat/lon via {{1.lat}}/{{1.lon}}, so this lookup is reliable.
    // Fall back to the body field in case it somehow arrives populated.
    const socketId = (lat !== undefined && lon !== undefined ? getCitizenSocketId(lat, lon) : undefined)
      ?? (typeof body.socketId === 'string' && body.socketId.length > 0 ? body.socketId : undefined)

    const runId = typeof body.runId === 'string' ? body.runId : undefined
    const cachedFires = runId ? (getRun(runId) ?? []) : []
    const rawFires = cachedFires.length > 0
      ? cachedFires
      : Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : []

    const enriched = mapRawFiresToFireData(rawFires as Record<string, unknown>[])

    res.status(202).json({ ok: true, accepted: true, fires: enriched.length })

    if (!lat || !lon || enriched.length === 0) {
      // No fires within the 2 km bbox — user is not in immediate danger, nothing to route
      return
    }

    const agentRoutesUrlCitizen = process.env.AGENT_ROUTES_URL
    if (!agentRoutesUrlCitizen) return

    // Use per-fire weather from Make.com; fall back to last known global weather
    const firstFireWeather = enriched[0]?.weather
    const fallbackWeather = getLastUpdate()?.weather ?? { speed: 0, deg: 0 }
    const windSpeedMs = firstFireWeather?.speed ?? fallbackWeather.speed ?? 0
    const windDirDeg = firstFireWeather?.deg ?? fallbackWeather.deg ?? 0

    ;(async () => {
      try {
        const response = await fetch(`${agentRoutesUrlCitizen}/analyze/citizen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userLat: lat,
            userLon: lon,
            fires: enriched,
            weather: {
              wind_speed_kmh: Math.round(windSpeedMs * 3.6),
              wind_dir_deg: windDirDeg,
            },
          }),
        })
        const data = await response.json() as { success: boolean; data: unknown }
        if (data.success) {
          const emitter = socketId ? io.to(socketId) : io
          emitter.emit('citizen-routes', data.data)
        }
      } catch (err) {
        console.error('[trigger/citizen] citizen-routes call failed:', err instanceof Error ? err.message : err)
      }
    })().catch((err) => {
      console.error('[trigger/citizen] background error:', err instanceof Error ? err.message : err)
    })
  })

  // POST /api/trigger/csv — recibe CSV crudo de NASA FIRMS (text/plain) (rate limited)
  // Header opcional X-Weather-Data: JSON string con WeatherData
  app.post('/api/trigger/csv', triggerLimiter, async (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : ''
    const firms = csv ? parseFirmsCSV(csv) : undefined
    const weatherHeader = req.headers['x-weather-data']
    let weather: unknown
    if (typeof weatherHeader === 'string') {
      try { weather = JSON.parse(weatherHeader) } catch { /* ignorar si no es JSON válido */ }
    }
    try {
      await executeAndBroadcast(io, undefined, undefined, firms, weather)
      res.json({ ok: true, parsed: firms?.length ?? 0 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ ok: false, error: message })
    }
  })

  // POST /api/polling/start — start polling at given interval
  // Minimum 10 seconds to avoid rate-limiting NASA FIRMS, OpenWeather, and OpenAQ
  app.post('/api/polling/start', (req, res) => {
    const { intervalMs } = req.body as { intervalMs: number }
    if (!intervalMs || intervalMs < 10000) {
      res.status(400).json({ ok: false, error: 'intervalMs must be >= 10000' })
      return
    }
    polling.start(intervalMs)
    res.json({ ok: true, state: polling.getState() })
  })

  // POST /api/polling/stop
  app.post('/api/polling/stop', (_req, res) => {
    polling.stop()
    res.json({ ok: true, state: polling.getState() })
  })

  // GET /api/polling/status
  app.get('/api/polling/status', (_req, res) => {
    res.json(polling.getState())
  })

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'backend', ts: new Date().toISOString() })
  })
}
