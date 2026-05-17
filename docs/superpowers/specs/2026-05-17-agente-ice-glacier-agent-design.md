# Agente Ice — Glacier Prediction Agent

**Date:** 2026-05-17  
**Branch:** `agente-ice`  
**Status:** Approved

---

## Context

The SENTINEL platform already has a complete glacier UI (`/glaciares` page) and partial backend (`agent-glacier` package with risk calculator and OpenRouter wrapper). The frontend calls `localhost:3006` for three routes that don't exist yet. The goal is to wire up the missing backend server and the missing `glacier-left-panel.tsx` component.

---

## What Already Exists (Do Not Touch)

**Backend:**
- `agent-glacier/src/risk-calculator.ts` — `calculateGlacierRisk(climate, history)` + `getRiskCategory(score)`
- `agent-glacier/src/openrouter.ts` — `callOpenRouter()` + `parseJSON()`
- `agent-glacier/data/glaciers-catalog.json` — 9 glaciers (lat/lon/altitude/area)
- `agent-glacier/data/copernicus-processed.json` — mass history 2020–2022 per glacier
- `agent-glacier/package.json` — Express, dotenv, axios, ts-node-dev configured

**Frontend (fully built, waiting on data):**
- `frontend/app/glaciares/page.tsx` — calls all 3 routes, manages loading/analyzing state
- `frontend/components/glaciares/glacier-map.tsx` — Mapbox map, markers, heatmap using `lastMassChange` property
- `frontend/components/glaciares/glacier-right-panel.tsx` — mass history chart (Recharts), climate stats, LLM analysis panels
- `frontend/components/glaciares/risk-indicator.tsx` — vulnerability bar

**Types (in `@sentinel/types`):**
- `GlacierInfo`, `GlacierClimateData`, `GlacierMassData`, `GlacierAnalysis` — all defined

---

## What to Build

### 1. `backend/packages/agent-glacier/src/analyze.ts`

Core analysis logic. Functions:

**`fetchGlacierClimate(lat, lon): Promise<GlacierClimateData>`**
- Calls OpenWeather `/data/2.5/weather?lat=&lon=&appid=&units=metric`
- Maps response:
  - `temp_avg` = `main.temp`
  - `temp_max` = `main.temp_max`
  - `precipitation_mm` = `rain?.["1h"] ?? 0`
  - `snowfall_cm` = `(snow?.["1h"] ?? 0) / 10` (mm → cm)
  - `days_above_zero` = estimated via altitude + current temp + hemisphere month (no extra API call)
  - `thermal_anomaly` = `main.temp - baselineTemp` where baseline is hardcoded per altitude range
- Requires `OPENWEATHER_API_KEY` env var (same key already used by main backend)

**`estimateDaysAboveZero(lat, altitudeM, currentTempC, monthOfYear): number`**
- If altitude > 4000m: base 5–15 days, scale with temp
- If altitude 1500–4000m: base 20–40 days
- If altitude < 1500m: base 40–80 days
- Adjust ±10 for hemisphere (Southern = invert months)

**`thermalBaseline(altitudeM): number`**
- Simple lookup: >4000m → -8°C, 2000–4000m → -3°C, <2000m → 2°C

**`buildPrediction(history, riskScore): { trend: string, estimated_years_to_critical: number | null }`**
- Calculate average annual mass change from Copernicus history
- Format trend: `"-1050 mm w.e./año (acelerando)"` or `"-850 mm w.e./año (estable)"`
- Estimate years to critical: if riskScore > 75 → null (already critical); else extrapolate linearly

**`buildGlacierAnalysis(glacierId): Promise<GlacierAnalysis>`**
1. Load catalog → find `GlacierInfo`
2. Load Copernicus data → `GlacierMassData[]`
3. `fetchGlacierClimate(lat, lon)` → `GlacierClimateData`
4. `calculateGlacierRisk(climate, history)` → `riskIndex`
5. `getRiskCategory(riskIndex)` → `riskCategory`
6. `buildPrediction(history, riskIndex)` → `prediction`
7. LLM call → `llmAnalysis`

