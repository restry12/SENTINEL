# SENTINEL AIR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic smoke-propagation + AQI visualization page at `/air` using Leaflet + Canvas animation, optimized for hackathon demo impact.

**Architecture:** New isolated route `app/air/page.tsx`. All components in `components/air/`. Pure data/math in `types.ts` (server-safe). Canvas animation in `smoke-engine.ts` (browser only, no Leaflet import needed — accepts interface). Mock data ships now; socket.io swap requires only changing data source.

**Tech Stack:** Next.js 16, Leaflet 1.9, Canvas API, Tailwind CSS v4, lucide-react, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/components/air/types.ts` | Create | Interfaces, mock data, AQI utils |
| `frontend/components/air/smoke-engine.ts` | Create | Canvas drawFrame, no Leaflet import |
| `frontend/app/globals.css` | Modify | Add fire/alert keyframes + tooltip style |
| `frontend/components/air/smoke-alert.tsx` | Create | Top alert banner |
| `frontend/components/air/aqi-legend.tsx` | Create | Bottom-right color scale |
| `frontend/components/air/env-status.tsx` | Create | Bottom-left env chips |
| `frontend/components/air/aqi-overlay.tsx` | Create | Left AQI glass panel |
| `frontend/components/air/air-map.tsx` | Create | Leaflet map + canvas overlay (client) |
| `frontend/app/air/page.tsx` | Create | Route page, computes AQI, assembles UI |

---

## Task 1: Types, mock data, and AQI utilities

**Files:**
- Create: `frontend/components/air/types.ts`

- [ ] **Create the file with all shared types, mock data, and pure utility functions**

```typescript
// frontend/components/air/types.ts

export interface FirePoint {
  id: string
  lat: number
  lng: number
  intensity: number  // 0–1
  name: string
}

export interface WindData {
  speed: number    // km/h
  fromDeg: number  // meteorological: FROM this bearing (0=N, 90=E, 180=S, 270=W)
}

export interface EnvData {
  wind: WindData
  humidity: number      // %
  tempC: number
  visibilityKm: number
}

export interface AQIInfo {
  current: number
  predicted2h: number
  colorHex: string
  label: string
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "VERY HIGH"
  affectedPopulation: number
}

// ── Mock data (swap for socket.io later) ────────────────────────
export const MOCK_FIRES: FirePoint[] = [
  { id: "fire-001", lat: -38.14, lng: -71.73, intensity: 0.75, name: "FIRE-001" },
  { id: "fire-002", lat: -38.42, lng: -72.08, intensity: 1.00, name: "FIRE-002 (PRIMARY)" },
]

export const MOCK_ENV: EnvData = {
  wind:         { speed: 24, fromDeg: 315 },
  humidity:     23,
  tempC:        31,
  visibilityKm: 2.1,
}

export const MAP_CENTER = { lat: -38.28, lng: -71.90 }

// ── AQI thresholds ───────────────────────────────────────────────
export const AQI_THRESHOLDS: Array<{
  max: number
  color: string
  label: string
  risk: AQIInfo["riskLevel"]
}> = [
  { max: 50,       color: "#22c55e", label: "Good",           risk: "LOW"       },
  { max: 100,      color: "#eab308", label: "Moderate",       risk: "MODERATE"  },
  { max: 150,      color: "#f97316", label: "Unhealthy (S)",  risk: "HIGH"      },
  { max: Infinity, color: "#ef4444", label: "Unhealthy",      risk: "VERY HIGH" },
]

export function aqiColor(aqi: number): string {
  return AQI_THRESHOLDS.find(t => aqi <= t.max)!.color
}

export function aqiInfo(rawAqi: number, population: number): AQIInfo {
  const clamped = Math.min(500, rawAqi)
  const t = AQI_THRESHOLDS.find(t => clamped <= t.max)!
  return {
    current:            Math.round(clamped),
    predicted2h:        Math.round(clamped * 1.25),
    colorHex:           t.color,
    label:              t.label,
    riskLevel:          t.risk,
    affectedPopulation: population,
  }
}

