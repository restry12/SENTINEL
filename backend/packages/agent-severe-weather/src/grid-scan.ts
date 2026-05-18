import { fetchOpenMeteoForecast, extractVariablesAtIndex, findTimeIndices } from './open-meteo'
import { calculateSevereStormPotential, calcPressureDrop3h } from './calculate-sspi'
import type { RiskLevel } from './calculate-sspi'

export interface GridPoint {
  lat: number
  lon: number
  score: number
  risk_level: RiskLevel
  confidence: number
  wind_gusts_10m: number | null
  weather_code: number | null
}

export interface GridScanResult {
  timestamp: string
  resolution_degrees: number
  refresh_interval_ms: number
  next_refresh: string
  points: GridPoint[]
  metadata: {
    total_points: number
    high_risk_count: number
    critical_risk_count: number
    source: string
    scan_duration_ms: number
    cached: boolean
    scanned_points: number
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const GRID_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

let gridCache: { result: GridScanResult; fetchedAt: number } | null = null
let isScanning = false

export function getCachedGrid(): GridScanResult | null {
  if (!gridCache) return null
  if (Date.now() - gridCache.fetchedAt > GRID_CACHE_TTL_MS) {
    gridCache = null
    return null
  }
  return { ...gridCache.result, metadata: { ...gridCache.result.metadata, cached: true } }
}

export function setCachedGrid(result: GridScanResult): void {
  gridCache = { result, fetchedAt: Date.now() }
}

export function isScanInProgress(): boolean {
  return isScanning
}

// ─── Deterministic jitter ───────────────────────────────────────────────────
// Simple hash-based pseudo-random so the same base coord always gets the same
// offset — points stay consistent between scans but break the grid pattern.

function hashJitter(lat: number, lon: number, seed: number): number {
  const x = Math.sin(lat * 127.1 + lon * 311.7 + seed) * 43758.5453
  return x - Math.floor(x)             // 0..1
}

function jitter(lat: number, lon: number, maxOffset: number): { lat: number; lon: number } {
  const jLat = (hashJitter(lat, lon, 1) - 0.5) * 2 * maxOffset
  const jLon = (hashJitter(lat, lon, 2) - 0.5) * 2 * maxOffset
  return {
    lat: parseFloat((lat + jLat).toFixed(2)),
    lon: parseFloat((lon + jLon).toFixed(2)),
  }
}

// ─── Grid definition ────────────────────────────────────────────────────────

/**
 * Default grid covering major land masses worldwide.
 * Points are jittered so they don't form visible grid lines on the map.
 */
export function getDefaultGlobalGrid(): Array<{ lat: number; lon: number }> {
  const raw: Array<{ lat: number; lon: number }> = []

  const regions = [
    // North America (USA + southern Canada)
    { latMin: 25, latMax: 50, lonMin: -125, lonMax: -65, step: 6 },
    // Mexico + Central America
    { latMin: 14, latMax: 24, lonMin: -105, lonMax: -82, step: 6 },
    // Caribbean islands
    { latMin: 10, latMax: 22, lonMin: -82, lonMax: -62, step: 7 },
    // Northern South America
    { latMin: -5, latMax: 12, lonMin: -80, lonMax: -50, step: 7 },
    // Brazil
    { latMin: -30, latMax: -5, lonMin: -72, lonMax: -38, step: 7 },
    // Southern South America
    { latMin: -42, latMax: -15, lonMin: -72, lonMax: -52, step: 7 },
    // Western Europe
    { latMin: 36, latMax: 62, lonMin: -10, lonMax: 20, step: 6 },
    // Eastern Europe
    { latMin: 36, latMax: 62, lonMin: 20, lonMax: 42, step: 6 },
    // West Africa
    { latMin: 4, latMax: 20, lonMin: -18, lonMax: 16, step: 8 },
    // East Africa + Horn
    { latMin: -12, latMax: 15, lonMin: 25, lonMax: 50, step: 8 },
    // Southern Africa
    { latMin: -35, latMax: -5, lonMin: 15, lonMax: 42, step: 8 },
    // Middle East
    { latMin: 20, latMax: 40, lonMin: 35, lonMax: 60, step: 7 },
    // South Asia
    { latMin: 8, latMax: 35, lonMin: 68, lonMax: 92, step: 7 },
    // Southeast Asia (mainland)
    { latMin: 10, latMax: 22, lonMin: 95, lonMax: 110, step: 6 },
    // Southeast Asia (islands)
    { latMin: -8, latMax: 18, lonMin: 110, lonMax: 128, step: 7 },
    // East Asia
    { latMin: 22, latMax: 50, lonMin: 100, lonMax: 145, step: 6 },
    // Russia / Central Asia
    { latMin: 45, latMax: 62, lonMin: 42, lonMax: 140, step: 10 },
    // Australia
    { latMin: -38, latMax: -12, lonMin: 114, lonMax: 152, step: 7 },
    // New Zealand
    { latMin: -47, latMax: -34, lonMin: 166, lonMax: 178, step: 6 },
  ]

  for (const r of regions) {
    for (let lat = r.latMin; lat <= r.latMax; lat += r.step) {
      for (let lon = r.lonMin; lon <= r.lonMax; lon += r.step) {
        raw.push({ lat, lon })
      }
    }
  }

  // Apply jitter — ±2° offset breaks the grid pattern visually
  return raw.map(p => jitter(p.lat, p.lon, 2.0))
}

/**
 * Generate a custom grid from a bounding box with given resolution.
 */
export function generateBboxGrid(
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  step: number
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = []
  for (let lat = latMin; lat <= latMax; lat += step) {
    for (let lon = lonMin; lon <= lonMax; lon += step) {
      points.push(jitter(lat, lon, step * 0.25))
    }
  }
  return points
}

// ─── Single-point scan ──────────────────────────────────────────────────────

async function scanPoint(lat: number, lon: number): Promise<GridPoint | null> {
  try {
    const meteo = await fetchOpenMeteoForecast(lat, lon)
    const indices = findTimeIndices(meteo.hourly.time)
    const vars = extractVariablesAtIndex(meteo.hourly, indices.now)
    const pressureDrop = calcPressureDrop3h(meteo.hourly.surface_pressure, indices.now)
    const sspi = calculateSevereStormPotential(vars, pressureDrop)

    return {
      lat,
      lon,
      score: sspi.score,
      risk_level: sspi.risk_level,
      confidence: sspi.confidence,
      wind_gusts_10m: vars.wind_gusts_10m ?? null,
      weather_code: vars.weather_code ?? null,
    }
  } catch (err) {
    console.warn(`[grid-scan] Failed for point ${lat},${lon}: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

// ─── Minimum score to include in results ────────────────────────────────────
// Only points with real weather activity are returned, filtering out
// clear-sky / calm-wind areas so the map shows meaningful data.
const MIN_SCORE_THRESHOLD = 12

// ─── Grid scanning ──────────────────────────────────────────────────────────

export async function scanGrid(
  points: Array<{ lat: number; lon: number }>,
  concurrency: number = 3
): Promise<GridScanResult> {
  isScanning = true
  const start = Date.now()
  const results: GridPoint[] = []
  let scannedCount = 0

  // Process in small batches — Open-Meteo free tier has strict concurrency limits
  for (let i = 0; i < points.length; i += concurrency) {
    const batch = points.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(p => scanPoint(p.lat, p.lon))
    )

    for (const r of batchResults) {
      scannedCount++
      if (r.status === 'fulfilled' && r.value != null) {
        // Only include points with real weather activity
        if (r.value.score >= MIN_SCORE_THRESHOLD) {
          results.push(r.value)
        }
      }
    }

    // 2000ms between batches to respect Open-Meteo rate limits
    if (i + concurrency < points.length) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  const duration = Date.now() - start
  const now = new Date()
  const nextRefresh = new Date(now.getTime() + GRID_CACHE_TTL_MS)

  isScanning = false

  return {
    timestamp: now.toISOString(),
    resolution_degrees: 5,
    refresh_interval_ms: GRID_CACHE_TTL_MS,
    next_refresh: nextRefresh.toISOString(),
    points: results,
    metadata: {
      total_points: results.length,
      high_risk_count: results.filter(p => p.risk_level === 'HIGH').length,
      critical_risk_count: results.filter(p => p.risk_level === 'CRITICAL').length,
      source: 'Open-Meteo',
      scan_duration_ms: duration,
      cached: false,
      scanned_points: scannedCount,
    },
  }
}

// ─── Background pre-scan on startup ─────────────────────────────────────────

let refreshInterval: ReturnType<typeof setInterval> | null = null

export async function startBackgroundScanning(): Promise<void> {
  // Initial scan
  console.log('[grid-scan] Starting background grid scan...')
  try {
    const points = getDefaultGlobalGrid()
    const result = await scanGrid(points)
    setCachedGrid(result)
    console.log(`[grid-scan] Initial scan complete: ${result.metadata.total_points} active points (${result.metadata.scanned_points} scanned) in ${result.metadata.scan_duration_ms}ms`)
  } catch (err) {
    console.error('[grid-scan] Initial scan failed:', err)
  }

  // Schedule hourly refresh
  if (refreshInterval) clearInterval(refreshInterval)
  refreshInterval = setInterval(async () => {
    console.log('[grid-scan] Hourly refresh started...')
    try {
      const points = getDefaultGlobalGrid()
      const result = await scanGrid(points)
      setCachedGrid(result)
      console.log(`[grid-scan] Refresh complete: ${result.metadata.total_points} active points in ${result.metadata.scan_duration_ms}ms`)
    } catch (err) {
      console.error('[grid-scan] Refresh failed:', err)
    }
  }, GRID_CACHE_TTL_MS)
}
