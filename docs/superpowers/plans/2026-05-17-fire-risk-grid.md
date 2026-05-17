# Fire Risk Grid Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Agent 6's `PredictionResult`/heatmap with a continental-Chile fire-risk grid: ~2,500 colored cells with an explainable 0-100 score, plus an on-demand per-cell detail panel with real infrastructure and AI recommendations.

**Architecture:** `agent-prediction` exposes a fast `POST /analyze` (grid, no LLM/Overpass) and a new `POST /cell-detail` (Overpass + Mistral). The orchestrator no longer calls Agent 6 — the dashboard lazy-fetches the grid via two new backend proxy endpoints (`GET /api/risk-grid`, `POST /api/cell-detail`) when the user toggles the layer.

**Tech Stack:** TypeScript, Express, Supabase, Vitest (backend); Next.js 16, React, mapbox-gl (frontend); OpenStreetMap Overpass API; Mistral via OpenRouter.

**Repo note:** `backend/CLAUDE.md` requires explicit user confirmation before `git add`/`git commit`. The executing agent must ask before running each commit step.

**Branch:** all work stays on `valentinmain`.

---

### Task 1: Replace prediction types in shared package

**Files:**
- Modify: `backend/shared/types/index.ts`

- [ ] **Step 1: Remove old prediction types and field**

In `backend/shared/types/index.ts`, delete the `PredictionCell` interface and the `PredictionResult` interface (currently lines ~179-200). In the `SentinelUpdate` interface, delete the line `prediction?: PredictionResult`.

- [ ] **Step 2: Add the new types**

Append to `backend/shared/types/index.ts`, after the `RoutesResult` interface:

```ts
// ─── Agent 6 — Fire Risk Grid ────────────────────────────────────────────────

export type RiskCategory = 'bajo' | 'medio' | 'alto' | 'critico'

export interface RiskFactors {
  fwi: number        // 0-100 — weather (single point)
  historial: number  // 0-100 — real fire history + live FIRMS
  terreno: number    // 0-100 — vegetation zone proxy
}

export interface FireRiskCell {
  id: string                 // e.g. "M-17"
  lat: number                // SW corner
  lon: number                // SW corner
  size: number               // cell size in degrees (0.25)
  score: number              // 0-100
  category: RiskCategory
  factors: RiskFactors
  zona: string               // vegetation band name
}

export interface FireRiskGrid {
  cells: FireRiskCell[]
  generated_at: string
  weather_point: { lat: number; lon: number }   // limitation: single weather point
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number }
}

export interface CellInfrastructure {
  name: string
  type: 'hospital' | 'school' | 'kindergarten' | 'fire_station' | 'police'
  lat: number
  lon: number
  distance_km: number
}

export interface CellSocialImpact {
  score: number              // 0-100
  poblacion_estimada?: number
  resumen: string
}

export interface CellDetail {
  cell_id: string
  infrastructure: CellInfrastructure[]
  social_impact: CellSocialImpact
  explicacion: string                                // Mistral
  recomendaciones: string[]                          // Mistral
  prioridad: 'baja' | 'media' | 'alta' | 'critica'   // Mistral, score-fallback
}
```

- [ ] **Step 3: Typecheck the shared package**

Run: `cd backend/packages/agent-prediction && npx tsc --noEmit`
Expected: errors only in `analyze.ts`/`analyze.test.ts`/`index.ts` (still reference deleted types — fixed in Tasks 2-8). No errors complaining about the new types themselves.

- [ ] **Step 4: Commit**

```bash
git add backend/shared/types/index.ts
git commit -m "feat(types): replace PredictionResult with FireRiskGrid types"
```

---

### Task 2: agent-prediction — zones module

**Files:**
- Create: `backend/packages/agent-prediction/src/zones.ts`
- Test: `backend/packages/agent-prediction/src/zones.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/packages/agent-prediction/src/zones.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { columnLabel, cellId, terrainFor, zoneNameFor, iterateCells, CELL_DEG } from './zones'

describe('columnLabel', () => {
  it('maps 0 to A, 25 to Z, 26 to AA', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
  })
})

describe('cellId', () => {
  it('produces a stable global id from SW corner', () => {
    expect(cellId(-56, -76)).toBe('A-0')
  })
  it('different cells get different ids', () => {
    expect(cellId(-38.5, -72.0)).not.toBe(cellId(-38.25, -72.0))
  })
})

describe('terrainFor', () => {
  it('desert north is low, forestal centre-south is max', () => {
    expect(terrainFor(-22)).toBeLessThan(terrainFor(-37))
    expect(terrainFor(-37)).toBe(1)
  })
  it('returns 0 outside all bands', () => {
    expect(terrainFor(-10)).toBe(0)
  })
})

describe('zoneNameFor', () => {
  it('returns a band name for a latitude inside Chile', () => {
    expect(zoneNameFor(-37)).toContain('Centro-Sur')
  })
})

describe('iterateCells', () => {
  it('produces land cells only, all aligned to the 0.25 grid', () => {
    const cells = iterateCells()
    expect(cells.length).toBeGreaterThan(1500)
    expect(cells.length).toBeLessThan(4000)
    for (const c of cells.slice(0, 200)) {
      expect(Math.round((c.lat / CELL_DEG) * 1e6) % 1e6).toBe(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/agent-prediction && npx vitest run src/zones.test.ts`
Expected: FAIL — `Cannot find module './zones'`.

- [ ] **Step 3: Write the implementation**

Create `backend/packages/agent-prediction/src/zones.ts`:

