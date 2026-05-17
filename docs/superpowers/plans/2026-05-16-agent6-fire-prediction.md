# A6 Fire Prediction Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `agent-prediction` (port 3006) that computes a fire ignition risk heatmap using FWI + Supabase historical hotspots + Mistral LLM analysis, integrated into the existing orchestrator pipeline.

**Architecture:** New Express microservice following the same A1–A5 agent contract (`POST /analyze → AgentResponse<PredictionResult>`). FWI grid built deterministically from weather data; historical hotspot weights read from Supabase `fire_hotspot_history` (accumulated by orchestrator on every run); top 15 risk cells sent to Mistral for natural language analysis per time horizon.

**Tech Stack:** TypeScript, Express, Vitest, `@supabase/supabase-js`, OpenRouter (Mistral), `@sentinel/types`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `backend/packages/agent-prediction/package.json` | Package manifest |
| Create | `backend/packages/agent-prediction/tsconfig.json` | TS config (extends base) |
| Create | `backend/packages/agent-prediction/src/openrouter.ts` | Mistral client |
| Create | `backend/packages/agent-prediction/src/analyze.ts` | FWI grid + Supabase + scoring + LLM |
| Create | `backend/packages/agent-prediction/src/index.ts` | Express server port 3006 |
| Create | `backend/packages/agent-prediction/src/analyze.test.ts` | Unit tests for pure functions |
| Modify | `backend/shared/types/index.ts` | Add PredictionCell, PredictionResult, SentinelUpdate.prediction |
| Create | `backend/packages/backend/src/services/fire-history.ts` | Write FIRMS → Supabase fire_hotspot_history |
| Modify | `backend/packages/backend/src/services/orchestrator.ts` | Extract temp, write history, call A6, return prediction |
| Modify | `backend/package.json` | Add agent-prediction to dev script |

---

## Task 1: Supabase — create fire_hotspot_history table

**Files:** SQL run directly in Supabase dashboard (no migration file needed)

- [ ] **Step 1: Run this SQL in Supabase SQL editor**

```sql
CREATE TABLE IF NOT EXISTS fire_hotspot_history (
  id          bigserial PRIMARY KEY,
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  frp         double precision,
  brightness  double precision,
  timestamp   timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fire_hotspot_history_timestamp_idx ON fire_hotspot_history (timestamp);
CREATE INDEX IF NOT EXISTS fire_hotspot_history_lat_lon_idx ON fire_hotspot_history (lat, lon);
```

- [ ] **Step 2: Verify table exists**

In Supabase Table Editor, confirm `fire_hotspot_history` appears with the 6 columns.

---

## Task 2: Add types to @sentinel/types

**Files:**
- Modify: `backend/shared/types/index.ts`

- [ ] **Step 1: Add PredictionCell and PredictionResult interfaces**

In `backend/shared/types/index.ts`, after the `RoutesResult` interface (around line 154), add:

```typescript
export interface PredictionCell {
  lat: number
  lon: number
  risk_score: number        // 0-1 combined (FWI × 0.6 + historical × 0.4)
  fwi_score: number         // 0-1 weather-only component
  historical_weight: number // 0-1 history-only component
}

export interface PredictionResult {
  grid: PredictionCell[]
  top_zones: Array<{
    lat: number
    lon: number
    risk_score: number
    zona: string    // human-readable zone name from LLM
    razon: string   // why this zone is at risk, from LLM
  }>
  analisis_6h: string
  analisis_24h: string
  analisis_72h: string
  confianza: 'baja' | 'media' | 'alta'
}
```

- [ ] **Step 2: Add prediction field to SentinelUpdate**

In the `SentinelUpdate` interface, after `naturalRoutes?: NaturalRoutes`, add:

```typescript
  prediction?: PredictionResult
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit -p shared/types/tsconfig.json 2>/dev/null || npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add shared/types/index.ts
git commit -m "feat(types): add PredictionCell, PredictionResult, SentinelUpdate.prediction"
```

---

## Task 3: Scaffold agent-prediction package

**Files:**
- Create: `backend/packages/agent-prediction/package.json`
- Create: `backend/packages/agent-prediction/tsconfig.json`

- [ ] **Step 1: Create package.json**

