# Agente Ice — Glacier Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `agent-glacier` Express server (port 3006) and `glacier-left-panel.tsx` so the existing `/glaciares` frontend page is fully functional.

**Architecture:** Agent-glacier is a standalone Express service (same pattern as agent-fire). It loads glacier catalog + Copernicus mass history from local JSON files, fetches current climate from OpenWeather, runs the existing risk calculator, calls an LLM for narrative analysis, and serves three routes the frontend already expects. The left panel shows a quick risk badge derived client-side from mass history so it doesn't trigger 9 parallel `/analyze` calls on load.

**Tech Stack:** TypeScript, Express 4, tsx (dev runner), vitest (tests), OpenWeather API, OpenRouter (mistral-large)

---

## File Map

| Action | File |
|---|---|
| **Modify** | `backend/packages/agent-glacier/package.json` — swap ts-node-dev for tsx, add vitest |
| **Create** | `backend/packages/agent-glacier/src/analyze.ts` — pure helpers + OpenWeather fetch + LLM analysis |
| **Create** | `backend/packages/agent-glacier/src/analyze.test.ts` — unit tests for pure functions |
| **Create** | `backend/packages/agent-glacier/src/index.ts` — Express server, 3 routes + health |
| **Modify** | `backend/package.json` — add glacier to `dev` concurrently script |
| **Create** | `frontend/components/glaciares/glacier-left-panel.tsx` — glacier list with quick risk badges |
| **Modify** | `frontend/app/glaciares/page.tsx` — update state type to `GlacierWithMass[]` |

---

## Task 1: Update agent-glacier package.json

Align package.json with agent-fire pattern: swap `ts-node-dev` / `axios` for `tsx` + `vitest`.

**Files:**
- Modify: `backend/packages/agent-glacier/package.json`

- [ ] **Step 1: Replace package.json content**

```json
{
  "name": "@sentinel/agent-glacier",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@sentinel/types": "*",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "tsx": "^4.7.2",
    "typescript": "^5.3.2",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && npm install
```

Expected: lock file updated, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/packages/agent-glacier/package.json backend/package-lock.json
git commit -m "chore(glacier): align package.json with agent-fire (tsx + vitest)"
```

---

## Task 2: Write failing tests for pure functions

Tests cover `estimateDaysAboveZero`, `thermalBaseline`, and `buildPrediction` before implementing them.

**Files:**
- Create: `backend/packages/agent-glacier/src/analyze.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from 'vitest'
import { estimateDaysAboveZero, thermalBaseline, buildPrediction } from './analyze'

describe('thermalBaseline', () => {
  it('returns -8 for altitude above 4000m', () => {
    expect(thermalBaseline(5000)).toBe(-8)
  })
  it('returns -3 for altitude 2000–4000m', () => {
    expect(thermalBaseline(3000)).toBe(-3)
  })
  it('returns 2 for altitude below 2000m', () => {
    expect(thermalBaseline(500)).toBe(2)
  })
})

describe('estimateDaysAboveZero', () => {
  it('returns fewer days for high altitude', () => {
    const highAlt = estimateDaysAboveZero(-46, 5000, -5, 7)
    const lowAlt = estimateDaysAboveZero(-46, 300, -5, 7)
    expect(highAlt).toBeLessThan(lowAlt)
  })
  it('returns 0 or more (never negative)', () => {
    const result = estimateDaysAboveZero(65, 4500, -20, 1)
    expect(result).toBeGreaterThanOrEqual(0)
  })
  it('returns 365 or fewer (never over a year)', () => {
    const result = estimateDaysAboveZero(0, 0, 30, 7)
    expect(result).toBeLessThanOrEqual(365)
  })
})

