# Air Risk Intelligence Grid — Design Spec

**Date:** 2026-05-17  
**Branch:** Air-predict  
**Status:** Approved

---

## Overview

New layer for SENTINEL that shows a worldwide/regional air quality risk grid based on **real historical data** from the OpenAQ dataset (23,463 cities, 176 countries). The grid cells adapt to terrain shapes — not perfect squares.

**Core principle:** No invented data. All predictions are based on real measurements, interpolation between known stations, and physical adjustments from active fires + wind.

---

## Data Source

**File:** `data/air-quality-stations.json` (geocoded from `air pollution dataset.csv`)

**Per city/station:**
- `country`, `city`
- `lat`, `lon` (geocoded)
- `aqi` (overall AQI Value)
- `pm25` (PM2.5 AQI Value)
- `ozone` (Ozone AQI Value)
- `no2` (NO2 AQI Value)
- `co` (CO AQI Value)
- `category` (AQI Category string)

**Coverage:** 23,463 stations globally, 149 in Chile+Argentina.

---

## Prediction Algorithm

### Step 1: Baseline — IDW Interpolation

For any point (lat, lon) on the map, compute baseline PM2.5 from the N nearest stations using Inverse Distance Weighting:

```
PM25_baseline(lat, lon) = Σ(wi × PM25_i) / Σ(wi)
where wi = 1 / dist(lat,lon → station_i)²
N = 5 nearest stations (capped for performance)
```

This produces a continuous surface of air quality from discrete real measurements.

### Step 2: Smoke Modifier (fire proximity + wind)

When active fires exist, adjust baseline upward:

```
smoke_factor = Σ (FRP_i / 100) × angular_alignment × (1 / (1 + dist_i / 20))
```

- Only fires within 50 km contribute
- `angular_alignment`: 1.0 if cell is directly downwind, decays to 0 at 90° off-wind
- smoke_factor is additive: `PM25_adjusted = PM25_baseline + smoke_factor × 50`

### Step 3: Temporal Projection

- **Now:** smoke_factor uses current fire positions
- **+2h:** extend smoke contribution radius by `wind_kmh × 2`
- **+6h:** extend by `wind_kmh × 6`
- **+12h:** extend by `wind_kmh × 12`

