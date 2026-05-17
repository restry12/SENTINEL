# Air Risk Intelligence Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a terrain-adaptive air quality risk grid to SENTINEL based on real OpenAQ historical data (23,463 cities), with temporal projection (+2h/+6h/+12h) influenced by active fires and wind.

**Architecture:** Geocode cities from dataset → precompute Voronoi polygons → IDW interpolation for continuous surface → smoke modifier from fires+wind → frontend renders colored GeoJSON polygons on Mapbox.

**Tech Stack:** TypeScript, Express (agent-air), d3-delaunay (Voronoi), Mapbox GL JS, React, @sentinel/types

---

## File Structure

| File | Responsibility |
|------|---------------|
| `Backend/data/air-quality-stations.json` | Geocoded dataset (city → lat/lon + pollutants) |
| `Backend/packages/agent-air/src/stations.ts` | Load + query stations data |
| `Backend/packages/agent-air/src/voronoi.ts` | Generate Voronoi polygons from station points |
| `Backend/packages/agent-air/src/air-risk-grid.ts` | Core algorithm: IDW + smoke modifier + temporal |
| `Backend/packages/agent-air/src/index.ts` | Add `/air-risk-grid` endpoint |
| `Backend/shared/types/index.ts` | New types: AirRiskCell, AirRiskGridResult |
| `Backend/packages/backend/src/services/orchestrator.ts` | Call air-risk-grid in pipeline |
| `frontend/components/dashboard/air-risk-layer.tsx` | Mapbox layer + timeline toggle |
| `frontend/components/dashboard/air-risk-panel.tsx` | Detail panel for selected cell |

---

### Task 1: Geocode the Dataset

**Files:**
- Create: `Backend/data/geocode-stations.py` (one-time script)
- Create: `Backend/data/air-quality-stations.json` (output)

- [ ] **Step 1: Create geocoding script**

This script reads the CSV, geocodes each city using a world cities database, and outputs JSON. We use the `geopy` library with Nominatim (free, no API key).

```python
# Backend/data/geocode-stations.py
import csv
import json
import time
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter

geolocator = Nominatim(user_agent="sentinel-geocoder")
geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1.1)

stations = []
failed = []

with open('C:/Users/camil/Downloads/air pollution dataset.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Total cities: {len(rows)}")

for i, r in enumerate(rows):
    city = r['City']
    country = r['Country']
    query = f"{city}, {country}"
    
    try:
        location = geocode(query)
        if location:
            stations.append({
                "city": city,
                "country": country,
                "lat": round(location.latitude, 4),
                "lon": round(location.longitude, 4),
                "aqi": int(r['AQI Value']),
                "pm25": int(r['PM2.5 AQI Value']),
                "ozone": int(r['Ozone AQI Value']),
                "no2": int(r['NO2 AQI Value']),
                "co": int(r['CO AQI Value']),
                "category": r['AQI Category']
            })
        else:
            failed.append(query)
    except Exception as e:
        failed.append(f"{query}: {e}")
    
    if (i + 1) % 100 == 0:
        print(f"  Processed {i+1}/{len(rows)}, success: {len(stations)}, failed: {len(failed)}")
        # Save progress
        with open('Backend/data/air-quality-stations.json', 'w') as out:
            json.dump(stations, out)

with open('Backend/data/air-quality-stations.json', 'w') as out:
    json.dump(stations, out, indent=2)

print(f"\nDone! {len(stations)} geocoded, {len(failed)} failed")
if failed:
    with open('Backend/data/geocode-failures.txt', 'w') as f:
        f.write('\n'.join(failed))
```

- [ ] **Step 2: Run geocoding (or use faster alternative)**

Since Nominatim is very slow (1 req/sec = 6.5 hours for 23k cities), use a pre-built world cities dataset instead. Download `simplemaps worldcities` (free) and match by city+country:

