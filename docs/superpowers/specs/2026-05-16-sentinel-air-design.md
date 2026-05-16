# SENTINEL AIR — Design Spec
**Date:** 2026-05-16  
**Branch:** frontendaire  
**Route:** `/air`

---

## Goal

Cinematic real-time air quality and smoke propagation visualization for the SENTINEL hackathon. Visually impressive within the first 10 seconds. Data is mocked now; swapping to socket.io backend later requires changing only the data source.

---

## Architecture

New isolated page at `app/air/page.tsx`. All components live in `components/air/`. Zero impact on existing dashboard (`app/page.tsx`).

```
app/air/
  page.tsx
components/air/
  types.ts           ← shared interfaces
  smoke-engine.ts    ← pure canvas logic (no JSX)
  air-map.tsx        ← Leaflet + canvas, loaded via next/dynamic
  aqi-overlay.tsx    ← AQI glassmorphism card (left)
  env-status.tsx     ← Wind/Humidity/Temp/Visibility chips (bottom-left)
  smoke-alert.tsx    ← top alert banner
  aqi-legend.tsx     ← color scale (bottom-right)
```

---

## Data Shape

```ts
// types.ts
interface FirePoint {
  id: string
  lat: number
  lng: number
  intensity: number   // 0–1
  name: string
}

interface WindData {
  speed: number       // km/h
  fromDeg: number     // meteorological: FROM this bearing
}

interface EnvData {
  wind: WindData
  humidity: number    // %
  tempC: number
  visibilityKm: number
}
```

Mock data ships inline in `air-map.tsx`. When socket.io is ready, replace the static arrays with socket event handlers — no other changes needed.

---

## Map

- Provider: Leaflet with CartoDB Dark tiles
- Center: set by the first fire coordinate (dynamic)
- Zoom: 10
- Controls: zoom only (no attribution)
- Loaded via `next/dynamic` with `ssr: false`

---

## Smoke Engine (`smoke-engine.ts`)

Pure function: `drawFrame(ctx, map, fires, wind, elapsed)`.

**Puff system (per fire):**
- `PUFF_COUNT = 15`, cycle duration = 4000ms
- Phase offset per puff: `(i / PUFF_COUNT) * duration`
- `t = ((elapsed + offset) % duration) / duration`  → 0..1
- Position: `origin + windVec * t * MAX_DRIFT + wobble(t, i)`
- Radius: `15 + t * 120` px
- Alpha: `sin(t * π) * 0.22 * intensity`
- Shape: ellipse rotated to wind direction, scaled 1.4× on wind axis

**Fire glow (per fire):**
- Radial gradient, 60px radius
- Orange center → red edge
- Pulse: `0.45 + sin(elapsed/400) * 0.12`

**Ember particles (per fire):**
- 5 particles, 800ms cycle each
- Rise against gravity, drift with wind
- Fade from orange to transparent

**Canvas CSS:** `filter: blur(2px)` for soft smoke edges. `pointer-events: none`, `z-index: 450` (above tiles, below Leaflet markers).

---

## AQI Formula

```ts
function computeAQI(fires, wind, centerLatLng): number {
  return fires.reduce((sum, fire) => {
    const dist = haversineKm(centerLatLng, fire)
    const alignment = dotProduct(windVec(wind), dirTo(centerLatLng, fire))
    const base = (300 * fire.intensity) / (dist + 1)
    return sum + base * (1 + Math.max(0, alignment) * wind.speed / 15)
  }, 0)
}
```

Predicted AQI +2h: `aqi * 1.25` (simple growth factor, believable for demo).

AQI color thresholds:
| Range  | Color   | Label         |
|--------|---------|---------------|
| 0–50   | #22c55e | Good          |
| 51–100 | #eab308 | Moderate      |
| 101–150| #f97316 | Unhealthy (S) |
| 151+   | #ef4444 | Unhealthy     |

---

## UI Components

### `smoke-alert.tsx`
- Fixed top-center, `z-[1000]`
- Pulsing red dot + "SMOKE PROPAGATION DETECTED" text
- Subtitle: fire names, wind info
- Glassmorphism: `bg-black/70 backdrop-blur border border-red-500/30`

### `aqi-overlay.tsx`
- Absolute left side of map, `z-[1000]`
- Sections: current AQI (large number + color bar), +2h prediction, risk level, affected population estimate, 4 recommendations
- Glassmorphism card

### `env-status.tsx`
- Bottom-left chips: Wind `24 km/h NW` / Humidity `23%` / Temp `31°C` / Visibility `2.1 km`
- Icon per metric (lucide-react)

### `aqi-legend.tsx`
- Bottom-right vertical color scale
- 4 color blocks with AQI range labels

---

## Page Layout (`app/air/page.tsx`)

```
<div fullscreen dark>
  <header>SENTINEL AIR topbar</header>
  <main relative flex-1>
    <AirMap />                    {/* fills 100% */}
    <SmokeAlert />                {/* absolute top-center */}
    <AQIOverlay />                {/* absolute left */}
    <EnvStatus />                 {/* absolute bottom-left */}
    <AQILegend />                 {/* absolute bottom-right */}
  </main>
</div>
```

---

## CSS additions (`globals.css`)

```css
@keyframes sentinelFirePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.3); } }
@keyframes sentinelFireRing  { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(3); opacity: 0; } }
@keyframes smokeAlertBlink   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.sentinel-tooltip { background: #0a0a0a; border: 1px solid #333; color: #e8e6e0; font-family: monospace; font-size: 11px; }
```

---

## Socket.io Swap Path

When backend is ready:
1. In `air-map.tsx`, replace static `MOCK_FIRES` and `MOCK_ENV` with `useSocketData(url)` hook
2. The hook emits the same `FirePoint[]` and `EnvData` shapes
3. No other files change

---

## Out of Scope

- Scientific accuracy of smoke dispersion
- Real sensor data integration (this sprint)
- Mobile responsive layout (desktop-first for hackathon)
- Authentication