```ts
export const GRID_LAT_MIN = -56
export const GRID_LON_MIN = -76
export const CELL_DEG = 0.25

export interface ZoneBand {
  name: string
  latMin: number
  latMax: number
  lonMin: number
  lonMax: number
  terrain: number   // 0-1 vegetation/fire-proneness proxy
}

// Latitude bands of continental Chile. lonMin/lonMax clip ocean + Argentina;
// terrain is the vegetation proxy (max in the Mediterranean/forestal centre-south).
export const ZONAS_CHILE: ZoneBand[] = [
  { name: 'Norte Grande (desierto Atacama)',         latMin: -26.0, latMax: -17.5, lonMin: -70.5, lonMax: -67.0, terrain: 0.05 },
  { name: 'Norte Chico (semiárido)',                 latMin: -32.0, latMax: -26.0, lonMin: -71.7, lonMax: -69.5, terrain: 0.25 },
  { name: 'Zona Central (mediterránea)',             latMin: -36.0, latMax: -32.0, lonMin: -72.5, lonMax: -69.8, terrain: 0.75 },
  { name: 'Centro-Sur (forestal)',                   latMin: -39.0, latMax: -36.0, lonMin: -73.7, lonMax: -70.8, terrain: 1.00 },
  { name: 'Araucanía / Los Lagos (bosque templado)', latMin: -44.0, latMax: -39.0, lonMin: -74.3, lonMax: -71.0, terrain: 0.90 },
  { name: 'Aysén (bosque patagónico húmedo)',        latMin: -49.0, latMax: -44.0, lonMin: -75.7, lonMax: -71.5, terrain: 0.50 },
  { name: 'Magallanes (estepa fría)',                latMin: -56.0, latMax: -49.0, lonMin: -75.5, lonMax: -66.0, terrain: 0.30 },
]

// 0->A, 25->Z, 26->AA ... handles up to 51 columns (grid has ~40).
export function columnLabel(col: number): string {
  if (col < 26) return String.fromCharCode(65 + col)
  return 'A' + String.fromCharCode(65 + (col - 26))
}

// Stable global cell id from the cell's SW corner.
export function cellId(lat: number, lon: number): string {
  const col = Math.round((lon - GRID_LON_MIN) / CELL_DEG)
  const row = Math.round((lat - GRID_LAT_MIN) / CELL_DEG)
  return `${columnLabel(col)}-${row}`
}

export function terrainFor(lat: number): number {
  for (const z of ZONAS_CHILE) {
    if (lat >= z.latMin && lat < z.latMax) return z.terrain
  }
  return 0
}

export function zoneNameFor(lat: number): string {
  for (const z of ZONAS_CHILE) {
    if (lat >= z.latMin && lat < z.latMax) return z.name
  }
  return 'Fuera de zona'
}

export interface RawCell {
  lat: number       // SW corner
  lon: number       // SW corner
  zone: ZoneBand
}

// Every land cell, clipped to continental Chile by latitude band.
export function iterateCells(): RawCell[] {
  const cells: RawCell[] = []
  for (const z of ZONAS_CHILE) {
    for (let lat = z.latMin; lat < z.latMax - 1e-9; lat += CELL_DEG) {
      for (let lon = z.lonMin; lon < z.lonMax - 1e-9; lon += CELL_DEG) {
        cells.push({
          lat: Math.round(lat * 100) / 100,
          lon: Math.round(lon * 100) / 100,
          zone: z,
        })
      }
    }
  }
  return cells
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/packages/agent-prediction && npx vitest run src/zones.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/agent-prediction/src/zones.ts backend/packages/agent-prediction/src/zones.test.ts
git commit -m "feat(agent-prediction): add Chile zone bands and grid cells"
```

---

### Task 3: agent-prediction — FWI, score, category

**Files:**
- Create: `backend/packages/agent-prediction/src/grid.ts`
- Test: `backend/packages/agent-prediction/src/grid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/packages/agent-prediction/src/grid.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toTempCelsius, computeFwi, combineScore, categoryFor } from './grid'
import type { WeatherData } from '@sentinel/types'

describe('toTempCelsius', () => {
  it('passes Celsius through and converts Kelvin', () => {
    expect(toTempCelsius(25)).toBe(25)
    expect(toTempCelsius(298.15)).toBeCloseTo(25, 1)
    expect(toTempCelsius(undefined)).toBe(20)
  })
})

describe('computeFwi', () => {
  it('hot/dry/windy scores higher than cold/wet', () => {
    const hot: WeatherData = { speed: 15, deg: 0, humidity: 20, temp: 35 }
    const cold: WeatherData = { speed: 1, deg: 0, humidity: 90, temp: 5 }
    expect(computeFwi(hot)).toBeGreaterThan(computeFwi(cold))
  })
  it('always returns 0..1', () => {
    const extreme: WeatherData = { speed: 99, deg: 0, humidity: 0, temp: 99 }
    expect(computeFwi(extreme)).toBeLessThanOrEqual(1)
    expect(computeFwi(extreme)).toBeGreaterThanOrEqual(0)
  })
})

describe('combineScore', () => {
  it('blends factors 0.40/0.35/0.25 and rounds', () => {
    expect(combineScore({ fwi: 100, historial: 100, terreno: 100 })).toBe(100)
    expect(combineScore({ fwi: 0, historial: 0, terreno: 0 })).toBe(0)
    expect(combineScore({ fwi: 50, historial: 0, terreno: 0 })).toBe(20)
  })
})

describe('categoryFor', () => {
  it('maps score ranges to categories', () => {
    expect(categoryFor(10)).toBe('bajo')
    expect(categoryFor(45)).toBe('medio')
    expect(categoryFor(70)).toBe('alto')
    expect(categoryFor(90)).toBe('critico')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/agent-prediction && npx vitest run src/grid.test.ts`
Expected: FAIL — `Cannot find module './grid'`.

- [ ] **Step 3: Write the implementation**

Create `backend/packages/agent-prediction/src/grid.ts`:

```ts
import type { WeatherData, RiskCategory, RiskFactors } from '@sentinel/types'

export function toTempCelsius(temp: number | undefined): number {
  if (temp === undefined) return 20
  return temp > 100 ? temp - 273.15 : temp
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1)
}

// Fire Weather Index proxy, 0-1, from a single weather point.
export function computeFwi(weather: WeatherData): number {
  const tempC = toTempCelsius(weather.temp)
  const drought = clamp01((100 - weather.humidity) / 100)
  const wind = clamp01(weather.speed / 20)
  const temp = clamp01((tempC - 15) / 25)
  return clamp01(drought * 0.5 + wind * 0.3 + temp * 0.2)
}

// Weighted blend of the three 0-100 factors → 0-100 score.
export function combineScore(f: RiskFactors): number {
  return Math.round(0.40 * f.fwi + 0.35 * f.historial + 0.25 * f.terreno)
}

export function categoryFor(score: number): RiskCategory {
  if (score >= 80) return 'critico'
  if (score >= 60) return 'alto'
  if (score >= 40) return 'medio'
  return 'bajo'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/packages/agent-prediction && npx vitest run src/grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/agent-prediction/src/grid.ts backend/packages/agent-prediction/src/grid.test.ts
git commit -m "feat(agent-prediction): add FWI, score blend and category logic"
```

---

### Task 4: agent-prediction — historial proximity kernel

**Files:**
- Modify: `backend/packages/agent-prediction/src/grid.ts`
- Modify: `backend/packages/agent-prediction/src/grid.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `backend/packages/agent-prediction/src/grid.test.ts`:

```ts
import { computeHistorial } from './grid'

