import 'dotenv/config'
import express from 'express'
import type { AgentResponse, SevereWeatherResponse } from '@sentinel/types'
import { buildSevereWeatherResponse } from './analyze'
import { scanGrid, getDefaultGlobalGrid, generateBboxGrid, getCachedGrid, setCachedGrid, startBackgroundScanning, isScanInProgress } from './grid-scan'

const app = express()
app.use(express.json({ limit: '2mb' }))

// ─── GET /api/severe-weather — Primary endpoint for frontend ─────────────────

app.get('/api/severe-weather', async (req, res) => {
  const lat = parseFloat(req.query.lat as string)
  const lon = parseFloat(req.query.lon as string)
  const mode = (req.query.mode as string) === 'demo' ? 'demo' : 'live'

  // Validate coordinates
  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({
      success: false,
      error: 'Missing or invalid lat/lon query parameters. Usage: ?lat=-33.45&lon=-70.66',
    })
    return
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({
      success: false,
      error: 'lat must be between -90 and 90, lon must be between -180 and 180.',
    })
    return
  }

  try {
    const data = await buildSevereWeatherResponse(lat, lon, mode)
    res.json(data)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[agent-severe-weather] GET /api/severe-weather error:`, error)
    res.status(502).json({
      success: false,
      error: `Severe weather analysis failed: ${error}`,
    })
  }
})

// ─── POST /analyze — Agent contract compatibility ────────────────────────────

app.post('/analyze', async (req, res) => {
  const body = req.body as { lat?: number; lon?: number; mode?: string }
  const lat = body.lat
  const lon = body.lon
  const mode = body.mode === 'demo' ? 'demo' : 'live'

  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    res.status(400).json({
      success: false,
      data: null,
      error: 'Missing or invalid lat/lon in request body. Send { "lat": number, "lon": number }',
    } satisfies AgentResponse<SevereWeatherResponse>)
    return
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({
      success: false,
      data: null,
      error: 'lat must be between -90 and 90, lon must be between -180 and 180.',
    } satisfies AgentResponse<SevereWeatherResponse>)
    return
  }

  try {
    const data = await buildSevereWeatherResponse(lat, lon, mode as 'live' | 'demo')
    res.json({ success: true, data } satisfies AgentResponse<SevereWeatherResponse>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[agent-severe-weather] POST /analyze error:`, error)
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<SevereWeatherResponse>)
  }
})

// ─── GET /api/severe-weather/grid — World map grid scan ──────────────────────

app.get('/api/severe-weather/grid', async (req, res) => {
  const latMin = parseFloat(req.query.lat_min as string)
  const latMax = parseFloat(req.query.lat_max as string)
  const lonMin = parseFloat(req.query.lon_min as string)
  const lonMax = parseFloat(req.query.lon_max as string)
  const step = parseFloat(req.query.step as string) || 5

  let points: Array<{ lat: number; lon: number }>
  let useGlobalCache = false

  // If bounding box provided, generate custom grid
  if (!isNaN(latMin) && !isNaN(latMax) && !isNaN(lonMin) && !isNaN(lonMax)) {
    // Cap step to avoid generating too many points
    const effectiveStep = Math.max(step, 2)
    points = generateBboxGrid(latMin, latMax, lonMin, lonMax, effectiveStep)

    // Safety limit: max 200 points per request
    if (points.length > 200) {
      res.status(400).json({
        success: false,
        error: `Grid too large (${points.length} points). Increase step or reduce bounding box. Max 200 points.`,
      })
      return
    }
  } else {
    // Default: return cached data (pre-scanned at startup)
    useGlobalCache = true

    const cached = getCachedGrid()
    if (cached) {
      console.log(`[agent-severe-weather] Returning cached grid (${cached.metadata.total_points} active points)`)
      res.json(cached)
      return
    }

    // No cache yet — scan is either in progress or hasn't started
    if (isScanInProgress()) {
      res.status(202).json({
        success: true,
        scanning: true,
        message: 'Global grid scan in progress. Try again in a moment.',
        points: [],
        metadata: { total_points: 0, high_risk_count: 0, critical_risk_count: 0, source: 'Open-Meteo', scan_duration_ms: 0, cached: false, scanned_points: 0 },
        timestamp: new Date().toISOString(),
        refresh_interval_ms: 10000,  // retry in 10s
        next_refresh: new Date(Date.now() + 10000).toISOString(),
        resolution_degrees: 5,
      })
      return
    }

    points = getDefaultGlobalGrid()
  }

  try {
    console.log(`[agent-severe-weather] Grid scan: ${points.length} points (fresh fetch)`)
    const result = await scanGrid(points)

    if (useGlobalCache) {
      setCachedGrid(result)
    }

    res.json(result)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[agent-severe-weather] Grid scan error:`, error)
    res.status(502).json({ success: false, error: `Grid scan failed: ${error}` })
  }
})

// ─── POST /api/severe-weather/batch — Multiple specific points ───────────────

app.post('/api/severe-weather/batch', async (req, res) => {
  const body = req.body as { points?: Array<{ lat: number; lon: number }> }
  const points = body.points

  if (!Array.isArray(points) || points.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Send { "points": [{ "lat": number, "lon": number }, ...] }',
    })
    return
  }

  if (points.length > 50) {
    res.status(400).json({
      success: false,
      error: `Too many points (${points.length}). Max 50 per request.`,
    })
    return
  }

  // Validate all points
  for (const p of points) {
    if (p.lat == null || p.lon == null || isNaN(p.lat) || isNaN(p.lon)) {
      res.status(400).json({ success: false, error: 'All points must have valid lat/lon.' })
      return
    }
    if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) {
      res.status(400).json({ success: false, error: `Invalid coordinates: lat=${p.lat}, lon=${p.lon}` })
      return
    }
  }

  try {
    const result = await scanGrid(points)
    res.json(result)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[agent-severe-weather] Batch scan error:`, error)
    res.status(502).json({ success: false, error: `Batch scan failed: ${error}` })
  }
})

// ─── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-severe-weather' })
})

// ─── Start server ────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3007
app.listen(PORT, () => {
  console.log(`[agent-severe-weather] running on port ${PORT}`)
  console.log(`[agent-severe-weather] Endpoints:`)
  console.log(`  GET  /api/severe-weather?lat=35.22&lon=-97.44&mode=live   (single point)`)
  console.log(`  GET  /api/severe-weather/grid                              (world map grid)`)
  console.log(`  GET  /api/severe-weather/grid?lat_min=25&lat_max=50&lon_min=-105&lon_max=-80&step=5  (custom bbox)`)
  console.log(`  POST /api/severe-weather/batch                             (custom points array)`)
  console.log(`  POST /analyze                                              (agent contract)`)

  // Start background grid scan immediately — data will be cached and
  // ready for the frontend when it requests /grid
  startBackgroundScanning()
})