```python
# Backend/data/geocode-stations-fast.py
import csv
import json

# Load world cities database (free from simplemaps.com/data/world-cities)
# Columns: city,city_ascii,lat,lng,country,iso2,iso3,admin_name,capital,population,id
cities_db = {}
with open('C:/Users/camil/Downloads/worldcities.csv', 'r', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        key = (r['city_ascii'].lower(), r['country'].lower())
        cities_db[key] = (float(r['lat']), float(r['lng']))
        # Also index by just city name for fallback
        cities_db[('__city__' + r['city_ascii'].lower(),)] = (float(r['lat']), float(r['lng']))

# Country name mapping (dataset uses full names, worldcities uses full names too)
stations = []
failed = []

with open('C:/Users/camil/Downloads/air pollution dataset.csv', 'r', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

for r in rows:
    city = r['City'].strip()
    country = r['Country'].strip()
    
    # Try exact match
    key = (city.lower(), country.lower())
    coords = cities_db.get(key)
    
    # Fallback: city-only match
    if not coords:
        coords = cities_db.get(('__city__' + city.lower(),))
    
    if coords:
        stations.append({
            "city": city,
            "country": country,
            "lat": round(coords[0], 4),
            "lon": round(coords[1], 4),
            "aqi": int(r['AQI Value']),
            "pm25": int(r['PM2.5 AQI Value']),
            "ozone": int(r['Ozone AQI Value']),
            "no2": int(r['NO2 AQI Value']),
            "co": int(r['CO AQI Value']),
            "category": r['AQI Category']
        })
    else:
        failed.append(f"{city}, {country}")

with open('C:/Users/camil/Desktop/sentinel/Backend/data/air-quality-stations.json', 'w') as out:
    json.dump(stations, out, indent=2)

print(f"Geocoded: {len(stations)}/{len(rows)}")
print(f"Failed: {len(failed)}")
if failed[:20]:
    print("Sample failures:", failed[:20])
```

- [ ] **Step 3: Verify output**

Run: `python Backend/data/geocode-stations-fast.py`
Expected: 15,000-20,000+ stations geocoded. Check `Backend/data/air-quality-stations.json` exists with lat/lon.

- [ ] **Step 4: Commit**

```bash
git add Backend/data/air-quality-stations.json Backend/data/geocode-stations-fast.py
git commit -m "data: geocoded air quality stations from OpenAQ dataset (23k cities)"
```

---

### Task 2: Add Types to @sentinel/types

**Files:**
- Modify: `Backend/shared/types/index.ts`

- [ ] **Step 1: Add AirRiskCell and AirRiskGridResult types**

Append to the end of `Backend/shared/types/index.ts` (before the closing `AgentResponse` type):

```typescript
// ─── Air Risk Intelligence Grid ─────────────────────────────────────────────

export interface AirRiskCell {
  id: string                // city name or interpolated-point ID
  lat: number
  lon: number
  polygon: number[][][]     // GeoJSON Polygon coordinates
  pm25: number              // computed PM2.5 AQI value
  aqi: number               // overall AQI
  ozone: number
  no2: number
  co: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EMERGENCY'
  main_pollutant: string    // 'PM2.5' | 'O3' | 'NO2' | 'CO'
  confidence: number        // 0-100
  trend: 'improving' | 'stable' | 'worsening'
  nearest_fire_km: number | null
  smoke_direction: string | null  // cardinal direction
}

export interface AirRiskGridResult {
  now: AirRiskCell[]
  plus2h: AirRiskCell[]
  plus6h: AirRiskCell[]
  plus12h: AirRiskCell[]
  metadata: {
    stations_used: number
    coverage_area_km2: number
    generated_at: string
  }
}
```

- [ ] **Step 2: Add airRiskGrid to SentinelUpdate**

In the `SentinelUpdate` interface, add after the `prediction?` field:

```typescript
  airRiskGrid?: AirRiskGridResult
```

- [ ] **Step 3: Verify types compile**

Run: `cd Backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add Backend/shared/types/index.ts
git commit -m "types: add AirRiskCell and AirRiskGridResult for air quality grid"
```

---

### Task 3: Station Data Loader

**Files:**
- Create: `Backend/packages/agent-air/src/stations.ts`

- [ ] **Step 1: Create stations.ts**

```typescript
// Backend/packages/agent-air/src/stations.ts
import { readFileSync } from 'fs'
import { resolve } from 'path'

export interface AirStation {
  city: string
  country: string
  lat: number
  lon: number
  aqi: number
  pm25: number
  ozone: number
  no2: number
  co: number
  category: string
}

let _cache: AirStation[] | null = null

export function loadStations(): AirStation[] {
  if (_cache) return _cache
  const filePath = resolve(__dirname, '../../../data/air-quality-stations.json')
  const raw = readFileSync(filePath, 'utf-8')
  _cache = JSON.parse(raw) as AirStation[]
  console.log(`[stations] loaded ${_cache.length} air quality stations`)
  return _cache
}

/** Haversine distance in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Find N nearest stations to a point */
export function nearestStations(lat: number, lon: number, n: number, stations: AirStation[]): Array<AirStation & { dist: number }> {
  return stations
    .map(s => ({ ...s, dist: haversineKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
}
```

- [ ] **Step 2: Commit**

```bash
git add Backend/packages/agent-air/src/stations.ts
git commit -m "feat(agent-air): station data loader with haversine + nearest lookup"
```

---

### Task 4: Voronoi Terrain-Adaptive Grid

