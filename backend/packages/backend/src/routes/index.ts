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

  // POST /api/fires/filter — recibe CSV de NASA, devuelve focos peligrosos + centroide
  // Make.com usa el centroide para fetchear OpenWeather y luego llama /api/trigger/csv
  app.post('/api/fires/filter', (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : ''
    const all = csv ? parseFirmsCSV(csv) : []

    // Focos peligrosos: FRP > 50 MW, ordenados por intensidad
    const dangerous = all
      .filter(f => f.frp > 50)
      .sort((a, b) => b.frp - a.frp)

    if (dangerous.length === 0) {
      res.json({ fires: [], centroid: null, total: all.length, dangerous: 0 })
      return
    }

    const centroid = {
      lat: parseFloat((dangerous.reduce((s, f) => s + f.lat, 0) / dangerous.length).toFixed(4)),
      lon: parseFloat((dangerous.reduce((s, f) => s + f.lon, 0) / dangerous.length).toFixed(4)),
    }

    res.json({ fires: dangerous, centroid, total: all.length, dangerous: dangerous.length })
  })

  // POST /api/trigger/full — recibe fires[] de Make.com con clima embebido en cada foco
  // Cada fire trae: { lat, lon, frp, brightness, speed, deg, humidity }
  app.post('/api/trigger/full', async (req, res) => {
    const body = req.body as { fires?: unknown[] }
    const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : []

    const firms = rawFires.map(f => ({
      lat: f.lat, lon: f.lon, frp: f.frp, brightness: f.brightness, timestamp: f.date ?? f.timestamp,
    }))

    // Clima del primer foco (el más peligroso — vienen ordenados por FRP desc)
    const first = rawFires[0]
    const weather = first
      ? { speed: first.speed as number, deg: first.deg as number, humidity: first.humidity as number, temp: first.temp as number | undefined }
      : undefined

    const lat = typeof first?.lat === 'number' ? first.lat : undefined
    const lon = typeof first?.lon === 'number' ? first.lon : undefined

    try {
      await executeAndBroadcast(io, lat, lon, firms, weather)
      res.json({ ok: true, fires: firms.length })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ ok: false, error: message })
    }
  })

  // POST /api/trigger/csv — recibe CSV crudo de NASA FIRMS (text/plain)
  // Header opcional X-Weather-Data: JSON string con WeatherData
  app.post('/api/trigger/csv', async (req, res) => {
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