// ── Pure geo math ────────────────────────────────────────────────
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function computeAQI(
  fires: FirePoint[],
  wind: WindData,
  centerLat: number,
  centerLng: number
): number {
  const toRad = ((wind.fromDeg + 180) % 360) * (Math.PI / 180)
  const wX = Math.sin(toRad)  // East component of wind direction
  const wY = Math.cos(toRad)  // North component of wind direction

  const raw = fires.reduce((sum, fire) => {
    const dist = haversineKm(centerLat, centerLng, fire.lat, fire.lng)
    const dLat = fire.lat - centerLat
    const dLng = fire.lng - centerLng
    const len = Math.sqrt(dLat ** 2 + dLng ** 2) || 1
    const alignment = wX * (dLng / len) + wY * (dLat / len)
    const base = (300 * fire.intensity) / (dist + 1)
    return sum + base * (1 + Math.max(0, alignment) * wind.speed / 15)
  }, 0)

  return Math.min(500, raw)
}
```

- [ ] **Verify TypeScript compiles — run from `frontend/` folder**

```
cd frontend && pnpm tsc --noEmit
```

Expected: no errors on this file (other files may not exist yet, that's OK).

- [ ] **Commit**

```
git add frontend/components/air/types.ts
git commit -m "feat(air): add types, mock data, and AQI utilities"
```

---

## Task 2: Canvas smoke engine

**Files:**
- Create: `frontend/components/air/smoke-engine.ts`

- [ ] **Create the smoke drawing engine — pure canvas logic, no Leaflet import**

```typescript
// frontend/components/air/smoke-engine.ts
// Uses a minimal interface instead of importing Leaflet directly
// so this module is safe to use anywhere.

import type { FirePoint, WindData } from "./types"

interface MapLike {
  latLngToContainerPoint(latlng: [number, number]): { x: number; y: number }
}

const PUFF_COUNT    = 15
const PUFF_DURATION = 4000   // ms per puff lifecycle
const MAX_DRIFT_PX  = 350    // pixels at reference wind speed (24 km/h)

