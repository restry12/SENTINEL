import type { Express } from 'express'
import type { Server } from 'socket.io'
import type { PollingController } from '../controllers/polling'
import { executeAndBroadcast } from '../socket/handlers'
import { parseFirmsCSV } from '../utils/parseFirmsCSV'

export function registerRoutes(app: Express, io: Server, polling: PollingController): void {
  // POST /api/trigger — manual single analysis run
  // Accepts optional `firms` (FireData[]) or `firmsCSV` (raw NASA CSV string)
  // Data is broadcast to all socket subscribers; HTTP caller receives confirmation only
  app.post('/api/trigger', async (req, res) => {
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