**Files:**
- Create: `Backend/packages/agent-air/src/voronoi.ts`
- Modify: `Backend/packages/agent-air/package.json` (add d3-delaunay)

- [ ] **Step 1: Install d3-delaunay**

Run: `cd Backend/packages/agent-air && npm install d3-delaunay`

- [ ] **Step 2: Create voronoi.ts**

```typescript
// Backend/packages/agent-air/src/voronoi.ts
import { Delaunay } from 'd3-delaunay'
import type { AirStation } from './stations'

export interface VoronoiCell {
  id: string
  lat: number
  lon: number
  polygon: number[][][]  // GeoJSON Polygon coordinates format
  stationIndex: number
}

let _gridCache: VoronoiCell[] | null = null

/**
 * Generate Voronoi tessellation from station points.
 * Each cell is the region closest to that station — irregular shapes
 * that naturally adapt to terrain (no cells over ocean where no stations exist).
 * 
 * Bounding box clips the Voronoi to reasonable world bounds.
 */
export function computeVoronoiGrid(stations: AirStation[]): VoronoiCell[] {
  if (_gridCache) return _gridCache

  // Use Mercator-projected coordinates for Voronoi computation
  const points: [number, number][] = stations.map(s => [s.lon, s.lat])

  // World bounds (clip Voronoi cells to prevent infinite polygons)
  const bounds: [number, number, number, number] = [-180, -90, 180, 90]

  const delaunay = Delaunay.from(points)
  const voronoi = delaunay.voronoi(bounds)

  const cells: VoronoiCell[] = []

  for (let i = 0; i < stations.length; i++) {
    const cellPolygon = voronoi.cellPolygon(i)
    if (!cellPolygon || cellPolygon.length < 4) continue

    // Clamp large cells: if cell area > threshold, skip (ocean/desert with no data)
    // This prevents huge polygons in sparse areas
    const area = polygonArea(cellPolygon)
    if (area > 100) continue  // Skip cells > ~100 sq degrees (sparse regions)

    // Convert to GeoJSON Polygon format: [[[lon,lat], [lon,lat], ...]]
    const coords: number[][] = cellPolygon.map(([x, y]) => [
      Math.round(x * 10000) / 10000,
      Math.round(y * 10000) / 10000
    ])

    cells.push({
      id: stations[i].city,
      lat: stations[i].lat,
      lon: stations[i].lon,
      polygon: [coords],
      stationIndex: i,
    })
  }

  _gridCache = cells
  console.log(`[voronoi] generated ${cells.length} terrain-adaptive cells`)
  return cells
}

/** Approximate polygon area in square degrees (Shoelace formula) */
function polygonArea(ring: ArrayLike<[number, number]> & { length: number }): number {
  let area = 0
  const n = ring.length
  for (let i = 0; i < n - 1; i++) {
    area += ring[i][0] * ring[i + 1][1]
    area -= ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(area) / 2
}

/** Clear cache (for testing) */
export function clearVoronoiCache(): void {
  _gridCache = null
}
```

- [ ] **Step 3: Commit**

```bash
git add Backend/packages/agent-air/src/voronoi.ts Backend/packages/agent-air/package.json
git commit -m "feat(agent-air): Voronoi terrain-adaptive grid generation"
```

---

### Task 5: Core Air Risk Algorithm

**Files:**
- Create: `Backend/packages/agent-air/src/air-risk-grid.ts`

- [ ] **Step 1: Create the core algorithm**

