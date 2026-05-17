# Fire Expansion — Regional Context Agents Design

**Date:** 2026-05-17  
**Status:** Approved  
**Scope:** `backend/packages/agent-fire`, `backend/shared/types`, `frontend/components/dashboard/mapbox-panel.tsx`

---

## Problem

The current fire expansion model has two critical issues:

1. **Formula is unrealistic.** Both backend (`computePerFireExpansions`) and frontend (`computeFireSpreadArea`) use a quadratic wind term (`windKmh² × 0.002`) that produces absurd values — e.g. 51,000 km² at 12h with 50 km/h winds. Area grows as O(hours²) with no dampening.

2. **Duplicated, disconnected logic.** The frontend recalculates expansion locally on fire click, ignoring the backend's `perFireExpansions` entirely. Backend results are wasted.

---

## Solution Overview

Replace the broken math model with two LLM agents per fire, running in parallel across the **top 50 fires by FRP**. A_context infers regional fire behavior from coordinates; A2 uses that context to produce calibrated expansion polygons. The frontend is wired to consume backend results instead of recalculating.

```
Top 50 focos (por FRP)
         ↓
   Promise.allSettled — 50 fires en paralelo
   ┌──────────────────────────────────────┐
   │  Por cada foco:                      │
   │  [A_context] lat/lon/frp/weather     │
   │  → RegionalContext                   │
   │         ↓                            │
   │  [A2] fire + RegionalContext         │
   │  → expansion 2h/6h/12h calibrada    │
   └──────────────────────────────────────┘
         ↓
   perFireExpansions[≤50] → Socket.io → Frontend
```

**Wall clock:** ~10s (A_context ~4s + A2 ~4s sequential per fire, all 50 fires parallel). System already responds 202 immediately; results arrive via Socket.io.

---

## Types — `shared/types/index.ts`

### New: `RegionalContext`

```ts
interface RegionalContext {
  region_name: string       // "Patagonia Andina chilena", "Amazonia boliviana", etc.
  country: string           // "Chile", "Brasil", "Argentina", ...
  vegetation_type: string   // "estepa patagónica", "bosque templado lluvioso", ...
  terrain_type: string      // "montañoso", "planicie", "costal"
  spread_multiplier: number // 0.5–2.0 relative scale factor
  max_ros_kmh: number       // absolute ceiling for rate of spread in this region
  reference_fires: string[] // real historical fires as calibration anchors
  context_summary: string   // brief narrative fed to A2
}
```

### Updated: `PerFireExpansion`

Add `regional_context: RegionalContext` field. Existing numeric fields (`expansion_2h_km2`, `expansion_6h_km2`, `expansion_12h_km2`, `velocidad_kmh`, `direccion`) remain unchanged.

---

## Backend — `agent-fire/src/analyze.ts`

### New: `runAContext(fire, weather) → RegionalContext`

Single LLM call. System prompt instructs the model to:
- Infer region name and country from the coordinates (LATAM scope)
- Identify vegetation type and terrain
- Return realistic `spread_multiplier` (0.5–2.0) and `max_ros_kmh` for that region
- Include 1–3 real historical fires from the region as `reference_fires` for calibration

No hallucination guard needed beyond `parseJSON` — if it fails, the fire is dropped gracefully.

### New: `runA2PerFire(fire, weather, ctx) → PerFireExpansion fields`

Replaces the global `runA2` for per-fire use. System prompt changes:
- Receives `RegionalContext` as hard constraints
- Instructed: *"use `max_ros_kmh` as absolute ceiling; scale areas with `spread_multiplier`; values must be coherent with `reference_fires`"*
- Output: `{ expansion_2h_km2, expansion_6h_km2, expansion_12h_km2, velocidad_kmh, direccion_principal }`

This anchors the LLM — it cannot produce 50,000 km² when reference fires for that region are in the hundreds.

### New: `analyzePerFire(fire, weather) → PerFireExpansion`

```ts
async function analyzePerFire(fire: FireData, weather: WeatherData): Promise<PerFireExpansion> {
  const ctx = await runAContext(fire, weather)
  const exp = await runA2PerFire(fire, weather, ctx)
  return { lat: fire.lat, lon: fire.lon, frp: fire.frp, ...exp, regional_context: ctx }
}
```

### Updated: `analyzeFireExpansion`

Top 50 fires (sorted by FRP descending) run in parallel:

```ts
const top50 = [...fires].sort((a, b) => b.frp - a.frp).slice(0, 50)
const results = await Promise.allSettled(top50.map(f => analyzePerFire(f, weather)))
const perFireExpansions = results
  .filter(r => r.status === 'fulfilled')
  .map(r => (r as PromiseFulfilledResult<PerFireExpansion>).value)
```

Fault isolation: a single failed LLM call drops only that fire, the rest succeed.

`computePerFireExpansions` is removed entirely — replaced by `analyzePerFire`. The global `runA1` (risk assessment) and `runA2` (cluster-level GeoJSON polygon for the map layer) remain unchanged — they operate on the full cluster centroid and are separate from the per-fire expansion widget data.

---

## Frontend — `mapbox-panel.tsx`

### Remove

`computeFireSpreadArea()` function (lines 86–95) — deleted entirely.

### Replace on fire click

```ts
// Before (remove):
const fireA2 = computeFireSpreadArea(fireWSpeed, 2)
const fireA6 = computeFireSpreadArea(fireWSpeed, 6)
const fireA12 = computeFireSpreadArea(fireWSpeed, 12)

// After:
const perFire = sentinelUpdate?.perFireExpansions
  ?.find(e => e.lat === lat && e.lon === lon)

const toArea = (km2: number) => ({ km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) })
const fireA2  = perFire ? toArea(perFire.expansion_2h_km2)  : undefined
const fireA6  = perFire ? toArea(perFire.expansion_6h_km2)  : undefined
const fireA12 = perFire ? toArea(perFire.expansion_12h_km2) : undefined
```

**Fallback:** fires outside top 50 or with failed LLM calls show `—` in the widget (already handled by the `ar ? fmtKm2(ar.km2) : '—'` check in `TacticalExpansionWidget`). No fake values.

### No changes needed

`TacticalExpansionWidget` — already reads `selectedFire.expansion2h/6h/12h`, structure unchanged.

---

## Change Summary

| File | Change |
|------|--------|
| `shared/types/index.ts` | Add `RegionalContext`; add `regional_context` to `PerFireExpansion` |
| `agent-fire/src/analyze.ts` | Add `runAContext`, `runA2PerFire`, `analyzePerFire`; update `analyzeFireExpansion` to top-50 parallel; remove `computePerFireExpansions` |
| `frontend/components/dashboard/mapbox-panel.tsx` | Remove `computeFireSpreadArea`; replace local recalc with `perFireExpansions` lookup |

---

## Out of Scope

- External research agent that fetches live data from CONAF/INTA/FIRMS — future feature, architecture is ready for it (`RegionalContext` can be populated from an external source later)
- Changes to `TacticalExpansionWidget`, `left-panel`, `right-panel`, or any other component
- Changes to the global A1 (risk assessment) or A2 (cluster-level polygon for the map layer)