**LLM prompt:**
```
System: Eres un glaciólogo experto en criosfera global. Recibes datos de un glaciar
(nombre, ubicación, historial de masa, índice de riesgo, datos climáticos actuales).
Responde SOLO con JSON válido sin texto adicional:
{
  "summary": "...",
  "riskExplanation": "...",
  "prediction": "...",
  "urgentActions": ["...", "..."],
  "monitoringRecommendations": ["...", "..."],
  "publicAlert": "..."
}

User: [JSON con todos los datos del glaciar]
```

---

### 2. `backend/packages/agent-glacier/src/index.ts`

Express server on port `3006`:

| Route | Method | Body | Response |
|---|---|---|---|
| `/glaciers` | GET | — | `AgentResponse<GlacierInfo[]>` |
| `/analyze` | POST | `{ glacierId: string }` | `AgentResponse<GlacierAnalysis>` |
| `/glaciers/risk-grid` | GET | — | `AgentResponse<GeoJSON FeatureCollection>` |
| `/health` | GET | — | `{ ok: true, service: 'agent-glacier' }` |

**`/glaciers/risk-grid`** returns a GeoJSON FeatureCollection where each glacier is a Point feature with property `lastMassChange` (the most recent year's mass_change_mmwe from Copernicus). The map heatmap already reads this property via `["get", "lastMassChange"]`.

Error handling: each route catches and returns `{ success: false, data: null, error: string }`.

---

### 3. `frontend/components/glaciares/glacier-left-panel.tsx`

List panel showing all glaciers with quick risk badge.

- Quick risk calculated **client-side from mass history only** (no climate data, no API call):
  - last `mass_change_mmwe < -1500` → CRITICO
  - `< -1000` → ALTO
  - `< -500` → MEDIO
  - else → BAJO
- This avoids 9 parallel `/analyze` calls on load
- Shows: glacier name, region/country, quick risk badge, area_km2 if available
- Click → calls parent's `onGlacierSelect(id)`
- Selected state: highlighted border

Props: `{ glaciers: GlacierInfo[], selectedGlacierId: string | null, onGlacierSelect: (id: string) => void, loading: boolean }`

Note: `GlacierInfo` doesn't include mass history. The left panel needs mass history for quick risk. Two options:
- **Option A (chosen):** Extend `/glaciers` endpoint to return `GlacierInfo & { lastMassChange: number }[]` — the panel reads this extra field. No new type needed in shared types (use inline type).
- Option B: hardcode quick risk per glacier in frontend (fragile).

---

### 4. `backend/package.json` — Add glacier to `dev` script

Add `glacier` to the `concurrently` command in the root `backend/package.json`:

```
"npm run dev -w packages/agent-glacier"
```

Port 3006 (already hardcoded in frontend).

---

## Data Flow

```
User clicks glaciar in left panel
  → page.tsx: setSelectedGlacierId + POST /analyze { glacierId }
  → agent-glacier: fetchGlacierClimate (OpenWeather) + load Copernicus
  → calculateGlacierRisk + LLM
  → GlacierAnalysis → right panel renders: mass chart + climate stats + LLM analysis

Map load
  → glacier-map.tsx: GET /glaciers/risk-grid
  → heatmap weighted by lastMassChange

Page load
  → GET /glaciers → left panel list with quick risk badges
```

---

## Environment Variables Required

```
OPENWEATHER_API_KEY    # same key as main backend
OPENROUTER_API_KEY     # same key as other agents
PORT                   # defaults to 3006
```

---

## Out of Scope

- Real-time polling of glacier data
- Historical OpenWeather data (forecast endpoint costs more)
- Adding new glaciers to the catalog
- Changes to existing frontend components (glacier-map, glacier-right-panel, risk-indicator)
- Changes to shared types