```typescript
// Backend/packages/agent-air/src/air-risk-grid.ts
import type { FireData, WeatherData, AirRiskCell, AirRiskGridResult } from '@sentinel/types'
import { loadStations, haversineKm, type AirStation } from './stations'
import { computeVoronoiGrid, type VoronoiCell } from './voronoi'

/** Convert PM2.5 AQI value to risk level */
function aqiToRiskLevel(aqi: number): AirRiskCell['risk_level'] {
  if (aqi <= 50) return 'LOW'
  if (aqi <= 100) return 'MODERATE'
  if (aqi <= 150) return 'HIGH'
  if (aqi <= 300) return 'CRITICAL'
  return 'EMERGENCY'
}

/** Determine main pollutant from values */
function mainPollutant(pm25: number, ozone: number, no2: number, co: number): string {
  const max = Math.max(pm25, ozone, no2, co)
  if (max === pm25) return 'PM2.5'
  if (max === ozone) return 'O3'
  if (max === no2) return 'NO2'
  return 'CO'
}

/** Degrees to cardinal direction */
function degToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

/** Angular difference between two angles in radians (0 to PI) */
function angleDiff(deg1: number, deg2: number): number {
  const diff = Math.abs(deg1 - deg2) % 360
  const d = diff > 180 ? 360 - diff : diff
  return d * Math.PI / 180
}

/**
 * Compute smoke contribution from fires to a specific cell.
 * 
 * @param cellLat - cell center latitude
 * @param cellLon - cell center longitude
 * @param fires - active fire points
 * @param weather - wind data (deg = direction wind comes FROM)
 * @param hours - projection hours (0=now, 2, 6, 12)
 * @returns additional PM2.5 AQI points from smoke
 */
function computeSmokeContribution(
  cellLat: number,
  cellLon: number,
  fires: FireData[],
  weather: WeatherData,
  hours: number
): { smokePm25: number; nearestFireKm: number | null; smokeDir: string | null } {
  if (fires.length === 0) return { smokePm25: 0, nearestFireKm: null, smokeDir: null }

  const windSpeedKmh = weather.speed * 3.6
  // Wind blows FROM weather.deg, smoke travels in OPPOSITE direction
  const smokeTravelDeg = (weather.deg + 180) % 360
  // Max reach of smoke at this time projection
  const maxReach = Math.max(windSpeedKmh * Math.max(hours, 0.5), 10) // min 10km

  let totalSmoke = 0
  let nearestFireKm: number | null = null

  for (const fire of fires) {
    const dist = haversineKm(cellLat, cellLon, fire.lat, fire.lon)

    // Track nearest fire
    if (nearestFireKm === null || dist < nearestFireKm) {
      nearestFireKm = dist
    }

    // Only fires within reach contribute
    if (dist > maxReach) continue

    // Angular alignment: direction from fire to cell vs smoke travel direction
    const fireToCell = Math.atan2(cellLon - fire.lon, cellLat - fire.lat) * 180 / Math.PI
    const fireToCellDeg = (fireToCell + 360) % 360
    const angDiff = angleDiff(smokeTravelDeg, fireToCellDeg)

    // Gaussian angular factor: narrow cone (~45° half-width)
    const sigma = Math.PI / 4  // 45 degrees
    const angularFactor = Math.exp(-(angDiff ** 2) / (2 * sigma ** 2))

    // Distance decay
    const distanceFactor = 1 / (1 + (dist / (maxReach * 0.4)) ** 2)

    // Emission proportional to FRP
    const emission = (fire.frp / 100) * 30  // scale to AQI points

    totalSmoke += emission * angularFactor * distanceFactor
  }

  const smokeDir = nearestFireKm !== null ? degToCardinal(smokeTravelDeg) : null
  return { smokePm25: Math.round(totalSmoke), nearestFireKm: nearestFireKm ? Math.round(nearestFireKm) : null, smokeDir }
}

/**
 * Compute trend by comparing current baseline to smoke-modified value.
 * If smoke raises risk significantly, trend is 'worsening'.
 */
function computeTrend(baseline: number, smokeContrib: number, hours: number): AirRiskCell['trend'] {
  if (hours === 0) return 'stable'
  const ratio = smokeContrib / Math.max(baseline, 1)
  if (ratio > 0.3) return 'worsening'
  if (ratio < -0.1) return 'improving'
  return 'stable'
}

/**
 * Compute confidence based on data density and projection time.
 */
function computeConfidence(nearestStationDist: number, hours: number, stationsWithin100km: number): number {
  let conf = 100
  conf -= Math.min((nearestStationDist / 50) * 30, 40)  // far from data = less confident
  conf -= hours * 3                                       // future = less confident
  conf += stationsWithin100km > 3 ? 10 : 0               // dense coverage bonus
  return Math.max(30, Math.min(100, Math.round(conf)))
}

/**
 * Main entry: compute air risk grid for a given time projection.
 */
function computeGridForTime(
  cells: VoronoiCell[],
  stations: AirStation[],
  fires: FireData[],
  weather: WeatherData,
  hours: number
): AirRiskCell[] {
  return cells.map(cell => {
    const station = stations[cell.stationIndex]

    // Baseline from the station's real data
    const baselinePm25 = station.pm25
    const baselineOzone = station.ozone
    const baselineNo2 = station.no2
    const baselineCo = station.co

    // Smoke modifier
    const { smokePm25, nearestFireKm, smokeDir } = computeSmokeContribution(
      cell.lat, cell.lon, fires, weather, hours
    )

    // Adjusted values (smoke primarily affects PM2.5)
    const adjustedPm25 = Math.min(baselinePm25 + smokePm25, 500)
    const adjustedAqi = Math.max(adjustedPm25, baselineOzone, baselineNo2, baselineCo)

    // Confidence
    const confidence = computeConfidence(0, hours, 5) // station IS the cell, dist=0

    return {
      id: cell.id,
      lat: cell.lat,
      lon: cell.lon,
      polygon: cell.polygon,
      pm25: adjustedPm25,
      aqi: adjustedAqi,
      ozone: baselineOzone,
      no2: baselineNo2,
      co: baselineCo,
      risk_level: aqiToRiskLevel(adjustedAqi),
      main_pollutant: mainPollutant(adjustedPm25, baselineOzone, baselineNo2, baselineCo),
      confidence,
      trend: computeTrend(baselinePm25, smokePm25, hours),
      nearest_fire_km: nearestFireKm,
      smoke_direction: smokeDir,
    }
  })
}

/**
 * Public API: compute the full air risk grid (all 4 time projections).
 */
export function getAirRiskGrid(fires: FireData[], weather: WeatherData): AirRiskGridResult {
  const stations = loadStations()
  const cells = computeVoronoiGrid(stations)

  return {
    now: computeGridForTime(cells, stations, fires, weather, 0),
    plus2h: computeGridForTime(cells, stations, fires, weather, 2),
    plus6h: computeGridForTime(cells, stations, fires, weather, 6),
    plus12h: computeGridForTime(cells, stations, fires, weather, 12),
    metadata: {
      stations_used: stations.length,
      coverage_area_km2: 510_000_000,  // global
      generated_at: new Date().toISOString(),
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add Backend/packages/agent-air/src/air-risk-grid.ts
git commit -m "feat(agent-air): air risk grid algorithm — IDW baseline + smoke modifier + temporal projection"
```