Create `backend/packages/agent-prediction/package.json`:

```json
{
  "name": "@sentinel/agent-prediction",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@sentinel/types": "*",
    "@supabase/supabase-js": "^2.105.4",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.0",
    "tsx": "^4.7.2",
    "typescript": "^5.4.5",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `backend/packages/agent-prediction/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd backend && npm install
```

Expected: `@sentinel/agent-prediction` appears in workspace. No errors.

---

## Task 4: Create openrouter.ts (copy from agent-fire)

**Files:**
- Create: `backend/packages/agent-prediction/src/openrouter.ts`

- [ ] **Step 1: Create the file**

Create `backend/packages/agent-prediction/src/openrouter.ts`:

```typescript
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const MODELS = {
  large: 'mistralai/mistral-large',
  small: 'mistralai/mistral-large',
} as const

export async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sentinel.vercel.app',
      'X-Title': 'SENTINEL',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

export function parseJSON<T>(raw: string, agentName: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as T
    throw new Error(`${agentName} output no es JSON válido:\n${raw}`)
  }
}
```

---

## Task 5: Write tests for pure functions in analyze.ts

**Files:**
- Create: `backend/packages/agent-prediction/src/analyze.test.ts`

These tests cover the deterministic math before the file exists — write them first, run them failing, then implement.

- [ ] **Step 1: Create the test file**

Create `backend/packages/agent-prediction/src/analyze.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildFwiGrid, combineScores, toTempCelsius } from './analyze'
import type { WeatherData } from '@sentinel/types'

describe('toTempCelsius', () => {
  it('returns value as-is if likely already Celsius (< 100)', () => {
    expect(toTempCelsius(25)).toBe(25)
  })

  it('converts Kelvin to Celsius if value > 100', () => {
    expect(toTempCelsius(298.15)).toBeCloseTo(25, 1)
  })

  it('uses fallback 20 if undefined', () => {
    expect(toTempCelsius(undefined)).toBe(20)
  })
})

describe('buildFwiGrid', () => {
  const hotDryWindy: WeatherData = { speed: 15, deg: 270, humidity: 20, temp: 35 }
  const coldWet: WeatherData = { speed: 1, deg: 0, humidity: 90, temp: 5 }

  it('returns array of cells covering the region', () => {
    const grid = buildFwiGrid(hotDryWindy)
    // Region lat [-45,-30] lon [-76,-66] at 0.25° resolution
    // lat steps: (15/0.25)=60, lon steps: (10/0.25)=40 → 2400 cells
    expect(grid.length).toBe(2400)
  })

  it('hot dry windy conditions produce higher fwi_score than cold wet', () => {
    const hotGrid = buildFwiGrid(hotDryWindy)
    const coldGrid = buildFwiGrid(coldWet)
    const avgHot = hotGrid.reduce((s, c) => s + c.fwi_score, 0) / hotGrid.length
    const avgCold = coldGrid.reduce((s, c) => s + c.fwi_score, 0) / coldGrid.length
    expect(avgHot).toBeGreaterThan(avgCold)
  })

  it('all fwi_score values are between 0 and 1', () => {
    const grid = buildFwiGrid(hotDryWindy)
    for (const cell of grid) {
      expect(cell.fwi_score).toBeGreaterThanOrEqual(0)
      expect(cell.fwi_score).toBeLessThanOrEqual(1)
    }
  })

  it('historical_weight is 0 for all cells when no history provided', () => {
    const grid = buildFwiGrid(hotDryWindy)
    for (const cell of grid) {
      expect(cell.historical_weight).toBe(0)
    }
  })
})