describe('buildPrediction', () => {
  it('returns trend string with year/mass and label', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -850 },
      { year: 2021, mass_change_mmwe: -920 },
      { year: 2022, mass_change_mmwe: -1050 },
    ]
    const { trend } = buildPrediction(history, 55)
    expect(trend).toContain('-1050')
    expect(trend).toContain('mm w.e./año')
  })

  it('returns null estimated_years_to_critical when riskScore > 75', () => {
    const history = [{ year: 2022, mass_change_mmwe: -2000 }]
    const { estimated_years_to_critical } = buildPrediction(history, 80)
    expect(estimated_years_to_critical).toBeNull()
  })

  it('returns "Sin datos" trend for empty history', () => {
    const { trend } = buildPrediction([], 30)
    expect(trend).toBe('Sin datos')
  })

  it('marks accelerating when last year worse than average', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -500 },
      { year: 2021, mass_change_mmwe: -600 },
      { year: 2022, mass_change_mmwe: -1000 },
    ]
    const { trend } = buildPrediction(history, 50)
    expect(trend).toContain('acelerando')
  })

  it('marks estable when last year not worse than average', () => {
    const history = [
      { year: 2020, mass_change_mmwe: -1000 },
      { year: 2021, mass_change_mmwe: -900 },
      { year: 2022, mass_change_mmwe: -800 },
    ]
    const { trend } = buildPrediction(history, 40)
    expect(trend).toContain('estable')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (analyze.ts doesn't exist yet)**

```bash
cd backend && npm test -w packages/agent-glacier
```

Expected: `Cannot find module './analyze'` or similar import error.

---

## Task 3: Implement pure functions in analyze.ts

Implement only the three pure functions tested in Task 2. No network calls yet.

**Files:**
- Create: `backend/packages/agent-glacier/src/analyze.ts`

- [ ] **Step 1: Create analyze.ts with pure functions only**

```typescript
import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { GlacierClimateData, GlacierMassData, GlacierInfo, GlacierAnalysis } from '@sentinel/types'
import { calculateGlacierRisk, getRiskCategory } from './risk-calculator'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

const catalog: GlacierInfo[] = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'glaciers-catalog.json'), 'utf-8')
)
const copernicus: Record<string, GlacierMassData[]> = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'copernicus-processed.json'), 'utf-8')
)

export function thermalBaseline(altitudeM: number): number {
  if (altitudeM > 4000) return -8
  if (altitudeM > 2000) return -3
  return 2
}

export function estimateDaysAboveZero(
  lat: number,
  altitudeM: number,
  currentTempC: number,
  monthOfYear: number
): number {
  // Southern hemisphere: summer is Dec–Feb, invert season lookup
  const isSouthern = lat < 0
  const effectiveMonth = isSouthern ? ((monthOfYear + 5) % 12) + 1 : monthOfYear
  const seasonalFactor =
    effectiveMonth >= 6 && effectiveMonth <= 8 ? 1.3
    : effectiveMonth <= 2 || effectiveMonth >= 12 ? 0.7
    : 1.0

  const baseDays = altitudeM > 4000 ? 10 : altitudeM > 2000 ? 30 : 60

  const baseline = thermalBaseline(altitudeM)
  const tempAdjust = Math.max(-10, Math.min(10, (currentTempC - baseline) * 2))

  return Math.max(0, Math.min(365, Math.round(baseDays * seasonalFactor + tempAdjust)))
}

export function buildPrediction(
  history: GlacierMassData[],
  riskScore: number
): { trend: string; estimated_years_to_critical: number | null } {
  if (history.length === 0) return { trend: 'Sin datos', estimated_years_to_critical: null }

  if (riskScore > 75) {
    const last = history[history.length - 1].mass_change_mmwe
    return { trend: `${last} mm w.e./año (crítico)`, estimated_years_to_critical: null }
  }

  const last = history[history.length - 1].mass_change_mmwe
  const avg = history.reduce((s, h) => s + h.mass_change_mmwe, 0) / history.length
  const accelerating = last < avg
  const trend = `${last} mm w.e./año (${accelerating ? 'acelerando' : 'estable'})`

  const pointsToGo = Math.max(0, 76 - riskScore)
  const annualRate = accelerating ? Math.abs(last - avg) : 0
  const years =
    annualRate > 0
      ? Math.round(pointsToGo / (annualRate / 100))
      : Math.round(pointsToGo * 2)

  return { trend, estimated_years_to_critical: years > 50 ? null : years }
}

// fetchGlacierClimate and buildGlacierAnalysis added in Task 4
export { catalog, copernicus }
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
cd backend && npm test -w packages/agent-glacier
```

Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/packages/agent-glacier/src/analyze.ts backend/packages/agent-glacier/src/analyze.test.ts
git commit -m "feat(glacier): pure analysis helpers with tests (thermalBaseline, estimateDaysAboveZero, buildPrediction)"
```

---

## Task 4: Add network functions to analyze.ts

Add `fetchGlacierClimate` (OpenWeather) and `buildGlacierAnalysis` (full pipeline). No unit tests — these call external APIs.

**Files:**
- Modify: `backend/packages/agent-glacier/src/analyze.ts`

- [ ] **Step 1: Replace the export line at the bottom with full implementations**

Remove this line from the file:
```typescript
// fetchGlacierClimate and buildGlacierAnalysis added in Task 4
export { catalog, copernicus }
```

Add these functions at the end of the file instead:

```typescript
export async function fetchGlacierClimate(
  lat: number,
  lon: number,
  altitudeM: number = 0
): Promise<GlacierClimateData> {
  const key = process.env.OPENWEATHER_API_KEY
  if (!key) throw new Error('OPENWEATHER_API_KEY is not set')

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`)

  const json = await res.json() as {
    main: { temp: number; temp_max: number }
    rain?: { '1h'?: number }
    snow?: { '1h'?: number }
  }

  const currentMonth = new Date().getMonth() + 1
  const temp_avg = Math.round(json.main.temp * 10) / 10
  const temp_max = Math.round(json.main.temp_max * 10) / 10
  const precipitation_mm = Math.round((json.rain?.['1h'] ?? 0) * 10) / 10
  const snowfall_cm = Math.round(((json.snow?.['1h'] ?? 0) / 10) * 10) / 10
  const days_above_zero = estimateDaysAboveZero(lat, altitudeM, temp_avg, currentMonth)
  const thermal_anomaly = Math.round((temp_avg - thermalBaseline(altitudeM)) * 10) / 10

  return { temp_avg, temp_max, precipitation_mm, snowfall_cm, days_above_zero, thermal_anomaly }
}

export async function buildGlacierAnalysis(glacierId: string): Promise<GlacierAnalysis> {
  const glacierInfo = catalog.find(g => g.id === glacierId)
  if (!glacierInfo) throw new Error(`Glaciar no encontrado: ${glacierId}`)

  const massHistory = copernicus[glacierId] ?? []
  const climateData = await fetchGlacierClimate(
    glacierInfo.lat,
    glacierInfo.lon,
    glacierInfo.altitude ?? 0
  )

  const riskIndex = calculateGlacierRisk(climateData, massHistory)
  const riskCategory = getRiskCategory(riskIndex)
  const prediction = buildPrediction(massHistory, riskIndex)

  const system = `Eres un glaciólogo experto en criosfera global. Recibes datos reales de un glaciar.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "summary": "resumen de 2-3 oraciones del estado actual del glaciar",
  "riskExplanation": "explicación técnica de los factores de riesgo principales",
  "prediction": "proyección narrativa del comportamiento esperado a 5-10 años",
  "urgentActions": ["acción 1", "acción 2", "acción 3"],
  "monitoringRecommendations": ["monitoreo 1", "monitoreo 2", "monitoreo 3"],
  "publicAlert": "mensaje de alerta pública en lenguaje ciudadano"
}`

  const user = `Glaciar: ${glacierInfo.name} (${glacierInfo.country}, ${glacierInfo.region})
Coordenadas: lat ${glacierInfo.lat}, lon ${glacierInfo.lon}, altitud ${glacierInfo.altitude ?? 'desconocida'} m
Área: ${glacierInfo.area_km2 ?? 'desconocida'} km²
Historial de masa Copernicus (mmwe): ${JSON.stringify(massHistory)}
Clima actual: temp promedio ${climateData.temp_avg}°C, máxima ${climateData.temp_max}°C, precipitación ${climateData.precipitation_mm}mm, nieve ${climateData.snowfall_cm}cm, días sobre 0°C estimados ${climateData.days_above_zero}, anomalía térmica ${climateData.thermal_anomaly}°C
Índice de vulnerabilidad: ${riskIndex}/100 (${riskCategory})
Tendencia de retroceso: ${prediction.trend}
Años estimados hasta estado crítico: ${prediction.estimated_years_to_critical ?? 'ya en estado crítico'}`

  const raw = await callOpenRouter(MODELS.large, system, user)
  const llmAnalysis = parseJSON<GlacierAnalysis['llmAnalysis']>(raw, 'agent-glacier')

  return { glacierInfo, climateData, massHistory, riskIndex, riskCategory, prediction, llmAnalysis }
}

export { catalog, copernicus }
```

- [ ] **Step 2: Run existing tests — must still pass**

```bash
cd backend && npm test -w packages/agent-glacier
```

Expected: all 8 tests still pass (pure functions unchanged).

- [ ] **Step 3: Commit**

```bash
git add backend/packages/agent-glacier/src/analyze.ts
git commit -m "feat(glacier): add fetchGlacierClimate (OpenWeather) and buildGlacierAnalysis pipeline"
```

---

## Task 5: Create index.ts (Express server)

Three routes the frontend already calls, plus `/health`.

**Files:**
- Create: `backend/packages/agent-glacier/src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
import 'dotenv/config'
import express from 'express'
import type { AgentResponse, GlacierInfo, GlacierMassData, GlacierAnalysis } from '@sentinel/types'
import { buildGlacierAnalysis, catalog, copernicus } from './analyze'

type GlacierWithMass = GlacierInfo & { lastMassChange: number }

const app = express()
app.use(express.json())

app.get('/glaciers', (_req, res) => {
  const data: GlacierWithMass[] = catalog.map(g => {
    const history: GlacierMassData[] = copernicus[g.id] ?? []
    const lastMassChange = history[history.length - 1]?.mass_change_mmwe ?? 0
    return { ...g, lastMassChange }
  })
  res.json({ success: true, data } satisfies AgentResponse<GlacierWithMass[]>)
})

app.post('/analyze', async (req, res) => {
  const { glacierId } = req.body as { glacierId?: string }
  if (!glacierId) {
    res.status(400).json({ success: false, data: null, error: 'glacierId required' } satisfies AgentResponse<GlacierAnalysis>)
    return
  }
  try {
    const data = await buildGlacierAnalysis(glacierId)
    res.json({ success: true, data } satisfies AgentResponse<GlacierAnalysis>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<GlacierAnalysis>)
  }
})

app.get('/glaciers/risk-grid', (_req, res) => {
  const features = catalog.map(g => {
    const history: GlacierMassData[] = copernicus[g.id] ?? []
    const lastMassChange = history[history.length - 1]?.mass_change_mmwe ?? 0
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [g.lon, g.lat] },
      properties: { id: g.id, name: g.name, lastMassChange },
    }
  })
  res.json({
    success: true,
    data: { type: 'FeatureCollection', features },
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-glacier' })
})

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => {
  console.log(`[agent-glacier] running on port ${PORT}`)
})
```

- [ ] **Step 2: Create a `.env` file for the agent (if it doesn't exist)**

```bash
ls backend/packages/agent-glacier/.env 2>/dev/null || echo "OPENWEATHER_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
PORT=3006" > backend/packages/agent-glacier/.env
```

Copy real key values from `backend/packages/backend/.env` or `backend/.env`.

- [ ] **Step 3: Start the agent and smoke-test**

```bash
cd backend && npm run dev -w packages/agent-glacier
```

In another terminal:
```bash
curl http://localhost:3006/health
```
Expected: `{"ok":true,"service":"agent-glacier"}`

```bash
curl http://localhost:3006/glaciers
```
Expected: `{"success":true,"data":[{"id":"glaciar-grey","name":"Glaciar Grey",...,"lastMassChange":-1050}, ...]}`

```bash
curl http://localhost:3006/glaciers/risk-grid
```
Expected: `{"success":true,"data":{"type":"FeatureCollection","features":[...]}}`

- [ ] **Step 4: Commit**

```bash
git add backend/packages/agent-glacier/src/index.ts
git commit -m "feat(glacier): Express server port 3006 — /glaciers, /analyze, /glaciers/risk-grid"
```

---

## Task 6: Update backend/package.json dev script

Add `glacier` to the `concurrently` command so `npm run dev` from `backend/` starts all agents including glacier.

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Update the dev script**

Current `dev` script:
```json
"dev": "concurrently -n backend,fire,weather,air,routes,report,prediction -c cyan,red,blue,green,yellow,magenta,white \"npm run dev -w packages/backend\" \"npm run dev -w packages/agent-fire\" \"npm run dev -w packages/agent-weather\" \"npm run dev -w packages/agent-air\" \"npm run dev -w packages/agent-routes\" \"npm run dev -w packages/agent-report\" \"npm run dev -w packages/agent-prediction\""
```

Replace with:
```json
"dev": "concurrently -n backend,fire,weather,air,routes,report,prediction,glacier -c cyan,red,blue,green,yellow,magenta,white,gray \"npm run dev -w packages/backend\" \"npm run dev -w packages/agent-fire\" \"npm run dev -w packages/agent-weather\" \"npm run dev -w packages/agent-air\" \"npm run dev -w packages/agent-routes\" \"npm run dev -w packages/agent-report\" \"npm run dev -w packages/agent-prediction\" \"npm run dev -w packages/agent-glacier\""
```

- [ ] **Step 2: Verify it starts**

```bash
cd backend && npm run dev
```

Expected: `[glacier]` appears in output, `[agent-glacier] running on port 3006`.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json
git commit -m "chore(glacier): add agent-glacier to monorepo dev script"
```

---

## Task 7: Create glacier-left-panel.tsx

Left panel that lists all glaciers with a quick risk badge computed from `lastMassChange` (no API call per glacier).

**Files:**
- Create: `frontend/components/glaciares/glacier-left-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import React from "react"
import { Snowflake, Loader2 } from "lucide-react"
import type { GlacierInfo } from "@sentinel/types"

type GlacierWithMass = GlacierInfo & { lastMassChange: number }

interface Props {
  glaciers: GlacierWithMass[]
  selectedGlacierId: string | null
  onGlacierSelect: (id: string) => void
  loading: boolean
}

function quickRisk(lastMassChange: number): { label: string; color: string } {
  if (lastMassChange < -1500) return { label: 'CRITICO', color: 'text-red border-red/40 bg-red/5' }
  if (lastMassChange < -1000) return { label: 'ALTO', color: 'text-orange border-orange/40 bg-orange/5' }
  if (lastMassChange < -500)  return { label: 'MEDIO', color: 'text-yellow border-yellow/40 bg-yellow/5' }
  return { label: 'BAJO', color: 'text-blue border-blue/40 bg-blue/5' }
}

export function GlacierLeftPanel({ glaciers, selectedGlacierId, onGlacierSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4 flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin text-text-muted" />
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Cargando…</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Snowflake className="w-3.5 h-3.5 text-blue" />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Glaciares</span>
          <span className="ml-auto text-[9px] font-bold text-white/20">{glaciers.length}</span>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-white/5">
        {glaciers.map(g => {
          const risk = quickRisk(g.lastMassChange)
          const isSelected = g.id === selectedGlacierId
          return (
            <button
              key={g.id}
              onClick={() => onGlacierSelect(g.id)}
              className={`w-full text-left px-4 py-3 transition-colors hover:bg-white/5 border-l-2 ${
                isSelected ? 'bg-white/5 border-l-[#00f2ff]' : 'border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                    {g.name}
                  </div>
                  <div className="text-[9px] text-text-muted font-bold mt-0.5 truncate">
                    {g.region} · {g.country}
                  </div>
                </div>
                <span className={`shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded border ${risk.color}`}>
                  {risk.label}
                </span>
              </div>
              {g.area_km2 != null && (
                <div className="text-[8px] text-white/20 font-mono mt-1">{g.area_km2} km²</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/glaciares/glacier-left-panel.tsx
git commit -m "feat(glacier): GlacierLeftPanel with quick risk badges from mass history"
```

---

## Task 8: Update page.tsx state type

`page.tsx` currently types glaciers state as `GlacierInfo[]` but the `/glaciers` endpoint now returns `GlacierInfo & { lastMassChange: number }[]`. Update the type so `GlacierLeftPanel` gets the data it needs.

**Files:**
- Modify: `frontend/app/glaciares/page.tsx`

- [ ] **Step 1: Add GlacierWithMass type and update state**

In `frontend/app/glaciares/page.tsx`, find:

```typescript
import type { GlacierInfo, GlacierAnalysis, AgentResponse } from "@sentinel/types"
```

Replace with:
```typescript
import type { GlacierInfo, GlacierAnalysis, AgentResponse } from "@sentinel/types"

type GlacierWithMass = GlacierInfo & { lastMassChange: number }
```

Find:
```typescript
const [glaciers, setSelectedGlaciers] = useState<GlacierInfo[]>([])
```

Replace with:
```typescript
const [glaciers, setSelectedGlaciers] = useState<GlacierWithMass[]>([])
```

Find:
```typescript
.then((res: AgentResponse<GlacierInfo[]>) => {
```

Replace with:
```typescript
.then((res: AgentResponse<GlacierWithMass[]>) => {
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/glaciares/page.tsx
git commit -m "feat(glacier): update glaciares page state to GlacierWithMass for left panel"
```

---

## Task 9: End-to-end smoke test

Verify the full flow works: agent running, frontend loading, left panel showing, analysis triggering.

- [ ] **Step 1: Start backend services**

```bash
cd backend && npm run dev
```

Confirm `[glacier] running on port 3006` in output.

- [ ] **Step 2: Start frontend**

```bash
cd frontend && pnpm dev
```

- [ ] **Step 3: Open `/glaciares`**

Navigate to `http://localhost:3010/glaciares`.

Verify:
- Left panel shows list of 9 glaciers with CRITICO/ALTO/MEDIO/BAJO badges
- Map renders with heatmap layer
- Clicking a glacier triggers "PROCESANDO DATOS SATELITALES..." loading state
- Right panel populates with: risk index bar, retroceso trend, años críticos, mass history chart (Recharts area), climate stats, LLM analysis sections

- [ ] **Step 4: Test `/analyze` directly**

```bash
curl -X POST http://localhost:3006/analyze \
  -H "Content-Type: application/json" \
  -d '{"glacierId":"glaciar-grey"}'
```

Expected: `{"success":true,"data":{"glacierInfo":{...},"climateData":{...},"massHistory":[...],"riskIndex":...,"riskCategory":"...","prediction":{...},"llmAnalysis":{...}}}`