function windCanvasVec(wind: WindData): { dx: number; dy: number } {
  // Wind blows TO (fromDeg + 180). Convert to canvas coords (y-axis down).
  const toRad = ((wind.fromDeg + 180) % 360) * (Math.PI / 180)
  return {
    dx:  Math.sin(toRad),   // East = right on canvas = positive x ✓
    dy: -Math.cos(toRad),   // South = down on canvas = positive y ✓
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  map: MapLike,
  fires: FirePoint[],
  wind: WindData,
  elapsed: number
): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  const { dx, dy } = windCanvasVec(wind)
  const windMag = wind.speed / 24  // normalize: 1.0 at 24 km/h

  fires.forEach(fire => {
    const pt = map.latLngToContainerPoint([fire.lat, fire.lng])
    const ox = pt.x
    const oy = pt.y

    // ── Smoke puffs ──────────────────────────────────────────────
    for (let i = 0; i < PUFF_COUNT; i++) {
      const phaseMs = (i / PUFF_COUNT) * PUFF_DURATION
      const t = ((elapsed + phaseMs) % PUFF_DURATION) / PUFF_DURATION  // 0→1

      const drift  = t * MAX_DRIFT_PX * windMag
      const wobX   = Math.sin(t * Math.PI * 4 + i * 1.3) * 15
      const wobY   = Math.cos(t * Math.PI * 3 + i * 0.9) * 10

      const sx     = ox + dx * drift + wobX
      const sy     = oy + dy * drift + wobY
      const radius = (15 + t * 100) * fire.intensity
      const alpha  = Math.sin(t * Math.PI) * 0.22 * fire.intensity

      if (alpha < 0.005 || radius < 1) continue

      // Rotate + stretch ellipse in wind direction
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(Math.atan2(dy, dx))
      ctx.scale(1.4, 1)

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      grad.addColorStop(0,   `rgba(150,150,165,${alpha.toFixed(3)})`)
      grad.addColorStop(0.5, `rgba(110,110,125,${(alpha * 0.6).toFixed(3)})`)
      grad.addColorStop(1,   "rgba(70,70,85,0)")

      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // ── Fire glow ─────────────────────────────────────────────────
    const pulse  = 0.45 + Math.sin(elapsed / 400) * 0.12
    const gGlow  = ctx.createRadialGradient(ox, oy, 0, ox, oy, 65)
    gGlow.addColorStop(0,    `rgba(255,160,0,${pulse.toFixed(3)})`)
    gGlow.addColorStop(0.35, `rgba(255,80,0,${(pulse * 0.55).toFixed(3)})`)
    gGlow.addColorStop(0.7,  `rgba(200,30,0,${(pulse * 0.18).toFixed(3)})`)
    gGlow.addColorStop(1,    "rgba(150,0,0,0)")

    ctx.beginPath()
    ctx.arc(ox, oy, 65, 0, Math.PI * 2)
    ctx.fillStyle = gGlow
    ctx.fill()

    // ── Ember particles ───────────────────────────────────────────
    for (let e = 0; e < 5; e++) {
      const et = ((elapsed / 900 + e * 0.4) % 1)
      const ex = ox + dx * et * 70 + Math.sin(et * 18 + e) * 10
      const ey = oy + dy * et * 70 - et * 25 + Math.cos(et * 14 + e) * 7
      const ea = (1 - et) * 0.85
      const er = 1.5 + (1 - et) * 1.5

      ctx.beginPath()
      ctx.arc(ex, ey, er, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,${Math.floor(160 * (1 - et))},0,${ea.toFixed(3)})`
      ctx.fill()
    }
  })
}
```

- [ ] **Commit**

```
git add frontend/components/air/smoke-engine.ts
git commit -m "feat(air): add canvas smoke engine with puffs, glow, and embers"
```

---

## Task 3: CSS animations

**Files:**
- Modify: `frontend/app/globals.css` (append at end of file)

- [ ] **Append these keyframes and utility classes to the end of `globals.css`**

```css
/* ── SENTINEL AIR animations ─────────────────────────────── */
@keyframes sentinelFirePulse {
  0%   { transform: scale(1);   opacity: 1; }
  100% { transform: scale(1.35); opacity: 0.85; }
}

@keyframes sentinelFireRing {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(3.5); opacity: 0; }
}

@keyframes smokeAlertBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

/* Leaflet tooltip override for SENTINEL style */
.sentinel-tooltip {
  background: #0a0a0a !important;
  border: 1px solid #2a2a2a !important;
  border-radius: 2px !important;
  color: #e8e6e0 !important;
  font-family: 'Geist Mono', monospace !important;
  font-size: 10px !important;
  letter-spacing: 0.08em !important;
  padding: 3px 7px !important;
  box-shadow: 0 0 12px rgba(255, 100, 0, 0.3) !important;
}

.sentinel-tooltip::before {
  border-top-color: #2a2a2a !important;
}
```

- [ ] **Commit**

```
git add frontend/app/globals.css
git commit -m "feat(air): add fire, ring, and alert blink animations"
```

---

## Task 4: Smoke alert banner

**Files:**
- Create: `frontend/components/air/smoke-alert.tsx`

- [ ] **Create the top alert banner component**

```tsx
// frontend/components/air/smoke-alert.tsx
"use client"

import type { FirePoint, WindData } from "./types"

interface Props {
  fires: FirePoint[]
  wind: WindData
}

const BEARING_NAMES = ["N","NE","E","SE","S","SW","W","NW"]
function bearingName(deg: number): string {
  return BEARING_NAMES[Math.round(deg / 45) % 8]
}

export function SmokeAlert({ fires, wind }: Props) {
  const names   = fires.map(f => f.name).join("  ·  ")
  const windDir = bearingName(wind.fromDeg)

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-2 bg-black/75 backdrop-blur-md border border-red-500/40 rounded-sm font-mono whitespace-nowrap">
      <span
        className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0"
        style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
      />
      <span className="text-xs font-semibold tracking-widest uppercase text-red-400">
        Smoke Propagation Detected
      </span>
      <span className="text-border">|</span>
      <span className="text-xs text-muted-foreground">{names}</span>
      <span className="text-border">|</span>
      <span className="text-xs text-muted-foreground">
        Wind: {windDir} {wind.speed} km/h
      </span>
    </div>
  )
}
```

- [ ] **Commit**

```
git add frontend/components/air/smoke-alert.tsx
git commit -m "feat(air): add smoke alert banner component"
```

---

## Task 5: AQI color legend

**Files:**
- Create: `frontend/components/air/aqi-legend.tsx`

- [ ] **Create the bottom-right AQI legend**

```tsx
// frontend/components/air/aqi-legend.tsx
"use client"

import { AQI_THRESHOLDS } from "./types"

const RANGES = ["0 – 50", "51 – 100", "101 – 150", "151+"]

export function AQILegend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-black/75 backdrop-blur-md border border-white/10 rounded-sm px-3 py-2 font-mono">
      <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-2">
        AQI Scale
      </p>
      <div className="flex flex-col gap-1.5">
        {AQI_THRESHOLDS.map((t, i) => (
          <div key={t.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-[10px] text-muted-foreground w-16">{RANGES[i]}</span>
            <span className="text-[10px] text-foreground/70">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```
git add frontend/components/air/aqi-legend.tsx
git commit -m "feat(air): add AQI color legend"
```

---

## Task 6: Environmental status chips

**Files:**
- Create: `frontend/components/air/env-status.tsx`

- [ ] **Create the bottom-left environmental metrics chips**

```tsx
// frontend/components/air/env-status.tsx
"use client"

import { Wind, Droplets, Thermometer, Eye } from "lucide-react"
import type { EnvData } from "./types"

interface Props { env: EnvData }

const BEARING_NAMES = ["N","NE","E","SE","S","SW","W","NW"]
function bearingName(deg: number): string {
  return BEARING_NAMES[Math.round(deg / 45) % 8]
}

export function EnvStatus({ env }: Props) {
  const windDir = bearingName(env.wind.fromDeg)

  const chips = [
    { Icon: Wind,        value: `${env.wind.speed} km/h ${windDir}` },
    { Icon: Droplets,    value: `${env.humidity}%` },
    { Icon: Thermometer, value: `${env.tempC}°C` },
    { Icon: Eye,         value: `${env.visibilityKm} km` },
  ]

  return (
    <div className="absolute bottom-4 left-4 z-[1000] flex gap-2 font-mono">
      {chips.map(({ Icon, value }) => (
        <div
          key={value}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/75 backdrop-blur-md border border-white/10 rounded-sm"
        >
          <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-foreground/80">{value}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Commit**

```
git add frontend/components/air/env-status.tsx
git commit -m "feat(air): add environmental status chips"
```

---

## Task 7: AQI glassmorphism panel

**Files:**
- Create: `frontend/components/air/aqi-overlay.tsx`

- [ ] **Create the left-side AQI information panel**

```tsx
// frontend/components/air/aqi-overlay.tsx
"use client"

import type { AQIInfo } from "./types"
import { aqiColor } from "./types"

interface Props { info: AQIInfo }

const RECOMMENDATIONS = [
  "Avoid outdoor exercise",
  "Close windows and doors",
  "Wear N95 mask outdoors",
  "Sensitive groups stay indoors",
]

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function AQIOverlay({ info }: Props) {
  const barPct     = Math.min(100, (info.current / 300) * 100)
  const pred2hCol  = aqiColor(info.predicted2h)

  return (
    <div className="absolute top-14 left-4 z-[1000] w-52 flex flex-col gap-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">

      {/* Header */}
      <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
        Air Quality Index
      </p>

      {/* Current AQI */}
      <div>
        <div className="flex items-end gap-2 mb-1.5">
          <span
            className="text-4xl font-bold leading-none tabular-nums"
            style={{ color: info.colorHex }}
          >
            {info.current}
          </span>
          <span className="text-xs text-muted-foreground mb-0.5">{info.label}</span>
        </div>
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${barPct}%`, backgroundColor: info.colorHex }}
          />
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Forecast */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">+2h Forecast</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: pred2hCol }}>
          {info.predicted2h}
        </span>
      </div>

      {/* Risk */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">Risk Level</span>
        <span className="text-xs font-semibold" style={{ color: info.colorHex }}>
          {info.riskLevel}
        </span>
      </div>

      {/* Population */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">Affected Pop.</span>
        <span className="text-xs text-foreground">{formatPop(info.affectedPopulation)}</span>
      </div>

      <div className="h-px bg-white/10" />

      {/* Recommendations */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-2">Recommendations</p>
        <div className="flex flex-col gap-1.5">
          {RECOMMENDATIONS.map(rec => (
            <div key={rec} className="flex items-start gap-1.5">
              <span className="text-warning text-[10px] mt-px flex-shrink-0">▸</span>
              <span className="text-[10px] text-foreground/80 leading-tight">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```
git add frontend/components/air/aqi-overlay.tsx
git commit -m "feat(air): add AQI glassmorphism overlay panel"
```

---

## Task 8: Air map (Leaflet + canvas)

**Files:**
- Create: `frontend/components/air/air-map.tsx`

- [ ] **Create the main map component — Leaflet with canvas smoke overlay**

```tsx
// frontend/components/air/air-map.tsx
"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { drawFrame } from "./smoke-engine"
import { MOCK_FIRES, MOCK_ENV, MAP_CENTER } from "./types"

// Geographic wind vector (for AQI zone placement)
function geoWindVec(fromDeg: number): { lat: number; lng: number } {
  const toRad = ((fromDeg + 180) % 360) * (Math.PI / 180)
  return { lat: Math.cos(toRad), lng: Math.sin(toRad) }
}

const FIRE_ICON_HTML = `
  <div style="position:relative;width:16px;height:16px">
    <div style="
      position:absolute;inset:0;border-radius:50%;
      background:radial-gradient(circle at 40% 40%,#ffcc00,#ff6600,#cc2200);
      box-shadow:0 0 10px 3px rgba(255,100,0,.85),0 0 28px 7px rgba(255,50,0,.45);
      animation:sentinelFirePulse 1.2s ease-in-out infinite alternate;
    "></div>
    <div style="
      position:absolute;inset:-10px;border-radius:50%;
      border:1.5px solid rgba(255,100,0,.45);
      animation:sentinelFireRing 2s ease-out infinite;
    "></div>
  </div>`

export function AirMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const rafRef       = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // ── Leaflet map ──────────────────────────────────────────────
    const map = L.map(containerRef.current, {
      center:           [MAP_CENTER.lat, MAP_CENTER.lng],
      zoom:             10,
      zoomControl:      true,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map)

    // ── AQI zone circles ─────────────────────────────────────────
    const wVec = geoWindVec(MOCK_ENV.wind.fromDeg)
    const zones = [
      { radiusKm:  8, color: "#ef4444", opacity: 0.14 },
      { radiusKm: 20, color: "#f97316", opacity: 0.09 },
      { radiusKm: 40, color: "#eab308", opacity: 0.06 },
      { radiusKm: 70, color: "#22c55e", opacity: 0.03 },
    ]

    MOCK_FIRES.forEach(fire => {
      zones.forEach(zone => {
        const offsetKm  = zone.radiusKm * 0.4
        const offsetLat = wVec.lat * offsetKm / 111
        const offsetLng = wVec.lng * offsetKm / (111 * Math.cos(fire.lat * Math.PI / 180))
        L.circle([fire.lat + offsetLat, fire.lng + offsetLng], {
          radius:      zone.radiusKm * 1000,
          color:       "transparent",
          fillColor:   zone.color,
          fillOpacity: zone.opacity * fire.intensity,
        }).addTo(map)
      })
    })

    // ── Fire markers ─────────────────────────────────────────────
    const fireIcon = L.divIcon({
      html:      FIRE_ICON_HTML,
      className: "",
      iconSize:  [16, 16],
      iconAnchor:[8, 8],
    })

    MOCK_FIRES.forEach(fire => {
      L.marker([fire.lat, fire.lng], { icon: fireIcon })
        .addTo(map)
        .bindTooltip(fire.name, {
          permanent:  true,
          direction:  "top",
          offset:     [0, -14],
          className:  "sentinel-tooltip",
        })
    })

    mapRef.current = map

    // ── Canvas overlay ───────────────────────────────────────────
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext("2d")!
    const start  = performance.now()

    function resize() {
      canvas.width  = containerRef.current!.clientWidth
      canvas.height = containerRef.current!.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(containerRef.current!)

    function loop() {
      drawFrame(ctx, map, MOCK_FIRES, MOCK_ENV.wind, performance.now() - start)
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* Canvas sits above tiles (z-450) but below Leaflet marker pane (z-600) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 450, filter: "blur(1.5px)" }}
      />
    </div>
  )
}
```

- [ ] **Commit**

```
git add frontend/components/air/air-map.tsx
git commit -m "feat(air): add Leaflet map with canvas smoke + AQI zones"
```

---

## Task 9: /air page

**Files:**
- Create: `frontend/app/air/page.tsx`

- [ ] **Create the `app/air/` directory and the page**

```
mkdir frontend/app/air
```

- [ ] **Create `frontend/app/air/page.tsx`**

```tsx
// frontend/app/air/page.tsx
import dynamic from "next/dynamic"
import { MOCK_FIRES, MOCK_ENV, MAP_CENTER, computeAQI, aqiInfo } from "@/components/air/types"
import { SmokeAlert }  from "@/components/air/smoke-alert"
import { AQIOverlay }  from "@/components/air/aqi-overlay"
import { EnvStatus }   from "@/components/air/env-status"
import { AQILegend }   from "@/components/air/aqi-legend"

// Load map client-only (Leaflet requires window)
const AirMap = dynamic(
  () => import("@/components/air/air-map").then(m => m.AirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

// Compute AQI server-side (pure function, no browser needed)
const rawAQI  = computeAQI(MOCK_FIRES, MOCK_ENV.wind, MAP_CENTER.lat, MAP_CENTER.lng)
const aqiData = aqiInfo(rawAQI, 127_450)

export default function AirPage() {
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-6 shrink-0 z-[2000]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground font-mono">
            SENTINEL
          </span>
          <span className="text-border">|</span>
          <span className="text-xs font-semibold tracking-widest uppercase text-warning font-mono">
            AIR QUALITY MONITOR
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-red-500"
            style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
          />
          <span className="text-xs font-mono text-muted-foreground">LIVE</span>
        </div>
      </header>

      {/* Map area — fills remaining height */}
      <main className="flex-1 relative overflow-hidden">
        <AirMap />
        <SmokeAlert fires={MOCK_FIRES} wind={MOCK_ENV.wind} />
        <AQIOverlay info={aqiData} />
        <EnvStatus  env={MOCK_ENV} />
        <AQILegend />
      </main>
    </div>
  )
}
```

- [ ] **Commit**

```
git add frontend/app/air/page.tsx
git commit -m "feat(air): add /air route page assembling all components"
```

---

## Task 10: Verify and push

- [ ] **Run TypeScript check from `frontend/` folder**

```
cd frontend && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Run dev server and open http://localhost:3000/air**

```
cd frontend && pnpm dev
```

Check that:
1. Dark map renders with CartoDB tiles centered on Araucanía
2. Two fire markers visible with orange glow and pulsing ring
3. Smoke drifts toward SE (wind is from NW)
4. AQI panel shows on left with values, color bar, forecast, recommendations
5. Environmental chips show bottom-left (wind, humidity, temp, visibility)
6. AQI color legend bottom-right
7. Alert banner top-center with blinking red dot

- [ ] **Fix any TypeScript or rendering issues, then push**

```
git push origin frontendaire
```

---

## Socket.io Swap Guide (future)

When the backend is ready:

1. In `frontend/components/air/air-map.tsx`, add:
```tsx
// Replace the static imports of MOCK_FIRES / MOCK_ENV with:
const [fires, setFires] = useState<FirePoint[]>(MOCK_FIRES)
const [env, setEnv]     = useState<EnvData>(MOCK_ENV)

useEffect(() => {
  const socket = io("http://your-backend-url")
  socket.on("fires", (data: FirePoint[]) => setFires(data))
  socket.on("env",   (data: EnvData)     => setEnv(data))
  return () => { socket.disconnect() }
}, [])
```

2. Pass `fires` and `env` state into `drawFrame()` and AQI computation.
3. No other files change.