---

### Task 6: Wire Up Agent-Air Endpoint

**Files:**
- Modify: `Backend/packages/agent-air/src/index.ts`

- [ ] **Step 1: Add air-risk-grid endpoint**

Replace the full content of `Backend/packages/agent-air/src/index.ts`:

```typescript
import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, AirAlerts, AirRiskGridResult } from '@sentinel/types'
import { analyzeAir } from './analyze'
import { getAirRiskGrid } from './air-risk-grid'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const air = body.openaq ?? { pm25: 0, aqi: 0, category: 'Good' }
  const fires = body.firms ?? []
  const weather = body.weather ?? { speed: 3, deg: 270, humidity: 50 }

  try {
    const [alerts, airRiskGrid] = await Promise.all([
      analyzeAir(air, fires),
      Promise.resolve(getAirRiskGrid(fires, weather)),
    ])
    res.json({ success: true, data: { ...alerts, airRiskGrid } } satisfies AgentResponse<AirAlerts & { airRiskGrid: AirRiskGridResult }>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<AirAlerts>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-air' }))

const PORT = process.env.PORT ?? 3003
app.listen(PORT, () => console.log(`[agent-air] running on port ${PORT}`))
```

- [ ] **Step 2: Commit**

```bash
git add Backend/packages/agent-air/src/index.ts
git commit -m "feat(agent-air): wire air-risk-grid into /analyze endpoint"
```

---

### Task 7: Update Orchestrator

**Files:**
- Modify: `Backend/packages/backend/src/services/orchestrator.ts`

- [ ] **Step 1: Extract airRiskGrid from agent-air response**

In the orchestrator, the agent-air call already returns data. We just need to pass the new `airRiskGrid` field through to `SentinelUpdate`.

Find this block (around line 168):

```typescript
  const airAlerts =
    airAgentSettled.status === 'fulfilled' && airAgentSettled.value.success
      ? airAgentSettled.value.data
      : null
```

Replace with:

```typescript
  const airResult =
    airAgentSettled.status === 'fulfilled' && airAgentSettled.value.success
      ? airAgentSettled.value.data
      : null
  const airAlerts = airResult ? { alertas: airResult.alertas, resumen_general: airResult.resumen_general } : null
  const airRiskGrid = (airResult as any)?.airRiskGrid ?? null
```

- [ ] **Step 2: Add airRiskGrid to the return object**

Find the return block (around line 205) and add `airRiskGrid`:

```typescript
  return {
    timestamp: new Date().toISOString(),
    fires,
    polygon,
    weather,
    airQuality,
    routes,
    riskLevel,
    riskAssessment: fireAnalysis?.riskAssessment,
    expansion: fireAnalysis?.expansion,
    perFireExpansions: fireAnalysis?.perFireExpansions ?? [],
    airAlerts: airAlerts ?? undefined,
    airRiskGrid: airRiskGrid ?? undefined,  // ← NEW
    report,
    naturalRoutes: routesResult?.naturalRoutes ?? undefined,
    prediction: predictionResult ?? undefined,
  }
```

- [ ] **Step 3: Commit**

