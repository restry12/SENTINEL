# A6 — Fire Ignition Prediction Agent

**Date:** 2026-05-16  
**Status:** Approved  
**Scope:** Backend only (`packages/agent-prediction`). Frontend integration documented separately at bottom.

## Goal

Predict zones where new fires are likely to ignite — not where existing fires spread.  
Output: heatmap grid of risk cells + LLM natural language analysis per time horizon.

## Architecture

New Express microservice `packages/agent-prediction`, port 3006.  
Same agent contract as A1–A5:

```
POST /analyze
Body: AgentRequest { firms: FireData[], weather: WeatherData }
Response: { success: true, data: PredictionResult } | { success: false, data: null, error: string }
```

### Internal Pipeline

```
1. Build FWI grid
   - Region: lat [-45, -30], lon [-76, -66]
   - Resolution: 0.25° per cell (~27km) — ~2400 cells total
   - Per cell: fwi_score = drought(0.5) + wind(0.3) + temp(0.2)
     drought  = (100 - humidity) / 100
     wind     = min(wind_speed_ms / 20, 1)
     temp     = max(0, ((temp_c ?? 20) - 15) / 25)
     Note: WeatherData.temp is optional. Fallback 20°C if absent.
     Dependency: orchestrator.parseOpenWeatherResponse must extract main.temp (currently it does not).

2. Query Supabase fire_hotspot_history (last 30 days)
   - Group by 0.25° cell, count occurrences
   - Normalize: historical_weight = count / max_count_in_region
   - If no data → historical_weight = 0 for all cells

3. Combine scores
   risk_score = (fwi_score × 0.6) + (historical_weight × 0.4)
   Filter: keep only cells where risk_score > 0.2

4. Send top 15 cells to Mistral via OpenRouter
   - Input: top cells + current weather context
   - Output: top_zones with zona/razon, analisis_6h/24h/72h

5. Return PredictionResult
```

### New Supabase Table

```sql
CREATE TABLE fire_hotspot_history (
  id          bigserial PRIMARY KEY,
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  frp         double precision,
  brightness  double precision,
  timestamp   timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON fire_hotspot_history (timestamp);
CREATE INDEX ON fire_hotspot_history (lat, lon);
```

Backend writes all FIRMS hotspots to this table on each orchestrator run (upsert by lat+lon+timestamp).

## Data Types

Add to `@sentinel/types`:

```typescript
interface PredictionCell {
  lat: number
  lon: number
  risk_score: number        // 0-1 combined
  fwi_score: number         // 0-1 weather only
  historical_weight: number // 0-1 history only
}

interface PredictionResult {
  grid: PredictionCell[]
  top_zones: Array<{
    lat: number
    lon: number
    risk_score: number
    zona: string    // human-readable zone name (LLM)
    razon: string   // why at risk (LLM)
  }>
  analisis_6h: string
  analisis_24h: string
  analisis_72h: string
  confianza: 'baja' | 'media' | 'alta'
}
```

`confianza`:
- `'alta'` — Supabase historial has ≥7 days of data
- `'media'` — 1–6 days of data
- `'baja'` — no historical data, FWI only

## Orchestrator Integration

In `packages/backend/src/services/orchestrator.ts`:

```typescript
const predictionUrl = process.env.AGENT_PREDICTION_URL  // optional, skip silently if unset

// Add to Promise.allSettled in step 2:
callAgent<PredictionResult>(predictionUrl, { firms: fires, weather })

// Add to SentinelUpdate return:
prediction: predictionResult ?? undefined
```

Add `AGENT_PREDICTION_URL` to env (optional — same pattern as `AGENT_REPORT_URL`).

## Error Handling

| Condition | Behavior |
|-----------|----------|
| No `AGENT_PREDICTION_URL` | Orchestrator skips silently |
| Supabase unavailable | Run FWI-only, `confianza: 'baja'`, no crash |
| No firms / no weather | Return `{ grid: [], top_zones: [], confianza: 'baja' }` |
| LLM fails | Return grid with `top_zones: []`, empty analysis strings, `success: true` |
| All cells risk < 0.2 | Return empty grid (low risk conditions) |

## File Structure

```
backend/packages/agent-prediction/
  src/
    index.ts       — Express server, port 3006
    analyze.ts     — FWI grid + Supabase query + score combination
    openrouter.ts  — Mistral call (copy from any other agent)
  package.json
  tsconfig.json
```

## LLM Prompt Strategy

System: expert en predicción de incendios forestales en Patagonia/Araucanía.  
User input: top 15 cells (lat, lon, risk_score, fwi_score, historical_count) + weather snapshot.  
Expected output: JSON with `top_zones[]`, `analisis_6h`, `analisis_24h`, `analisis_72h`.  
Temperature: 0.2 (deterministic, same as other agents).  
Model: `mistral/mistral-large-latest` via OpenRouter (same as A1–A5).

---

## Frontend Integration Guide

> This section is for the person implementing the dashboard layer. The agent is done — this is just wiring.

### 1. Add `prediction` to `SentinelUpdate` type

In `@sentinel/types`, extend `SentinelUpdate`:
```typescript
prediction?: PredictionResult
```

### 2. Expose in `sentinel-context.tsx`

The `useSentinelMetrics` hook already unpacks `SentinelUpdate`. Add:
```typescript
prediction: update?.prediction ?? null
```

### 3. New Mapbox layer in `mapbox-panel.tsx`

Add a toggle button "Zonas en riesgo" (default off).

When enabled, render each `PredictionCell` as a filled rectangle:

```typescript
// Color scale
function riskColor(score: number): string {
  if (score > 0.75) return '#ef4444'  // red
  if (score > 0.5)  return '#f97316'  // orange
  if (score > 0.35) return '#eab308'  // yellow
  return '#22c55e'                     // green
}

// Each cell is 0.25° × 0.25° — use map.addLayer with fill-color
```

Use Mapbox `fill` layer with a GeoJSON source. Each cell = one polygon feature with `risk_score` property.

### 4. Click popup

On cell click, show:
```
ZONA EN RIESGO
[zona name]
Score: 87%
[razon del LLM]
```

### 5. Sidebar panel (optional)

Show `analisis_6h`, `analisis_24h`, `analisis_72h` in a collapsible section below the map.  
Badge: `CONFIANZA: ALTA/MEDIA/BAJA` in grey/yellow/green.