describe('computeHistorial', () => {
  it('returns an empty map when there are no hotspots', () => {
    expect(computeHistorial([]).size).toBe(0)
  })

  it('the hottest cell normalizes to 100', () => {
    const map = computeHistorial([{ lat: -38.4, lon: -72.1 }])
    const max = Math.max(...map.values())
    expect(max).toBe(100)
  })

  it('neighbouring cells receive a falloff weight below the centre', () => {
    const map = computeHistorial([{ lat: -38.4, lon: -72.1 }])
    const row = Math.floor(-38.4 / 0.25)
    const col = Math.floor(-72.1 / 0.25)
    const centre = map.get(`${row},${col}`) ?? 0
    const neighbour = map.get(`${row + 1},${col}`) ?? 0
    expect(neighbour).toBeGreaterThan(0)
    expect(neighbour).toBeLessThan(centre)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/agent-prediction && npx vitest run src/grid.test.ts`
Expected: FAIL — `computeHistorial is not exported`.

- [ ] **Step 3: Add the implementation**

Append to `backend/packages/agent-prediction/src/grid.ts`:

```ts
import { CELL_DEG } from './zones'

export interface Hotspot {
  lat: number
  lon: number
}

// Proximity kernel: each hotspot adds weight 1.0 to its own cell and a
// linear falloff to cells within a 2-cell radius. Result keyed "row,col"
// (integer grid indices), normalized so the hottest cell is 100.
export function computeHistorial(hotspots: Hotspot[]): Map<string, number> {
  const raw = new Map<string, number>()
  for (const h of hotspots) {
    const hRow = Math.floor(h.lat / CELL_DEG)
    const hCol = Math.floor(h.lon / CELL_DEG)
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const dist = Math.sqrt(dr * dr + dc * dc)
        const w = Math.max(0, 1 - dist / 3)
        if (w <= 0) continue
        const k = `${hRow + dr},${hCol + dc}`
        raw.set(k, (raw.get(k) ?? 0) + w)
      }
    }
  }
  const result = new Map<string, number>()
  if (raw.size === 0) return result
  const max = Math.max(...raw.values())
  for (const [k, v] of raw) {
    result.set(k, Math.round((v / max) * 100))
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/packages/agent-prediction && npx vitest run src/grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/agent-prediction/src/grid.ts backend/packages/agent-prediction/src/grid.test.ts
git commit -m "feat(agent-prediction): add historial proximity kernel"
```

---

### Task 5: agent-prediction — buildFireRiskGrid

**Files:**
- Modify: `backend/packages/agent-prediction/src/grid.ts`
- Modify: `backend/packages/agent-prediction/src/grid.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `backend/packages/agent-prediction/src/grid.test.ts`:

```ts
import { buildFireRiskGrid } from './grid'
import type { FireData } from '@sentinel/types'

describe('buildFireRiskGrid', () => {
  it('builds a grid of cells with valid 0-100 scores and categories', async () => {
    const weather: WeatherData = { speed: 10, deg: 0, humidity: 30, temp: 30 }
    const fires: FireData[] = [
      { lat: -38.4, lon: -72.1, frp: 120, brightness: 330, timestamp: '2026-05-17T00:00:00Z' },
    ]
    const grid = await buildFireRiskGrid(weather, fires)
    expect(grid.cells.length).toBeGreaterThan(1500)
    for (const c of grid.cells.slice(0, 100)) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
      expect(['bajo', 'medio', 'alto', 'critico']).toContain(c.category)
      expect(c.size).toBe(0.25)
    }
    expect(grid.bbox.latMin).toBe(-56)
    expect(grid.weather_point).toEqual({ lat: -38.4, lon: -72.1 })
  })

  it('cells near a live fire score higher than far-away cells', async () => {
    const weather: WeatherData = { speed: 5, deg: 0, humidity: 50, temp: 20 }
    const fires: FireData[] = [
      { lat: -38.4, lon: -72.1, frp: 200, brightness: 340, timestamp: '2026-05-17T00:00:00Z' },
    ]
    const grid = await buildFireRiskGrid(weather, fires)
    // Cell whose centre is closest to the fire, vs a far Atacama cell.
    const fireCell = grid.cells.reduce((best, c) => {
      const d = Math.hypot(c.lat + 0.125 - -38.4, c.lon + 0.125 - -72.1)
      const bd = Math.hypot(best.lat + 0.125 - -38.4, best.lon + 0.125 - -72.1)
      return d < bd ? c : best
    })
    const desertCell = grid.cells.find(c => c.lat > -25)!
    expect(fireCell.factors.historial).toBeGreaterThan(desertCell.factors.historial)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/agent-prediction && npx vitest run src/grid.test.ts`
Expected: FAIL — `buildFireRiskGrid is not exported`.

- [ ] **Step 3: Add the implementation**

Append to `backend/packages/agent-prediction/src/grid.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { FireData, FireRiskCell, FireRiskGrid } from '@sentinel/types'
import { iterateCells, cellId } from './zones'

const HISTORY_DAYS = 30

async function fetchHistoryHotspots(): Promise<Hotspot[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return []
  try {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('fire_hotspot_history')
      .select('lat, lon')
      .gte('timestamp', since)
    if (error || !data) return []
    return data.map(r => ({ lat: r.lat as number, lon: r.lon as number }))
  } catch {
    return []
  }
}

function average(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

export async function buildFireRiskGrid(
  weather: WeatherData,
  firms: FireData[],
): Promise<FireRiskGrid> {
  const fwi = Math.round(computeFwi(weather) * 100)

  const history = await fetchHistoryHotspots()
  const live: Hotspot[] = firms.map(f => ({ lat: f.lat, lon: f.lon }))
  const historial = computeHistorial([...history, ...live])

  const cells: FireRiskCell[] = iterateCells().map(rc => {
    // A cell's SW corner is an exact 0.25 multiple, so round() here matches the
    // floor() that computeHistorial uses to bucket hotspots.
    const row = Math.round(rc.lat / CELL_DEG)
    const col = Math.round(rc.lon / CELL_DEG)
    const factors: RiskFactors = {
      fwi,
      historial: historial.get(`${row},${col}`) ?? 0,
      terreno: Math.round(rc.zone.terrain * 100),
    }
    const score = combineScore(factors)
    return {
      id: cellId(rc.lat, rc.lon),
      lat: rc.lat,
      lon: rc.lon,
      size: CELL_DEG,
      score,
      category: categoryFor(score),
      factors,
      zona: rc.zone.name,
    }
  })

  const weatherPoint = firms.length > 0
    ? { lat: average(firms.map(f => f.lat)), lon: average(firms.map(f => f.lon)) }
    : { lat: -38.5, lon: -72.0 }

  return {
    cells,
    generated_at: new Date().toISOString(),
    weather_point: weatherPoint,
    bbox: { latMin: -56, latMax: -17.5, lonMin: -76, lonMax: -66 },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/packages/agent-prediction && npx vitest run src/grid.test.ts`
Expected: PASS. (No Supabase env in test → `fetchHistoryHotspots` returns `[]`, historial comes from live fires only.)

- [ ] **Step 5: Commit**

```bash
git add backend/packages/agent-prediction/src/grid.ts backend/packages/agent-prediction/src/grid.test.ts
git commit -m "feat(agent-prediction): assemble FireRiskGrid from factors"
```

---

### Task 6: agent-prediction — social impact + distance helpers

**Files:**
- Create: `backend/packages/agent-prediction/src/cell-detail.ts`
- Test: `backend/packages/agent-prediction/src/cell-detail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/packages/agent-prediction/src/cell-detail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { haversineKm, socialImpact } from './cell-detail'
import type { CellInfrastructure } from '@sentinel/types'

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(-38, -72, -38, -72)).toBeCloseTo(0, 5)
  })
  it('~111 km for one degree of latitude', () => {
    expect(haversineKm(-38, -72, -39, -72)).toBeGreaterThan(105)
    expect(haversineKm(-38, -72, -39, -72)).toBeLessThan(115)
  })
})

describe('socialImpact', () => {
  it('reports zero impact and a clear message when no infrastructure', () => {
    const r = socialImpact([])
    expect(r.score).toBe(0)
    expect(r.resumen).toMatch(/sin infraestructura/i)
  })
  it('a hospital weighs more than a fire station', () => {
    const hospital: CellInfrastructure = { name: 'H', type: 'hospital', lat: 0, lon: 0, distance_km: 1 }
    const station: CellInfrastructure = { name: 'B', type: 'fire_station', lat: 0, lon: 0, distance_km: 1 }
    expect(socialImpact([hospital]).score).toBeGreaterThan(socialImpact([station]).score)
  })
  it('caps the score at 100', () => {
    const many: CellInfrastructure[] = Array.from({ length: 20 }, (_, i) => ({
      name: `H${i}`, type: 'hospital', lat: 0, lon: 0, distance_km: 1,
    }))
    expect(socialImpact(many).score).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/agent-prediction && npx vitest run src/cell-detail.test.ts`
Expected: FAIL — `Cannot find module './cell-detail'`.

- [ ] **Step 3: Write the implementation**

Create `backend/packages/agent-prediction/src/cell-detail.ts`:

```ts
import type { CellInfrastructure, CellSocialImpact } from '@sentinel/types'

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

const TYPE_WEIGHT: Record<CellInfrastructure['type'], number> = {
  hospital: 30,
  kindergarten: 25,
  school: 20,
  police: 12,
  fire_station: 8,
}

const TYPE_LABEL: Record<CellInfrastructure['type'], string> = {
  hospital: 'hospital(es)',
  kindergarten: 'jardín(es) infantil(es)',
  school: 'escuela(s)',
  police: 'comisaría(s)',
  fire_station: 'cuartel(es) de bomberos',
}

export function socialImpact(infra: CellInfrastructure[]): CellSocialImpact {
  const raw = infra.reduce((s, i) => s + TYPE_WEIGHT[i.type], 0)
  const score = Math.min(100, raw)
  const counts = new Map<CellInfrastructure['type'], number>()
  for (const i of infra) counts.set(i.type, (counts.get(i.type) ?? 0) + 1)
  const parts = [...counts.entries()].map(([t, n]) => `${n} ${TYPE_LABEL[t]}`)
  const resumen = parts.length > 0
    ? `Infraestructura sensible en la celda: ${parts.join(', ')}.`
    : 'Sin infraestructura sensible registrada en la celda.'
  return { score, resumen }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend/packages/agent-prediction && npx vitest run src/cell-detail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/agent-prediction/src/cell-detail.ts backend/packages/agent-prediction/src/cell-detail.test.ts
git commit -m "feat(agent-prediction): add social-impact and distance helpers"
```

---

### Task 7: agent-prediction — Overpass + LLM + buildCellDetail

**Files:**
- Modify: `backend/packages/agent-prediction/src/cell-detail.ts`

- [ ] **Step 1: Add the Overpass + LLM + buildCellDetail implementation**

Append to `backend/packages/agent-prediction/src/cell-detail.ts`:

```ts
import type { FireRiskCell, CellDetail } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

const AMENITY_TYPE: Record<string, CellInfrastructure['type']> = {
  hospital: 'hospital',
  school: 'school',
  kindergarten: 'kindergarten',
  fire_station: 'fire_station',
  police: 'police',
}

interface OverpassNode {
  lat: number
  lon: number
  tags?: Record<string, string>
}

export async function fetchInfrastructure(cell: FireRiskCell): Promise<CellInfrastructure[]> {
  const latMin = cell.lat
  const latMax = cell.lat + cell.size
  const lonMin = cell.lon
  const lonMax = cell.lon + cell.size
  const centerLat = cell.lat + cell.size / 2
  const centerLon = cell.lon + cell.size / 2
  const query = `[out:json][timeout:25];
(
  node["amenity"~"hospital|school|kindergarten|fire_station|police"](${latMin},${lonMin},${latMax},${lonMax});
);
out body;`
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { elements?: OverpassNode[] }
    return (data.elements ?? [])
      .filter(n => n.tags?.name && n.tags?.amenity && AMENITY_TYPE[n.tags.amenity])
      .map(n => ({
        name: n.tags!.name,
        type: AMENITY_TYPE[n.tags!.amenity],
        lat: n.lat,
        lon: n.lon,
        distance_km: Math.round(haversineKm(centerLat, centerLon, n.lat, n.lon) * 10) / 10,
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
  } catch {
    return []
  }
}

function priorityFromScore(score: number): CellDetail['prioridad'] {
  if (score >= 80) return 'critica'
  if (score >= 60) return 'alta'
  if (score >= 40) return 'media'
  return 'baja'
}

interface CellLLMOutput {
  explicacion: string
  recomendaciones: string[]
  prioridad: CellDetail['prioridad']
}

async function runCellLLM(
  cell: FireRiskCell,
  infra: CellInfrastructure[],
  impact: CellSocialImpact,
): Promise<CellLLMOutput> {
  const system = `Eres un experto en gestión de emergencias por incendios forestales en Chile.
Recibes el riesgo de una celda geográfica y la infraestructura crítica que contiene.
Responde SOLO con JSON válido, sin markdown ni texto adicional, con esta estructura exacta:
{
  "explicacion": "por qué esta celda tiene este nivel de riesgo, 2-3 frases",
  "recomendaciones": ["accion 1", "accion 2", "accion 3"],
  "prioridad": "baja" | "media" | "alta" | "critica"
}`
  const user = `Celda ${cell.id} — zona: ${cell.zona}
Score de riesgo: ${cell.score}/100 (categoría: ${cell.category})
Factores: FWI ${cell.factors.fwi}, Historial ${cell.factors.historial}, Terreno ${cell.factors.terreno}
Impacto social: ${impact.score}/100 — ${impact.resumen}
Infraestructura: ${infra.length > 0
    ? infra.map(i => `${i.type} "${i.name}" a ${i.distance_km} km`).join('; ')
    : 'ninguna registrada'}

Genera el análisis de intervención para esta celda.`
  const raw = await callOpenRouter(MODELS.large, system, user)
  const parsed = parseJSON<Partial<CellLLMOutput>>(raw, 'Agent 6 (cell-detail)')
  return {
    explicacion: typeof parsed.explicacion === 'string' ? parsed.explicacion : '',
    recomendaciones: Array.isArray(parsed.recomendaciones)
      ? parsed.recomendaciones.filter((x): x is string => typeof x === 'string')
      : [],
    prioridad: ['baja', 'media', 'alta', 'critica'].includes(parsed.prioridad as string)
      ? (parsed.prioridad as CellDetail['prioridad'])
      : priorityFromScore(cell.score),
  }
}

export async function buildCellDetail(cell: FireRiskCell): Promise<CellDetail> {
  const infrastructure = await fetchInfrastructure(cell)
  const impact = socialImpact(infrastructure)

  let explicacion = ''
  let recomendaciones: string[] = []
  let prioridad = priorityFromScore(cell.score)
  try {
    const llm = await runCellLLM(cell, infrastructure, impact)
    explicacion = llm.explicacion
    recomendaciones = llm.recomendaciones
    prioridad = llm.prioridad
  } catch {
    // LLM degraded — keep score-based priority and empty text
  }

  return {
    cell_id: cell.id,
    infrastructure,
    social_impact: impact,
    explicacion,
    recomendaciones,
    prioridad,
  }
}
```

- [ ] **Step 2: Verify the existing tests still pass and the file typechecks**

Run: `cd backend/packages/agent-prediction && npx vitest run src/cell-detail.test.ts`
Expected: PASS (the new code adds exports but doesn't change `haversineKm`/`socialImpact`).

- [ ] **Step 3: Commit**

```bash
git add backend/packages/agent-prediction/src/cell-detail.ts
git commit -m "feat(agent-prediction): add Overpass lookup and AI cell detail"
```

---

### Task 8: agent-prediction — wire routes, remove old analyze

**Files:**
- Modify: `backend/packages/agent-prediction/src/index.ts`
- Delete: `backend/packages/agent-prediction/src/analyze.ts`
- Delete: `backend/packages/agent-prediction/src/analyze.test.ts`

- [ ] **Step 1: Replace index.ts**

Overwrite `backend/packages/agent-prediction/src/index.ts` with:

```ts
import 'dotenv/config'
import express from 'express'
import type {
  AgentRequest,
  AgentResponse,
  FireRiskGrid,
  CellDetail,
  FireRiskCell,
  WeatherData,
  FireData,
} from '@sentinel/types'
import { buildFireRiskGrid } from './grid'
import { buildCellDetail } from './cell-detail'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const weather: WeatherData = body.weather ?? { speed: 0, deg: 0, humidity: 0 }
  const firms: FireData[] = body.firms ?? []
  try {
    const data = await buildFireRiskGrid(weather, firms)
    res.json({ success: true, data } satisfies AgentResponse<FireRiskGrid>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<FireRiskGrid>)
  }
})

app.post('/cell-detail', async (req, res) => {
  const body = req.body as { cell?: FireRiskCell }
  if (!body.cell) {
    res.status(400).json({ success: false, data: null, error: 'Missing cell' } satisfies AgentResponse<CellDetail>)
    return
  }
  try {
    const data = await buildCellDetail(body.cell)
    res.json({ success: true, data } satisfies AgentResponse<CellDetail>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<CellDetail>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-prediction' }))

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => console.log(`[agent-prediction] running on port ${PORT}`))
```

- [ ] **Step 2: Delete the obsolete files**

```bash
git rm backend/packages/agent-prediction/src/analyze.ts backend/packages/agent-prediction/src/analyze.test.ts
```

- [ ] **Step 3: Build the package**

Run: `cd backend/packages/agent-prediction && npm run build`
Expected: `tsc` completes with no errors.

- [ ] **Step 4: Run the full package test suite**

Run: `cd backend/packages/agent-prediction && npx vitest run`
Expected: PASS — `zones.test.ts`, `grid.test.ts`, `cell-detail.test.ts` all green.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/agent-prediction/src/index.ts
git commit -m "feat(agent-prediction): expose /analyze grid and /cell-detail routes"
```

---

### Task 9: backend — agent-prediction proxy service

**Files:**
- Create: `backend/packages/backend/src/services/prediction-proxy.ts`

- [ ] **Step 1: Write the service**

Create `backend/packages/backend/src/services/prediction-proxy.ts`:

```ts
import type {
  AgentResponse,
  FireRiskGrid,
  CellDetail,
  FireRiskCell,
  WeatherData,
  FireData,
} from '@sentinel/types'

function predictionUrl(): string {
  const url = process.env.AGENT_PREDICTION_URL
  if (!url) throw new Error('AGENT_PREDICTION_URL not set')
  return url
}

export async function fetchRiskGrid(weather: WeatherData, firms: FireData[]): Promise<FireRiskGrid> {
  const res = await fetch(`${predictionUrl()}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weather, firms }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`agent-prediction /analyze returned ${res.status}`)
  const json = (await res.json()) as AgentResponse<FireRiskGrid>
  if (!json.success) throw new Error(json.error)
  return json.data
}

export async function fetchCellDetail(cell: FireRiskCell): Promise<CellDetail> {
  const res = await fetch(`${predictionUrl()}/cell-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cell }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`agent-prediction /cell-detail returned ${res.status}`)
  const json = (await res.json()) as AgentResponse<CellDetail>
  if (!json.success) throw new Error(json.error)
  return json.data
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend/packages/backend && npx tsc --noEmit`
Expected: errors only in `orchestrator.ts` (still references removed `PredictionResult` — fixed in Task 11). No error in `prediction-proxy.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/packages/backend/src/services/prediction-proxy.ts
git commit -m "feat(backend): add agent-prediction proxy service"
```

---

### Task 10: backend — risk-grid and cell-detail routes

**Files:**
- Modify: `backend/packages/backend/src/routes/index.ts`

- [ ] **Step 1: Add imports**

In `backend/packages/backend/src/routes/index.ts`, add to the import block (after the `getLastUpdate` import on line 12):

```ts
import { fetchRiskGrid, fetchCellDetail } from '../services/prediction-proxy'
import type { FireRiskCell } from '@sentinel/types'
```

- [ ] **Step 2: Add a dedicated rate limiter**

After the `triggerLimiter` definition (ends line 28), add:

```ts
// Grid endpoints hit Overpass + Mistral — more generous than triggerLimiter
// but still capped to protect the upstreams.
const gridLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
})
```

- [ ] **Step 3: Add the two routes**

In `registerRoutes`, after the `GET /api/status` handler (ends line 49), add:

```ts
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

  // POST /api/cell-detail — per-cell infrastructure + AI detail.
  app.post('/api/cell-detail', gridLimiter, async (req, res) => {
    const body = req.body as { cell?: FireRiskCell }
    if (!body.cell) {
      res.status(400).json({ ok: false, error: 'Missing cell' })
      return
    }
    try {
      const detail = await fetchCellDetail(body.cell)
      res.json({ ok: true, detail })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(502).json({ ok: false, error: message })
    }
  })
```

- [ ] **Step 4: Typecheck**

Run: `cd backend/packages/backend && npx tsc --noEmit`
Expected: errors only in `orchestrator.ts` (fixed next task). No errors in `routes/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/backend/src/routes/index.ts
git commit -m "feat(backend): add /api/risk-grid and /api/cell-detail routes"
```

---

### Task 11: backend — remove prediction from the orchestrator

**Files:**
- Modify: `backend/packages/backend/src/services/orchestrator.ts`

- [ ] **Step 1: Remove the PredictionResult import**

In `backend/packages/backend/src/services/orchestrator.ts`, in the type import block (lines 1-14), delete the line `  PredictionResult,`.

- [ ] **Step 2: Remove the prediction agent call**

Delete the line that reads the env var (line 144):

```ts
  const predictionUrl = process.env.AGENT_PREDICTION_URL  // optional — skip silently if not set
```

Change the `Promise.allSettled` destructuring + array (lines 146-154) from five entries to four:

```ts
  const [fireSettled, weatherAgentSettled, airAgentSettled, routesSettled] = await Promise.allSettled([
    callAgent<FireAnalysis>(fireUrl, { firms: fires, weather }),
    callAgent<unknown>(weatherUrl, { weather, firms: fires }),
    callAgent<AirAlerts>(airUrl, { openaq: airQuality, firms: fires }),
    callAgent<RoutesResult>(routesUrl, { firms: fires }),
  ])
```

- [ ] **Step 3: Remove prediction handling**

Delete the prediction warning line (line 160):

```ts
  if (predictionSettled.status === 'rejected') console.warn('[orchestrator] agent-prediction failed:', predictionSettled.reason)
```

Delete the `predictionResult` extraction block (lines 178-181):

```ts
  const predictionResult =
    predictionSettled.status === 'fulfilled' && predictionSettled.value.success
      ? predictionSettled.value.data
      : null
```

In the returned `SentinelUpdate` object, delete the line:

```ts
    prediction: predictionResult ?? undefined,
```

- [ ] **Step 4: Build the whole backend package**

Run: `cd backend/packages/backend && npm run build`
Expected: `tsc` completes with no errors. (`appendFireHistory` on `fires` stays — it still feeds the historial factor.)

- [ ] **Step 5: Commit**

```bash
git add backend/packages/backend/src/services/orchestrator.ts
git commit -m "refactor(backend): drop agent-prediction from orchestrator pipeline"
```

---

### Task 12: frontend — mirror the new types

**Files:**
- Modify: `frontend/hooks/use-socket.ts`

- [ ] **Step 1: Remove old prediction types**

In `frontend/hooks/use-socket.ts`, delete the `PredictionCell` interface and the `PredictionResult` interface (lines ~140-155). In the `SentinelUpdate` interface, delete the line `  prediction?: PredictionResult`.

- [ ] **Step 2: Add the new types**

After the `InfrastructurePoint` interface (ends line 108), add:

```ts
export type RiskCategory = 'bajo' | 'medio' | 'alto' | 'critico'

export interface RiskFactors {
  fwi: number
  historial: number
  terreno: number
}

export interface FireRiskCell {
  id: string
  lat: number
  lon: number
  size: number
  score: number
  category: RiskCategory
  factors: RiskFactors
  zona: string
}

export interface FireRiskGrid {
  cells: FireRiskCell[]
  generated_at: string
  weather_point: { lat: number; lon: number }
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number }
}

export interface CellInfrastructure {
  name: string
  type: 'hospital' | 'school' | 'kindergarten' | 'fire_station' | 'police'
  lat: number
  lon: number
  distance_km: number
}

export interface CellSocialImpact {
  score: number
  poblacion_estimada?: number
  resumen: string
}

export interface CellDetail {
  cell_id: string
  infrastructure: CellInfrastructure[]
  social_impact: CellSocialImpact
  explicacion: string
  recomendaciones: string[]
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors only in `components/dashboard/mapbox-panel.tsx` (still uses `prediction`/heatmap — fixed in Task 16). No errors in `use-socket.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/use-socket.ts
git commit -m "feat(frontend): mirror FireRiskGrid types in use-socket"
```

---

### Task 13: frontend — Next.js proxy routes

**Files:**
- Create: `frontend/app/api/risk-grid/route.ts`
- Create: `frontend/app/api/cell-detail/route.ts`

- [ ] **Step 1: Create the risk-grid route**

Create `frontend/app/api/risk-grid/route.ts`:

```ts
import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

// Fire Risk Grid — proxied from the backend, lazy-loaded by the dashboard toggle.
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/risk-grid`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'backend unreachable' }, { status: 502 })
  }
}
```

- [ ] **Step 2: Create the cell-detail route**

Create `frontend/app/api/cell-detail/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