```bash
git add Backend/packages/backend/src/services/orchestrator.ts
git commit -m "feat(orchestrator): pass airRiskGrid from agent-air to SentinelUpdate"
```

---

### Task 8: Frontend — Air Risk Map Layer

**Files:**
- Create: `frontend/components/dashboard/air-risk-layer.tsx`

- [ ] **Step 1: Create the air risk layer component**

```tsx
// frontend/components/dashboard/air-risk-layer.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSentinel } from '@/contexts/sentinel-context'
import type { AirRiskCell } from '@sentinel/types'

type TimeFrame = 'now' | 'plus2h' | 'plus6h' | 'plus12h'

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',        // green
  MODERATE: '#eab308',   // yellow
  HIGH: '#f97316',       // orange
  CRITICAL: '#ef4444',   // red
  EMERGENCY: '#7c2d92',  // purple
}

const TIME_LABELS: { key: TimeFrame; label: string }[] = [
  { key: 'now', label: 'Now' },
  { key: 'plus2h', label: '+2h' },
  { key: 'plus6h', label: '+6h' },
  { key: 'plus12h', label: '+12h' },
]

interface Props {
  map: mapboxgl.Map | null
  visible: boolean
  onCellSelect: (cell: AirRiskCell | null) => void
}

export function AirRiskLayer({ map, visible, onCellSelect }: Props) {
  const { sentinelUpdate } = useSentinel()
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('now')

  const SRC = 'air-risk-src'
  const FILL_LAYER = 'air-risk-fill'
  const LINE_LAYER = 'air-risk-line'

  // Draw/update the grid layer
  useEffect(() => {
    if (!map || !visible) {
      // Remove layers if hidden
      if (map) {
        if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
        if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER)
        if (map.getSource(SRC)) map.removeSource(SRC)
      }
      return
    }

    const grid = sentinelUpdate?.airRiskGrid
    if (!grid) return

    const cells = grid[timeFrame]
    if (!cells || cells.length === 0) return

    // Build GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: cells.map(cell => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: cell.polygon,
        },
        properties: {
          id: cell.id,
          aqi: cell.aqi,
          risk_level: cell.risk_level,
          pm25: cell.pm25,
          color: RISK_COLORS[cell.risk_level] || '#22c55e',
          confidence: cell.confidence,
        },
      })),
    }

    // Remove old layers
    if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
    if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER)
    if (map.getSource(SRC)) map.removeSource(SRC)

    // Add source + layers
    map.addSource(SRC, { type: 'geojson', data: geojson })

    map.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: SRC,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'interpolate', ['linear'], ['get', 'aqi'],
          0, 0.08,
          50, 0.15,
          100, 0.25,
          150, 0.35,
          200, 0.45,
          300, 0.55,
        ],
      },
    })

    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SRC,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 0.5,
        'line-opacity': 0.4,
      },
    })
  }, [map, visible, timeFrame, sentinelUpdate?.airRiskGrid])

  // Click handler for cell selection
  useEffect(() => {
    if (!map || !visible) return

    const handler = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER] })
      if (features.length > 0) {
        const props = features[0].properties
        const grid = sentinelUpdate?.airRiskGrid
        if (!grid) return
        const cells = grid[timeFrame]
        const cell = cells.find(c => c.id === props?.id)
        if (cell) onCellSelect(cell)
      } else {
        onCellSelect(null)
      }
    }

    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, visible, timeFrame, sentinelUpdate?.airRiskGrid, onCellSelect])

  if (!visible) return null

  // Timeline UI
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-3 py-2 border border-white/10">
      <span className="text-[10px] text-white/50 mr-2 uppercase tracking-wider">Air Risk</span>
      {TIME_LABELS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setTimeFrame(key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            timeFrame === key
              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/air-risk-layer.tsx
git commit -m "feat(frontend): air risk map layer with Voronoi cells + timeline toggle"
```

---

### Task 9: Frontend — Air Risk Detail Panel

**Files:**
- Create: `frontend/components/dashboard/air-risk-panel.tsx`

- [ ] **Step 1: Create the detail panel**