The baseline never changes (it's historical). Only the smoke reach grows with time.

### Step 4: AQI Classification

```
AQI < 50       → GREEN    "Good"
AQI 50-100     → YELLOW   "Moderate"  
AQI 101-150    → ORANGE   "Unhealthy for Sensitive Groups"
AQI 151-200    → RED      "Unhealthy"
AQI 201-300    → PURPLE   "Very Unhealthy"
AQI > 300      → MAROON   "Hazardous"
```

### Step 5: Confidence Score

```
confidence = 100
  - (avg_distance_to_nearest_stations / 50) × 30   // far from data = less confident
  - (hours_projected × 3)                          // future = less confident
  + (stations_within_100km > 3 ? 10 : 0)          // dense coverage bonus
clamp(30, 100)
```

---

## Grid Geometry — Terrain-Adaptive Cells

**NOT** a regular lat/lon square grid. Instead:

### Approach: Voronoi tessellation from station points

Each station is a seed → Voronoi diagram generates irregular polygons that:
- Naturally adapt to where data exists (dense in cities, sparse in wilderness)
- Follow terrain implicitly (no stations in ocean → no ocean cells)
- Each polygon represents "the area closest to this station"

For regions between stations, subdivide large Voronoi cells into smaller sub-cells using intermediate interpolated points spaced ~50 km apart.

### Frontend rendering:
- GeoJSON FeatureCollection of Polygon features
- Each polygon colored by its computed AQI risk level
- Irregular shapes that conform to landmass (no ocean rendering)
- Semi-transparent fill (opacity 0.3-0.5) so map terrain shows through

### Performance optimization:
- Pre-compute Voronoi geometry server-side (once, cached)
- Frontend receives pre-built GeoJSON — no geometry computation in browser
- Only AQI values update per-cycle; polygon shapes are static

---

## Architecture

### Backend: `agent-air` extension

New function in `Backend/packages/agent-air/src/`:

```
airRiskGrid.ts:
  - loadStations(): AirStation[] (from JSON)
  - computeVoronoiGrid(stations): GeoJSON polygons (cached)
  - computeAirRisk(stations, fires, weather, hours): AirRiskCell[]
  - getAirRiskGrid(fires, weather, hours[]): AirRiskGridResult
```

### New type: `AirRiskGridResult`

```ts
interface AirRiskCell {
  id: string              // station city name or interpolated point ID
  polygon: number[][][]   // GeoJSON polygon coordinates
  pm25: number            // computed PM2.5
  aqi: number             // computed AQI
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EMERGENCY'
  main_pollutant: string  // 'PM2.5' | 'O3' | 'NO2' | 'CO'
  confidence: number      // 0-100
  trend: 'improving' | 'stable' | 'worsening'
  nearest_fire_km: number | null
  smoke_direction: string | null  // cardinal
}

interface AirRiskGridResult {
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

### SentinelUpdate extension

```ts
interface SentinelUpdate {
  // ... existing fields ...
  airRiskGrid?: AirRiskGridResult  // NEW
}
```

### Data flow

```
Orchestrator receives fires + weather
  → agent-air /analyze:
    1. analyzeAir() (existing LLM alerts)
    2. computeAirRiskGrid(fires, weather) ← NEW
  → Returns { alertas, airRiskGrid }
  → SentinelUpdate.airRiskGrid = result
  → Socket.io → Frontend
```

---

## Frontend: New Panel + Map Layer

### Map layer (`mapbox-panel.tsx` or new dedicated component):

- Toggle: "Air Risk" button in layer controls
- Source: `air-risk-grid` (GeoJSON FeatureCollection)
- Layer: `air-risk-fill` (fill, colored by risk_level)
- Layer: `air-risk-line` (line, subtle borders between cells)
- Layer: `air-risk-pulse` (fill with animated opacity on CRITICAL/EMERGENCY cells)
- Timeline buttons: Now / +2h / +6h / +12h (switch displayed dataset)
- Click cell → show detail panel

### Panel lateral (new component `air-risk-panel.tsx`):

When a cell is selected, show:
- Air Risk Level badge (colored)
- Main pollutant
- AQI estimate
- PM2.5 / Ozone / NO2 / CO values
- Trend indicator
- Confidence %
- Distance to nearest fire
- Smoke direction
- Mistral analysis (from existing agent-air LLM)
- Recommended action

When no cell selected: show "Most critical zone" automatically.

### Top metrics bar:
- Critical Air Zones count
- Average regional AQI
- Population exposed (from dataset city data)
- Trend arrow (stable/worsening)

---

## Geocoding Strategy

The dataset has city+country but no coordinates. Geocoding plan:

1. Use a bulk geocoding approach (OpenStreetMap Nominatim or pre-built city→coords mapping)
2. Store result as `data/air-quality-stations.json` in the repo
3. This is a one-time operation — the JSON becomes the static reference

For the 149 Chile+Argentina cities, use known coordinates from Chilean/Argentine city databases. For the global 23k+ cities, use a lightweight geocoding library or pre-built world cities dataset.

---

## What Mistral Does vs Doesn't Do

**Mistral DOES:**
- Interpret the computed risk for a selected zone
- Explain WHY the risk is at that level (proximity to fire, historical PM2.5, wind)
- Generate health recommendations
- Produce citizen alerts in Spanish

**Mistral DOES NOT:**
- Generate AQI numbers (those come from data + algorithm)
- Invent pollution measurements
- Decide risk levels (that's formula-based)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `data/air-quality-stations.json` | CREATE — geocoded dataset |
| `Backend/packages/agent-air/src/air-risk-grid.ts` | CREATE — grid computation |
| `Backend/packages/agent-air/src/voronoi.ts` | CREATE — terrain-adaptive geometry |
| `Backend/packages/agent-air/src/index.ts` | MODIFY — add grid endpoint |
| `Backend/shared/types/index.ts` | MODIFY — add AirRiskCell, AirRiskGridResult |
| `frontend/components/dashboard/air-risk-panel.tsx` | CREATE — detail panel |
| `frontend/components/dashboard/mapbox-panel.tsx` | MODIFY — add air risk layer |
| `frontend/components/dashboard/air-risk-metrics.tsx` | CREATE — top metrics |

---

## Key Constraints

1. **No invented data** — all base values from real measurements
2. **Terrain-adaptive cells** — Voronoi, not squares
3. **Dataset is the source of truth** — not an API call
4. **Incremental risk from fires** — only amplifies real baselines
5. **Confidence is transparent** — user sees how reliable each cell is