// Per-cell infrastructure + AI detail — proxied from the backend.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND_URL}/api/cell-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'backend unreachable' }, { status: 502 })
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: same as Task 12 (errors only in `mapbox-panel.tsx`). No errors in the two new route files.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/risk-grid/route.ts frontend/app/api/cell-detail/route.ts
git commit -m "feat(frontend): add risk-grid and cell-detail proxy routes"
```

---

### Task 14: frontend — risk-grid helpers

**Files:**
- Create: `frontend/lib/risk-grid.ts`

- [ ] **Step 1: Write the helpers**

Create `frontend/lib/risk-grid.ts`:

```ts
import type { FireRiskCell, RiskCategory } from '@/hooks/use-socket'

export const CATEGORY_COLOR: Record<RiskCategory, string> = {
  bajo: '#22c55e',
  medio: '#eab308',
  alto: '#f97316',
  critico: '#ef4444',
}

export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
}

export const PRIORITY_LABEL: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

// Cell SW corner + size → a closed GeoJSON polygon ring (lon/lat order).
export function cellPolygon(cell: FireRiskCell): number[][][] {
  const { lat, lon, size } = cell
  return [[
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat + size],
    [lon, lat + size],
    [lon, lat],
  ]]
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: unchanged from Task 13 — no new errors from `lib/risk-grid.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/risk-grid.ts
git commit -m "feat(frontend): add risk-grid color and polygon helpers"
```

