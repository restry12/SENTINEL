import type { Express } from 'express'
import type { Server } from 'socket.io'
import type { PollingController } from '../controllers/polling'
import { rateLimit } from 'express-rate-limit'
import { randomUUID } from 'crypto'
import { executeAndBroadcast } from '../socket/handlers'
import { parseFirmsCSV } from '../utils/parseFirmsCSV'
import { dedupeFires } from '../utils/dedupeFires'
import { mapRawFiresToFireData } from '../utils/mapRawFires'
import { storeRun, getRun } from '../services/run-cache'
import { mergeEnriched } from '../utils/mergeEnriched'
import { isLocked, getLockStatus } from '../services/analysis-lock'
import { getLastUpdate } from '../services/last-update'
import { fetchRiskGrid, fetchCellDetail } from '../services/prediction-proxy'
import type { RiskCategory, RiskFactors, FireData } from '@sentinel/types'
import authRouter from './auth'
import geoRouter from './geo'
import historyRouter from './history'

const ENRICH_LIMIT = 50

// Citizen session store: one UUID per user per citizen flow invocation.
// citizen-init creates the entry with socketId; citizen-filter adds the nearby fires.
// citizen callback reads both and cleans up. Concurrent users never collide.
const CITIZEN_SESSION_TTL_MS = 10 * 60 * 1000
const citizenSessions = new Map<string, { socketId?: string; fires?: FireData[]; createdAt: number }>()

function sweep(): void {
  const now = Date.now()
  for (const [k, v] of citizenSessions) {
    if (now - v.createdAt > CITIZEN_SESSION_TTL_MS) citizenSessions.delete(k)
  }
}

function setCitizenSession(sessionId: string, patch: { socketId?: string; fires?: FireData[] }): void {
  sweep()
  const existing = citizenSessions.get(sessionId)
  citizenSessions.set(sessionId, { ...existing, ...patch, createdAt: existing?.createdAt ?? Date.now() })
}

function popCitizenSession(sessionId: string): { socketId?: string; fires?: FireData[] } | undefined {
  const entry = citizenSessions.get(sessionId)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > CITIZEN_SESSION_TTL_MS) {
    citizenSessions.delete(sessionId)
    return undefined
  }
  citizenSessions.delete(sessionId)
  return entry
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

  // POST /api/fires/citizen-filter — filtra el CSV de NASA a ≤2 km del usuario y guarda los
  // focos en la sesión ciudadana. Make.com módulo 3:
  //   POST /api/fires/citizen-filter?lat={{1.lat}}&lon={{1.lon}}&sessionId={{1.citizenSessionId}}
  //   body: text/plain → {{2.data}}   (no necesita parsear la respuesta)
  app.post('/api/fires/citizen-filter', (req, res) => {
    const userLat = parseFloat(req.query.lat as string)
    const userLon = parseFloat(req.query.lon as string)
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined

    if (!isFinite(userLat) || !isFinite(userLon)) {
      res.status(400).json({ ok: false, error: 'lat and lon query params required' })
      return
    }

    const csv = typeof req.body === 'string' ? req.body : ''
    const all = csv ? parseFirmsCSV(csv) : []
    const deduped = dedupeFires(all)

    const nearby = deduped.filter(f => {
      const dLat = (f.lat - userLat) * Math.PI / 180
      const dLon = (f.lon - userLon) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(userLat * Math.PI / 180) * Math.cos(f.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 2
    })

    if (sessionId) setCitizenSession(sessionId, { fires: nearby })
    res.json({ ok: true, total: all.length, nearby: nearby.length })
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

    const citizenSessionId = randomUUID()
    setCitizenSession(citizenSessionId, { socketId: socketId ?? undefined })

    const citizenWebhookUrl = process.env.MAKE_CITIZEN_WEBHOOK_URL
    if (citizenWebhookUrl) {
      const webhookHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      const secret = process.env.MAKE_CITIZEN_WEBHOOK_SECRET
      if (secret) {
        webhookHeaders['x-make-apikey'] = secret
      }
      fetch(citizenWebhookUrl, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          lat, lon,
          citizenSessionId,
          west:  Math.round((lon - 0.018) * 10000) / 10000,
          south: Math.round((lat - 0.018) * 10000) / 10000,
          east:  Math.round((lon + 0.018) * 10000) / 10000,
          north: Math.round((lat + 0.018) * 10000) / 10000,
        }),
      }).catch((err) => console.error('[citizen-init] webhook error:', err instanceof Error ? err.message : err))
    }
 else {
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
      citizenSessionId?: unknown
      lat?: unknown
      lon?: unknown
      weather?: unknown
      pm25?: unknown
    }

    const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
    const lon = typeof body.lon === 'number' && isFinite(body.lon) ? body.lon : undefined

    const citizenSessionId = typeof body.citizenSessionId === 'string' ? body.citizenSessionId : undefined
    const session = citizenSessionId ? popCitizenSession(citizenSessionId) : undefined
    const socketId = session?.socketId
    const nearbyFires = session?.fires ?? []

    res.status(202).json({ ok: true, accepted: true, fires: nearbyFires.length })

    if (!lat || !lon || nearbyFires.length === 0) {
      return
    }

    const agentRoutesUrlCitizen = process.env.AGENT_ROUTES_URL
    if (!agentRoutesUrlCitizen) return

    const bodyWeather = body.weather as { speed?: number; deg?: number } | undefined
    const fallbackWeather = getLastUpdate()?.weather ?? { speed: 0, deg: 0 }
    const windSpeedMs = bodyWeather?.speed ?? fallbackWeather.speed ?? 0
    const windDirDeg = bodyWeather?.deg ?? fallbackWeather.deg ?? 0

    ;(async () => {
      try {
        const response = await fetch(`${agentRoutesUrlCitizen}/analyze/citizen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userLat: lat,
            userLon: lon,
            fires: nearbyFires as unknown[],
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