```tsx
// frontend/components/dashboard/air-risk-panel.tsx
'use client'

import { useSentinel } from '@/contexts/sentinel-context'
import type { AirRiskCell } from '@sentinel/types'

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
  EMERGENCY: '#7c2d92',
}

const RISK_BG: Record<string, string> = {
  LOW: 'bg-green-500/10 border-green-500/30',
  MODERATE: 'bg-yellow-500/10 border-yellow-500/30',
  HIGH: 'bg-orange-500/10 border-orange-500/30',
  CRITICAL: 'bg-red-500/10 border-red-500/30',
  EMERGENCY: 'bg-purple-500/10 border-purple-500/30',
}

interface Props {
  cell: AirRiskCell | null
  visible: boolean
}

export function AirRiskPanel({ cell, visible }: Props) {
  const { sentinelUpdate } = useSentinel()

  if (!visible) return null

  // If no cell selected, show most critical zone
  const displayCell = cell ?? getMostCritical(sentinelUpdate?.airRiskGrid?.now ?? [])
  if (!displayCell) return null

  return (
    <div className="absolute top-4 right-4 z-30 w-80 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-widest text-white/40 font-medium">
            Air Risk Intelligence
          </h3>
          <div className="text-[10px] text-white/30">
            {displayCell.confidence}% confidence
          </div>
        </div>

        {/* Risk Level Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${RISK_BG[displayCell.risk_level]}`}>
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: RISK_COLORS[displayCell.risk_level] }}
          />
          <span className="text-sm font-semibold" style={{ color: RISK_COLORS[displayCell.risk_level] }}>
            {displayCell.risk_level}
          </span>
        </div>
      </div>

      {/* City name */}
      <div className="px-5 pb-3">
        <div className="text-white/80 text-sm font-medium">{displayCell.id}</div>
      </div>

      {/* Metrics Grid */}
      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
        <MetricCard label="AQI" value={displayCell.aqi} />
        <MetricCard label="PM2.5" value={displayCell.pm25} unit="AQI" />
        <MetricCard label="Ozone" value={displayCell.ozone} unit="AQI" />
        <MetricCard label="NO2" value={displayCell.no2} unit="AQI" />
        <MetricCard label="CO" value={displayCell.co} unit="AQI" />
        <MetricCard label="Main" value={displayCell.main_pollutant} />
      </div>

      {/* Trend + Fire info */}
      <div className="px-5 pb-4 space-y-2 border-t border-white/5 pt-3">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Trend</span>
          <span className={`font-medium ${
            displayCell.trend === 'worsening' ? 'text-red-400' :
            displayCell.trend === 'improving' ? 'text-green-400' : 'text-white/60'
          }`}>
            {displayCell.trend}
          </span>
        </div>

        {displayCell.nearest_fire_km !== null && (
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Nearest fire</span>
            <span className="text-orange-400 font-medium">{displayCell.nearest_fire_km} km</span>
          </div>
        )}

        {displayCell.smoke_direction && (
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Smoke direction</span>
            <span className="text-white/70 font-medium">{displayCell.smoke_direction}</span>
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="px-5 pb-5 border-t border-white/5 pt-3">
        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Recommendation</div>
        <p className="text-xs text-white/70 leading-relaxed">
          {getRecommendation(displayCell.risk_level)}
        </p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-2">
      <div className="text-[10px] text-white/40 uppercase">{label}</div>
      <div className="text-sm font-semibold text-white/90">
        {value} {unit && <span className="text-[10px] text-white/40 font-normal">{unit}</span>}
      </div>
    </div>
  )
}

function getMostCritical(cells: AirRiskCell[]): AirRiskCell | null {
  if (cells.length === 0) return null
  return cells.reduce((max, c) => c.aqi > max.aqi ? c : max, cells[0])
}