---

### Task 15: frontend — cell detail panel component

**Files:**
- Create: `frontend/components/dashboard/fire-risk-cell-panel.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/components/dashboard/fire-risk-cell-panel.tsx`:

```tsx
"use client"

import { X, MapPin, Activity, Building2, Sparkles, Loader2 } from "lucide-react"
import type { FireRiskCell, CellDetail } from "@/hooks/use-socket"
import { CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/risk-grid"

const INFRA_LABEL: Record<string, string> = {
  hospital: "Hospital",
  school: "Escuela",
  kindergarten: "Jardín infantil",
  fire_station: "Bomberos",
  police: "Comisaría",
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1">
        <span>{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-blue" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function FireRiskCellPanel({
  cell,
  detail,
  loading,
  onClose,
}: {
  cell: FireRiskCell | null
  detail: CellDetail | null
  loading: boolean
  onClose: () => void
}) {
  if (!cell) return null

  const color = CATEGORY_COLOR[cell.category]

  return (
    <div className="absolute top-24 bottom-8 right-6 z-40 w-80 pointer-events-none flex flex-col">
      <div className="flex-1 overflow-y-auto pl-3 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
        {/* Header + score ring */}
        <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
              Celda {cell.id}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `conic-gradient(${color} ${cell.score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
            >
              <div className="rounded-full bg-[#0a0b0e] flex flex-col items-center justify-center"
                   style={{ width: "3.75rem", height: "3.75rem" }}>
                <span className="text-2xl font-black text-white num leading-none">{cell.score}</span>
                <span className="text-[8px] text-text-muted uppercase tracking-widest">score</span>
              </div>
            </div>
            <div>
              <span
                className="px-2.5 py-1 rounded text-[9px] font-black tracking-widest uppercase border"
                style={{ color, borderColor: `${color}66`, background: `${color}1a` }}
              >
                {CATEGORY_LABEL[cell.category]}
              </span>
              <div className="mt-2 text-[10px] text-text-muted">{cell.zona}</div>
            </div>
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Factores</span>
          </div>
          <div className="space-y-2.5">
            <FactorBar label="FWI (clima)" value={cell.factors.fwi} />
            <FactorBar label="Historial" value={cell.factors.historial} />
            <FactorBar label="Terreno" value={cell.factors.terreno} />
          </div>
        </div>

        {/* Loading state while Overpass + Mistral respond */}
        {loading && (
          <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[11px]">Analizando infraestructura e impacto…</span>
          </div>
        )}

        {/* Detail — infrastructure, AI, priority */}
        {!loading && detail && (
          <>
            <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                  Infraestructura cercana
                </span>
              </div>
              {detail.infrastructure.length > 0 ? (
                <div className="space-y-1.5">
                  {detail.infrastructure.slice(0, 8).map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-white/5 last:border-0">
                      <span className="text-white truncate mr-2">
                        <span className="text-text-muted">{INFRA_LABEL[i.type] ?? i.type}</span> · {i.name}
                      </span>
                      <span className="text-blue font-bold num shrink-0">{i.distance_km} km</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-text-muted">{detail.social_impact.resumen}</div>
              )}
            </div>

            {detail.explicacion && (
              <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Análisis IA</span>
                </div>
                <p className="text-[12px] text-text-2 leading-relaxed mb-3">{detail.explicacion}</p>
                {detail.recomendaciones.length > 0 && (
                  <ul className="space-y-1.5">
                    {detail.recomendaciones.map((r, idx) => (
                      <li key={idx} className="text-[11px] text-orange-soft flex gap-2">
                        <span className="text-orange">▸</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                Prioridad de intervención
              </span>
              <span className="px-2.5 py-1 rounded text-[9px] font-black tracking-widest uppercase border border-red/40 bg-red/10 text-red">
                {PRIORITY_LABEL[detail.prioridad] ?? detail.prioridad}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: unchanged from Task 14 — no new errors from `fire-risk-cell-panel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/fire-risk-cell-panel.tsx
git commit -m "feat(frontend): add fire-risk cell detail panel"
```

---

### Task 16: frontend — grid layer in mapbox-panel

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx`

- [ ] **Step 1: Update imports and props**

In `frontend/components/dashboard/mapbox-panel.tsx`, add to the imports at the top:

```ts
import type { FireRiskGrid, FireRiskCell } from '@/hooks/use-socket'
import { cellPolygon } from '@/lib/risk-grid'
```

Replace the component signature (lines 107-115) with:

```tsx
export function MapboxPanel({
  riskGrid,
  onCellClick,
  activeExpansion,
  setActiveExpansion
}: {
  riskGrid: FireRiskGrid | null,
  onCellClick: (cell: FireRiskCell) => void,
  activeExpansion: ExpansionKey | null,
  setActiveExpansion: (k: ExpansionKey | null) => void
}) {
```

- [ ] **Step 2: Add a stable ref for the click callback**

Right after the `userCoords` line (`const userCoords = useGeolocation()`, line 122), add:

```tsx
  const onCellClickRef = useRef(onCellClick)
  onCellClickRef.current = onCellClick
```

- [ ] **Step 3: Replace the heatmap effect with the grid effect**

Delete the entire heatmap `useEffect` block (currently lines 459-507, the one whose `apply` handles `prediction-heatmap` / `prediction-grid`). Replace it with these two effects:

```tsx
  // Grid source + fill/line layers — rebuilt whenever the grid changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const apply = () => {
      if (!map.getStyle()) return
      const fillId = 'risk-grid-fill'
      const lineId = 'risk-grid-line'
      const srcId = 'risk-grid-src'
      if (map.getLayer(fillId)) map.removeLayer(fillId)
      if (map.getLayer(lineId)) map.removeLayer(lineId)
      if (map.getSource(srcId)) map.removeSource(srcId)

      if (!riskGrid) return

      const features = riskGrid.cells.map(c => ({
        type: 'Feature' as const,
        properties: {
          id: c.id,
          category: c.category,
          score: c.score,
          fwi: c.factors.fwi,
          historial: c.factors.historial,
          terreno: c.factors.terreno,
          zona: c.zona,
          lat: c.lat,
          lon: c.lon,
          size: c.size,
        },
        geometry: { type: 'Polygon' as const, coordinates: cellPolygon(c) },
      }))

      map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features } as any,
      })
      map.addLayer({
        id: fillId, type: 'fill', source: srcId,
        paint: {
          'fill-color': [
            'match', ['get', 'category'],
            'bajo', '#22c55e',
            'medio', '#eab308',
            'alto', '#f97316',
            'critico', '#ef4444',
            '#22c55e',
          ],
          'fill-opacity': 0.35,
        },
      })
      map.addLayer({
        id: lineId, type: 'line', source: srcId,
        paint: { 'line-color': 'rgba(255,255,255,0.15)', 'line-width': 0.5 },
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [riskGrid, mapLoaded])

  // Grid interactivity — registered once for the fixed layer id.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const fillId = 'risk-grid-fill'
    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as any
      onCellClickRef.current({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        size: p.size,
        score: p.score,
        category: p.category,
        factors: { fwi: p.fwi, historial: p.historial, terreno: p.terreno },
        zona: p.zona,
      })
    }
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }

    map.on('click', fillId, onClick)
    map.on('mouseenter', fillId, onEnter)
    map.on('mouseleave', fillId, onLeave)

    return () => {
      map.off('click', fillId, onClick)
      map.off('mouseenter', fillId, onEnter)
      map.off('mouseleave', fillId, onLeave)
    }
  }, [mapLoaded])
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors only in `map-panel.tsx` (still passes `showHeatmap` — fixed next task). No errors in `mapbox-panel.tsx`.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(frontend): render fire-risk grid layer with cell clicks"
```

---

### Task 17: frontend — wire toggle, fetch and panel in map-panel

**Files:**
- Modify: `frontend/components/dashboard/map-panel.tsx`

- [ ] **Step 1: Replace map-panel.tsx**

Overwrite `frontend/components/dashboard/map-panel.tsx` with:

```tsx
"use client"
import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { useSentinel } from "@/contexts/sentinel-context"
import type { FireRiskGrid, FireRiskCell, CellDetail } from "@/hooks/use-socket"
import { FireDetailOverlay } from "./fire-detail-overlay"
import { FireRiskCellPanel } from "./fire-risk-cell-panel"
import { SituationalOverlay } from "./situational-overlay"
import { TacticalExpansionWidget } from "./tactical-expansion-widget"

const MapboxPanel = dynamic(
  () => import("./mapbox-panel").then((m) => m.MapboxPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export function MapPanel() {
  const { sentinelUpdate: u } = useSentinel()
  const fires = u?.fires ?? []
  const [activeExpansion, setActiveExpansion] = useState<'2h' | '6h' | '12h' | null>(null)

  const [showGrid, setShowGrid] = useState(false)
  const [riskGrid, setRiskGrid] = useState<FireRiskGrid | null>(null)
  const [gridLoading, setGridLoading] = useState(false)
  const [gridError, setGridError] = useState<string | null>(null)

  const [selectedCell, setSelectedCell] = useState<FireRiskCell | null>(null)
  const [cellDetail, setCellDetail] = useState<CellDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const toggleGrid = useCallback(async () => {
    const next = !showGrid
    setShowGrid(next)
    if (next && !riskGrid && !gridLoading) {
      setGridLoading(true)
      setGridError(null)
      try {
        const res = await fetch('/api/risk-grid')
        const data = await res.json()
        if (data.ok) setRiskGrid(data.grid as FireRiskGrid)
        else setGridError(data.error ?? 'Error al cargar la grilla')
      } catch {
        setGridError('Backend inalcanzable')
      } finally {
        setGridLoading(false)
      }
    }
  }, [showGrid, riskGrid, gridLoading])

  const handleCellClick = useCallback(async (cell: FireRiskCell) => {
    setSelectedCell(cell)
    setCellDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch('/api/cell-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cell }),
      })
      const data = await res.json()
      if (data.ok) setCellDetail(data.detail as CellDetail)
    } catch {
      /* keep panel open with no detail — score + factors still shown */
    } finally {
      setDetailLoading(false)
    }
  }, [])

  return (
    <div className="relative flex-1 flex flex-col bg-[#04050a] min-h-0 overflow-hidden">
      <div className="flex-1 relative min-h-0 group">
        {/* Deep Space / Aura Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 map-aura" />
          <div className="absolute top-[10%] left-[20%] w-[60%] h-[60%] nebula-glow" style={{ '--color': 'rgba(249, 115, 22, 0.05)', '--x': '30%', '--y': '40%' } as any} />
          <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] nebula-glow" style={{ '--color': 'rgba(59, 130, 246, 0.08)', '--x': '70%', '--y': '60%' } as any} />
        </div>

        {/* Base Layer: Mapbox */}
        <MapboxPanel
          riskGrid={showGrid ? riskGrid : null}
          onCellClick={handleCellClick}
          activeExpansion={activeExpansion}
          setActiveExpansion={setActiveExpansion}
        />

        {/* Fire Details Overlay */}
        <FireDetailOverlay />

        {/* Fire Risk Cell Panel */}
        <FireRiskCellPanel
          cell={selectedCell}
          detail={cellDetail}
          loading={detailLoading}
          onClose={() => { setSelectedCell(null); setCellDetail(null) }}
        />

        {/* Situational Intelligence Overlay */}
        <SituationalOverlay />

        {/* Tactical Expansion HUD (Fixed Right side) */}
        <TacticalExpansionWidget
          activeExpansion={activeExpansion}
          onExpansionChange={(k) => setActiveExpansion(prev => prev === k ? null : k)}
        />

        {/* HUD: Grid & Corners */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-0 opacity-[0.15] mix-blend-screen bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)_0_0/48px_48px,linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)_0_0/48px_48px]" />
          <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t border-l border-white/20" />
          <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t border-r border-white/20" />
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b border-l border-white/20" />
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b border-r border-white/20" />
          <div className="absolute top-6 left-6 px-2.5 py-1.5 bg-[#0a0b0e/75] border border-border-2 rounded-sm backdrop-blur-md flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium text-text-2 tracking-wider">
              {fires.length > 0
                ? <>TRACKING <b className="text-foreground font-bold">{fires.length}</b> {fires.length === 1 ? "FIRE" : "FIRES"}</>
                : <b className="text-foreground font-bold">NO ACTIVE FIRES</b>}
            </span>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
            <div className="w-40 h-40 border border-white/30 rounded-full flex items-center justify-center">
              <div className="w-[1px] h-12 bg-white/40 absolute" />
              <div className="w-12 h-[1px] bg-white/40 absolute" />
            </div>
          </div>
        </div>

        {/* Fire Risk Grid toggle (floating control) */}
        <button
          onClick={toggleGrid}
          title={showGrid ? "Ocultar Fire Risk Grid" : "Mostrar Fire Risk Grid"}
          className={`absolute top-6 right-6 z-30 flex items-center gap-2 px-2.5 py-1.5 rounded-md backdrop-blur-md transition-all duration-200 ${
            showGrid
              ? "bg-red/12 border border-red/45 shadow-[0_0_14px_rgba(255,51,51,0.18)]"
              : "bg-[#0a0b0e]/75 border border-border-2 hover:border-red/40"
          }`}
        >
          {gridLoading
            ? <Loader2 className="w-2.5 h-2.5 animate-spin text-red" />
            : <div className={`w-2 h-2 rounded-full bg-red shadow-[0_0_6px_var(--red)] ${showGrid ? "animate-pulse" : "opacity-60"}`} />}
          <span className={`text-[9.5px] font-bold tracking-[0.14em] uppercase ${showGrid ? "text-red" : "text-text-dim"}`}>
            Fire Risk Grid
          </span>
        </button>

        {/* Grid load error */}
        {gridError && showGrid && (
          <div className="absolute top-16 right-6 z-30 px-2.5 py-1.5 rounded-md bg-red/15 border border-red/40 backdrop-blur-md">
            <span className="text-[9px] font-bold uppercase tracking-wider text-red">{gridError}</span>
          </div>
        )}

        {/* Scanline Overlay */}
        <div className="absolute inset-0 scanline-overlay z-20 opacity-[0.4] mix-blend-overlay" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck the whole frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/map-panel.tsx
git commit -m "feat(frontend): wire Fire Risk Grid toggle, fetch and cell panel"
```

---

### Task 18: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Build the backend packages**

Run: `cd backend/packages/agent-prediction && npm run build`
Then: `cd backend/packages/backend && npm run build`
Expected: both `tsc` builds complete with no errors.

- [ ] **Step 2: Run all agent-prediction tests**

Run: `cd backend/packages/agent-prediction && npx vitest run`
Expected: PASS — `zones.test.ts`, `grid.test.ts`, `cell-detail.test.ts` all green.

- [ ] **Step 3: Typecheck the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual browser verification**

Start the agents + backend (`cd backend && npm run dev`) and the frontend
(`cd frontend && pnpm dev` → http://localhost:3010). Ensure `AGENT_PREDICTION_URL`
points to the running agent-prediction (default `http://localhost:3006`).

Verify:
- The dashboard loads; the floating control reads **"Fire Risk Grid"**.
- Clicking the toggle shows a spinner, then ~2,500 colored cells appear over
  continental Chile (green/yellow/orange/red), no cells over the ocean.
- Toggling off hides the grid; toggling on again shows it instantly (no refetch).
- Clicking a cell opens the right-side panel with the score ring and factor bars
  immediately, then (after ~2-4 s) fills in infrastructure, AI analysis and the
  priority badge.
- Clicking a cell in a remote area with no OSM data still opens the panel and
  shows the "Sin infraestructura sensible" message instead of erroring.
- The base map, the fire hotspots layer and the expansion widget still behave
  exactly as before.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

Only if Step 4 surfaced fixes:

```bash
git add <changed files>
git commit -m "fix(fire-risk-grid): address end-to-end verification findings"
```

---

## Notes for the implementer

- **Render cold start:** the first `GET /api/risk-grid` after inactivity can take
  30-60 s while agent-prediction wakes. The toggle spinner covers this.
- **Overpass reliability:** `fetchInfrastructure` swallows all errors into `[]`.
  Never let an Overpass failure break `/cell-detail`.
- **Mistral degradation:** `buildCellDetail` keeps a score-based priority and
  empty text if the LLM call fails — the panel still renders.
- **`appendFireHistory`** stays in the orchestrator (Task 11) — it is what fills
  the `fire_hotspot_history` table that the historial factor reads.
- **Env:** `AGENT_PREDICTION_URL` must be set for the backend (it was already
  optional for the now-removed orchestrator call; it is now required by the two
  new routes — they return HTTP 502 with a clear message if it is missing).