describe('combineScores', () => {
  it('applies 0.6 FWI + 0.4 historical weighting', () => {
    const cells = [{ lat: -38, lon: -72, fwi_score: 1, historical_weight: 1, risk_score: 0 }]
    const result = combineScores(cells)
    expect(result[0].risk_score).toBeCloseTo(1.0, 5) // 0.6×1 + 0.4×1
  })

  it('filters out cells with risk_score <= 0.2', () => {
    const cells = [
      { lat: -38, lon: -72, fwi_score: 0.1, historical_weight: 0, risk_score: 0 },
      { lat: -39, lon: -73, fwi_score: 0.8, historical_weight: 0.5, risk_score: 0 },
    ]
    const result = combineScores(cells)
    // 0.1×0.6 + 0×0.4 = 0.06 → filtered
    // 0.8×0.6 + 0.5×0.4 = 0.68 → kept
    expect(result.length).toBe(1)
    expect(result[0].lat).toBe(-39)
  })

  it('risk_score stays between 0 and 1', () => {
    const cells = [{ lat: -38, lon: -72, fwi_score: 1, historical_weight: 1, risk_score: 0 }]
    const result = combineScores(cells)
    expect(result[0].risk_score).toBeLessThanOrEqual(1)
    expect(result[0].risk_score).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail (functions not yet exported)**

```bash
cd backend/packages/agent-prediction && npx vitest run src/analyze.test.ts
```

Expected: `FAIL` — `Cannot find module './analyze'` or export errors.

---

## Task 6: Implement analyze.ts

**Files:**
- Create: `backend/packages/agent-prediction/src/analyze.ts`

- [ ] **Step 1: Create analyze.ts**

Create `backend/packages/agent-prediction/src/analyze.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { WeatherData, FireData, PredictionCell, PredictionResult } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

// Region bounds for Patagonia/Araucanía
const LAT_MIN = -45
const LAT_MAX = -30
const LON_MIN = -76
const LON_MAX = -66
const CELL_DEG = 0.25

// OpenWeather may return temp in Kelvin (>100) or Celsius (<100)
export function toTempCelsius(temp: number | undefined): number {
  if (temp === undefined) return 20
  return temp > 100 ? temp - 273.15 : temp
}

// Build FWI score grid from weather — uniform across region (same conditions)
// historical_weight starts at 0; combineScores adds it later
export function buildFwiGrid(weather: WeatherData): PredictionCell[] {
  const tempC = toTempCelsius(weather.temp)
  const drought = (100 - weather.humidity) / 100
  const wind = Math.min(weather.speed / 20, 1)
  const temp = Math.max(0, (tempC - 15) / 25)
  const fwi_score = Math.min(drought * 0.5 + wind * 0.3 + temp * 0.2, 1)

  const cells: PredictionCell[] = []
  for (let lat = LAT_MIN; lat < LAT_MAX; lat += CELL_DEG) {
    for (let lon = LON_MIN; lon < LON_MAX; lon += CELL_DEG) {
      cells.push({
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
        fwi_score,
        historical_weight: 0,
        risk_score: 0,
      })
    }
  }
  return cells
}

// Apply historical weights and compute final risk_score, filter low-risk cells
export function combineScores(cells: PredictionCell[]): PredictionCell[] {
  return cells
    .map(c => ({
      ...c,
      risk_score: Math.min(c.fwi_score * 0.6 + c.historical_weight * 0.4, 1),
    }))
    .filter(c => c.risk_score > 0.2)
}

// Snap a coordinate to the 0.25° grid
function snapToGrid(v: number): number {
  return Math.round(Math.floor(v / CELL_DEG) * CELL_DEG * 100) / 100
}

// Query Supabase for historical hotspot counts per 0.25° cell (last 30 days)
// Returns map of "lat,lon" → count. Returns empty map on any error.
async function fetchHistoricalWeights(): Promise<Map<string, number>> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return new Map()

  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('fire_hotspot_history')
      .select('lat, lon')
      .gte('timestamp', since)

    if (error || !data) return new Map()

    const counts = new Map<string, number>()
    for (const row of data) {
      const key = `${snapToGrid(row.lat as number)},${snapToGrid(row.lon as number)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  } catch {
    return new Map()
  }
}

// Determine confidence level based on distinct days of history
async function fetchConfidence(): Promise<'baja' | 'media' | 'alta'> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return 'baja'

  try {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await client
      .from('fire_hotspot_history')
      .select('timestamp')
      .gte('timestamp', since)
      .limit(1000)

    if (error || !data || data.length === 0) return 'baja'

    const days = new Set(data.map(r => (r.timestamp as string).slice(0, 10)))
    if (days.size >= 7) return 'alta'
    if (days.size >= 1) return 'media'
    return 'baja'
  } catch {
    return 'baja'
  }
}

// Apply historical weights to grid cells
function applyHistory(cells: PredictionCell[], counts: Map<string, number>): PredictionCell[] {
  if (counts.size === 0) return cells
  const maxCount = Math.max(...counts.values())
  return cells.map(c => {
    const key = `${c.lat},${c.lon}`
    const count = counts.get(key) ?? 0
    return { ...c, historical_weight: count / maxCount }
  })
}

// LLM analysis of top risk zones
async function runLLM(
  topCells: PredictionCell[],
  weather: WeatherData,
): Promise<Pick<PredictionResult, 'top_zones' | 'analisis_6h' | 'analisis_24h' | 'analisis_72h'>> {
  const system = `Eres un experto en predicción de incendios forestales en la región de Patagonia y Araucanía (Chile-Argentina).
Recibes datos de riesgo de ignición calculados con el Índice de Peligro de Incendio (FWI) y patrones históricos.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "top_zones": [
    {
      "lat": número,
      "lon": número,
      "risk_score": número,
      "zona": "nombre descriptivo de la zona geográfica",
      "razon": "explicación breve de por qué está en riesgo"
    }
  ],
  "analisis_6h": "análisis de riesgo para las próximas 6 horas",
  "analisis_24h": "análisis de riesgo para las próximas 24 horas",
  "analisis_72h": "análisis de riesgo para las próximas 72 horas"
}`

  const snapshot = {
    zonas_mayor_riesgo: topCells.slice(0, 15).map(c => ({
      lat: c.lat,
      lon: c.lon,
      risk_score: c.risk_score.toFixed(2),
      fwi: c.fwi_score.toFixed(2),
      historial: c.historical_weight.toFixed(2),
    })),
    clima_actual: {
      viento_ms: weather.speed,
      humedad_pct: weather.humidity,
      temp_c: toTempCelsius(weather.temp),
    },
  }

  const user = `Zonas de mayor riesgo de ignición (calculadas):\n${JSON.stringify(snapshot, null, 2)}\n\nGenera el análisis de predicción.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON(raw, 'Agent 6 (Prediction)')
}

export async function predictIgnitionRisk(
  weather: WeatherData,
): Promise<PredictionResult> {
  // 1. FWI grid (uniform weather across region)
  let cells = buildFwiGrid(weather)

  // 2. Historical weights from Supabase (degrades to empty map on failure)
  const [counts, confianza] = await Promise.all([
    fetchHistoricalWeights(),
    fetchConfidence(),
  ])
  cells = applyHistory(cells, counts)

  // 3. Combine scores + filter
  const grid = combineScores(cells)

  if (grid.length === 0) {
    return { grid: [], top_zones: [], analisis_6h: '', analisis_24h: '', analisis_72h: '', confianza }
  }

  // 4. Sort by risk_score descending, take top 15 for LLM
  const topCells = [...grid].sort((a, b) => b.risk_score - a.risk_score).slice(0, 15)

  // 5. LLM analysis (degrades gracefully)
  try {
    const llm = await runLLM(topCells, weather)
    return { grid, ...llm, confianza }
  } catch {
    return { grid, top_zones: [], analisis_6h: '', analisis_24h: '', analisis_72h: '', confianza }
  }
}
```

- [ ] **Step 2: Run tests — expect them to pass**

```bash
cd backend/packages/agent-prediction && npx vitest run src/analyze.test.ts
```

Expected: all tests `PASS`.

- [ ] **Step 3: Commit**

```bash
cd backend
git add packages/agent-prediction/src/analyze.ts packages/agent-prediction/src/analyze.test.ts packages/agent-prediction/src/openrouter.ts
git commit -m "feat(agent-prediction): core FWI grid, scoring, history query, LLM analysis"
```

---

## Task 7: Create index.ts (Express server)

**Files:**
- Create: `backend/packages/agent-prediction/src/index.ts`

- [ ] **Step 1: Create the file**

Create `backend/packages/agent-prediction/src/index.ts`:

```typescript
import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, PredictionResult } from '@sentinel/types'
import { predictIgnitionRisk } from './analyze'

const app = express()
app.use(express.json())

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const weather = body.weather ?? { speed: 0, deg: 0, humidity: 0 }

  try {
    const data = await predictIgnitionRisk(weather)
    res.json({ success: true, data } satisfies AgentResponse<PredictionResult>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<PredictionResult>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-prediction' }))

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => console.log(`[agent-prediction] running on port ${PORT}`))
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend/packages/agent-prediction && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd backend
git add packages/agent-prediction/src/index.ts packages/agent-prediction/package.json packages/agent-prediction/tsconfig.json
git commit -m "feat(agent-prediction): Express server port 3006"
```

---

## Task 8: Fix orchestrator — extract temp from OpenWeather

**Files:**
- Modify: `backend/packages/backend/src/services/orchestrator.ts:78-89`

The current `parseOpenWeatherResponse` extracts `speed`, `deg`, `humidity` but drops `main.temp`. A6 needs it.

- [ ] **Step 1: Update parseOpenWeatherResponse**

In `backend/packages/backend/src/services/orchestrator.ts`, find the `parseOpenWeatherResponse` function (lines 78-89) and replace it:

```typescript
function parseOpenWeatherResponse(v: unknown): WeatherData | null {
  if (typeof v !== 'object' || v === null) return null
  const w = v as Record<string, unknown>
  const wind = w.wind as Record<string, unknown> | undefined
  const main = w.main as Record<string, unknown> | undefined
  if (!wind || !main) return null
  const speed = typeof wind.speed === 'number' ? wind.speed : null
  const deg = typeof wind.deg === 'number' ? wind.deg : 0
  const humidity = typeof main.humidity === 'number' ? main.humidity : 0
  const temp = typeof main.temp === 'number' ? main.temp : undefined
  if (speed === null) return null
  return { speed, deg, humidity, temp, gust: typeof wind.gust === 'number' ? wind.gust : undefined }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd backend
git add packages/backend/src/services/orchestrator.ts
git commit -m "fix(orchestrator): extract main.temp from OpenWeather response for A6 FWI"
```

---

## Task 9: Create fire-history service

**Files:**
- Create: `backend/packages/backend/src/services/fire-history.ts`

This service writes FIRMS hotspots to Supabase on each orchestrator run, building the historical dataset A6 reads.

- [ ] **Step 1: Create the file**

Create `backend/packages/backend/src/services/fire-history.ts`:

```typescript
import type { FireData } from '@sentinel/types'
import { getSupabaseAdmin } from './supabase'

// Append current FIRMS hotspots to history table.
// Fire-and-forget — never throws, logs on failure.
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
```

- [ ] **Step 2: Call appendFireHistory from orchestrator**

In `backend/packages/backend/src/services/orchestrator.ts`:

At the top, add import:
```typescript
import { appendFireHistory } from './fire-history'
```

In `runAnalysis`, right after `const fires = ...` line (around line 118), add:
```typescript
  // Accumulate hotspots for A6 historical dataset (fire-and-forget)
  void appendFireHistory(fires)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd backend
git add packages/backend/src/services/fire-history.ts packages/backend/src/services/orchestrator.ts
git commit -m "feat(orchestrator): accumulate FIRMS hotspots in fire_hotspot_history for A6"
```

---

## Task 10: Wire A6 into orchestrator

**Files:**
- Modify: `backend/packages/backend/src/services/orchestrator.ts`

- [ ] **Step 1: Add AGENT_PREDICTION_URL and call A6 in Promise.allSettled**

In `orchestrator.ts`, find the section that declares agent URLs (around lines 134-138):

```typescript
  const fireUrl = requireEnv('AGENT_FIRE_URL')
  const weatherUrl = requireEnv('AGENT_WEATHER_URL')
  const airUrl = requireEnv('AGENT_AIR_URL')
  const routesUrl = requireEnv('AGENT_ROUTES_URL')
  const reportUrl = process.env.AGENT_REPORT_URL
```

Add after `reportUrl`:
```typescript
  const predictionUrl = process.env.AGENT_PREDICTION_URL
```

Find the `Promise.allSettled` call (around line 140) and add the A6 call:

```typescript
  const [fireSettled, weatherAgentSettled, airAgentSettled, routesSettled, predictionSettled] = await Promise.allSettled([
    callAgent<FireAnalysis>(fireUrl, { firms: fires, weather }),
    callAgent<unknown>(weatherUrl, { weather, firms: fires }),
    callAgent<AirAlerts>(airUrl, { openaq: airQuality, firms: fires }),
    callAgent<RoutesResult>(routesUrl, { firms: fires }),
    predictionUrl
      ? callAgent<PredictionResult>(predictionUrl, { weather, firms: fires })
      : Promise.reject(new Error('AGENT_PREDICTION_URL not set')),
  ])
```

Add the log line after existing rejected logs:
```typescript
  if (predictionSettled.status === 'rejected') console.warn('[orchestrator] agent-prediction failed:', predictionSettled.reason)
```

- [ ] **Step 2: Extract prediction result and include in SentinelUpdate**

After the existing `const routesResult = ...` extraction, add:

```typescript
  const predictionResult =
    predictionSettled.status === 'fulfilled' && predictionSettled.value.success
      ? predictionSettled.value.data
      : null
```

In the `return { ... }` statement at the end of `runAnalysis`, add:
```typescript
    prediction: predictionResult ?? undefined,
```

- [ ] **Step 3: Add PredictionResult to imports**

At the top of `orchestrator.ts`, find the type imports and add `PredictionResult`:

```typescript
import type {
  SentinelUpdate,
  AgentRequest,
  AgentResponse,
  FireData,
  WeatherData,
  AirData,
  GeoJSONFeature,
  FireAnalysis,
  AirAlerts,
  AuthorityReport,
  RoutesResult,
  PredictionResult,
} from '@sentinel/types'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add packages/backend/src/services/orchestrator.ts
git commit -m "feat(orchestrator): add A6 agent-prediction to pipeline (optional, fault-isolated)"
```

---

## Task 11: Register agent-prediction in dev script

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Add agent-prediction to concurrently command**

In `backend/package.json`, replace the `dev` script:

```json
"dev": "concurrently -n backend,fire,weather,air,routes,report,prediction -c cyan,red,blue,green,yellow,magenta,white \"npm run dev -w packages/backend\" \"npm run dev -w packages/agent-fire\" \"npm run dev -w packages/agent-weather\" \"npm run dev -w packages/agent-air\" \"npm run dev -w packages/agent-routes\" \"npm run dev -w packages/agent-report\" \"npm run dev -w packages/agent-prediction\""
```

- [ ] **Step 2: Verify dev starts without errors**

```bash
cd backend && npm run dev
```

Expected: 7 services start. `[prediction]` appears in console with `[agent-prediction] running on port 3006`.

Kill with Ctrl+C after verifying.

- [ ] **Step 3: Commit**

```bash
cd backend
git add package.json
git commit -m "chore(backend): add agent-prediction to dev script"
```

---

## Task 12: Smoke test end-to-end

- [ ] **Step 1: Start all services**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: Hit agent-prediction directly**

```bash
curl -s -X POST http://localhost:3006/analyze \
  -H "Content-Type: application/json" \
  -d '{"weather":{"speed":12,"deg":270,"humidity":25,"temp":32}}' | jq .
```

Expected response structure:
```json
{
  "success": true,
  "data": {
    "grid": [...],
    "top_zones": [...],
    "analisis_6h": "...",
    "analisis_24h": "...",
    "analisis_72h": "...",
    "confianza": "baja"
  }
}
```

`confianza` will be `"baja"` on first run (no history yet). `grid` should have cells with `risk_score > 0.2`.

- [ ] **Step 3: Verify health endpoint**

```bash
curl -s http://localhost:3006/health
```

Expected: `{"ok":true,"service":"agent-prediction"}`

- [ ] **Step 4: Final commit tag**

```bash
cd backend
git commit --allow-empty -m "chore: A6 agent-prediction smoke test passed"
```

---

## Deploy Checklist (Render)

After merging to main:

1. Create a new Render web service for `agent-prediction`:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build -w packages/agent-prediction`
   - **Start Command:** `npm run start -w packages/agent-prediction`
   - **Environment vars:** `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT`

2. Copy the new service URL, set it as `AGENT_PREDICTION_URL` in the **backend** service env vars on Render.

3. Verify by checking Render logs for `[agent-prediction] running on port ...`.