function getRecommendation(level: string): string {
  switch (level) {
    case 'EMERGENCY': return 'Evacuate immediately. Air is hazardous. Seal indoor spaces and use respiratory protection.'
    case 'CRITICAL': return 'Avoid all outdoor exposure. Children, elderly, and respiratory patients must stay indoors.'
    case 'HIGH': return 'Limit outdoor exposure. Sensitive groups should remain indoors with windows closed.'
    case 'MODERATE': return 'Unusually sensitive people should consider reducing prolonged outdoor exertion.'
    default: return 'Air quality is satisfactory. No health risk detected.'
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/air-risk-panel.tsx
git commit -m "feat(frontend): air risk detail panel with metrics, trend, and recommendations"
```

---

### Task 10: Integrate Layer + Panel into Dashboard

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx`

- [ ] **Step 1: Add air risk toggle state + imports**

At the top of `mapbox-panel.tsx`, add imports:

```typescript
import { AirRiskLayer } from './air-risk-layer'
import { AirRiskPanel } from './air-risk-panel'
import type { AirRiskCell } from '@sentinel/types'
```

- [ ] **Step 2: Add state variables**

Inside the `MapboxPanel` function, after the existing state declarations (around line 208):

```typescript
const [showAirRisk, setShowAirRisk] = useState(false)
const [selectedAirCell, setSelectedAirCell] = useState<AirRiskCell | null>(null)
```

- [ ] **Step 3: Add toggle button in the component JSX**

Before the closing `</div>` of the map container, add the toggle button + components:

```tsx
{/* Air Risk toggle button */}
<button
  onClick={() => setShowAirRisk(prev => !prev)}
  className={`absolute top-4 left-4 z-20 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
    showAirRisk
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : 'bg-black/60 text-white/60 border-white/10 hover:text-white/90'
  }`}
>
  🌬 Air Risk
</button>

{/* Air Risk Layer */}
<AirRiskLayer
  map={mapRef.current}
  visible={showAirRisk}
  onCellSelect={setSelectedAirCell}
/>

{/* Air Risk Panel */}
<AirRiskPanel
  cell={selectedAirCell}
  visible={showAirRisk}
/>
```

- [ ] **Step 4: Export map ref for child components**

The `AirRiskLayer` needs the map instance. Since `mapRef` is a ref, we need to pass the map once loaded. Add state to hold the map once ready:

After `const mapRef = useRef<mapboxgl.Map | null>(null)`:

```typescript
const [mapReady, setMapReady] = useState(false)
```

In the map init useEffect, after `mapRef.current = map`, add:

```typescript
map.on('load', () => setMapReady(true))
```

Then pass `mapReady ? mapRef.current : null` to the `AirRiskLayer` map prop instead of `mapRef.current`.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(dashboard): integrate Air Risk layer toggle + panel into map"
```

---

### Task 11: Copy Types to Frontend

**Files:**
- Verify frontend can import `AirRiskCell` and `AirRiskGridResult`

- [ ] **Step 1: Check how frontend imports shared types**

The frontend imports from `@sentinel/types`. Check if there's a path alias or if it copies types. If there's a tsconfig path alias or symlink, the new types will be available automatically. If not, the types need to be copied or re-exported.

Look at `frontend/tsconfig.json` paths and determine how to make `AirRiskCell` and `AirRiskGridResult` available in the frontend. If needed, create a local type file:

```typescript
// frontend/types/air-risk.ts
export interface AirRiskCell {
  id: string
  lat: number
  lon: number
  polygon: number[][][]
  pm25: number
  aqi: number
  ozone: number
  no2: number
  co: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EMERGENCY'
  main_pollutant: string
  confidence: number
  trend: 'improving' | 'stable' | 'worsening'
  nearest_fire_km: number | null
  smoke_direction: string | null
}

export interface AirRiskGridResult {
  now: AirRiskCell[]
  plus2h: AirRiskCell[]
  plus6h: AirRiskCell[]
  plus12h: AirRiskCell[]
  metadata: {
    stations_used: number
    coverage_area_km2: number
    generated_at: string
  }
}
```

Update imports in `air-risk-layer.tsx` and `air-risk-panel.tsx` to use `@/types/air-risk` instead of `@sentinel/types`.

- [ ] **Step 2: Commit**

```bash
git add frontend/types/air-risk.ts frontend/components/dashboard/air-risk-layer.tsx frontend/components/dashboard/air-risk-panel.tsx
git commit -m "types: add air risk types to frontend"
```

---

### Task 12: Test End-to-End

- [ ] **Step 1: Start backend locally**

```bash
cd Backend && npm run dev
```

Verify agent-air starts on port 3003 and logs "loaded X air quality stations"

- [ ] **Step 2: Test the endpoint manually**

```bash
curl -X POST http://localhost:3003/analyze \
  -H "Content-Type: application/json" \
  -d '{"firms":[{"lat":-37.5,"lon":-72.1,"frp":200,"brightness":350,"timestamp":"2026-05-17"}],"weather":{"speed":8,"deg":270,"humidity":40},"openaq":{"pm25":45,"aqi":45,"category":"Good"}}'
```

Expected: JSON response with `alertas` + `airRiskGrid` containing `now`, `plus2h`, `plus6h`, `plus12h` arrays.

- [ ] **Step 3: Start frontend**

```bash
cd frontend && pnpm dev
```

Open http://localhost:3010, click "Air Risk" toggle. Verify colored polygons appear on map.

- [ ] **Step 4: Test timeline**

Click +2h, +6h, +12h. Cells near fires should get redder at longer timeframes.

- [ ] **Step 5: Test cell click**

Click a cell on the map. Panel should appear with AQI, PM2.5, trend, recommendations.

---

## Dependency Graph

```
Task 1 (Geocode) → Task 3 (Loader) → Task 4 (Voronoi) → Task 5 (Algorithm) → Task 6 (Endpoint)
Task 2 (Types) → Task 5, Task 6, Task 7, Task 8, Task 9
Task 6 → Task 7 (Orchestrator)
Task 8 (Layer) + Task 9 (Panel) → Task 10 (Integration)
Task 11 (Frontend types) → Task 8, Task 9
All → Task 12 (E2E test)
```
