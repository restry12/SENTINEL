# SENTINEL AIR — Command Center Evolution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the `/air` page from a monitoring dashboard into a cinematic AI-powered environmental emergency command center with threat levels, AI action plans, incident timelines, scenario simulation, and infrastructure risk visualization.

**Architecture:** All new state lives in `page.tsx` (scenarioId → derived env/fires/aqi/threat). Child components receive data via props. AirMap accepts a `wind` prop via ref so the smoke canvas reacts to scenario changes. Five new components are created in `frontend/components/air/`. No external state libraries — plain React `useState`/`useMemo`.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Tailwind CSS v4, Mapbox GL JS (already installed), canvas API, CSS keyframe animations.

---

## File Map

**Create:**
- `frontend/components/air/threat-indicator.tsx` — header threat level pill
- `frontend/components/air/action-plan.tsx` — AI response action list panel
- `frontend/components/air/ai-briefing.tsx` — rotating intelligence narration panel
- `frontend/components/air/incident-timeline.tsx` — live chronological event feed
- `frontend/components/air/scenario-controls.tsx` — simulation scenario buttons

**Modify:**
- `frontend/components/air/types.ts` — add ThreatLevel, InfrastructurePoint, Scenario, SCENARIOS, MOCK_INFRASTRUCTURE, computeThreatLevel, THREAT_COLORS
- `frontend/app/air/page.tsx` — lift state, wire all new components
- `frontend/components/air/air-map.tsx` — accept `wind` prop via ref, add Mapbox infrastructure markers + risk count overlay
- `frontend/components/air/smoke-engine.ts` — enhance puff count, add atmospheric haze layer
- `frontend/components/air/aqi-overlay.tsx` — add population exposure growth projection rows
- `frontend/components/air/env-status.tsx` — upgrade cards with live indicators and alert coloring
- `frontend/app/globals.css` — add threatPulse, slideInRight, ambientPulse, scanline CSS

---

## Task 1: Data Foundation — extend types.ts + lift state in page.tsx

**Files:**
- Modify: `frontend/components/air/types.ts`
- Modify: `frontend/app/air/page.tsx`

- [ ] **Step 1: Add new types and data to types.ts**

Replace the entire `frontend/components/air/types.ts` with:

```typescript
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

export type ThreatLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL"

export interface InfrastructurePoint {
  id: string
  name: string
  lat: number
  lng: number
  type: "hospital" | "school" | "emergency"
}

export type ScenarioId = "none" | "wind" | "humidity" | "worst"

export interface Scenario {
  id: ScenarioId
  label: string
  env: EnvData
  fires: FirePoint[]
}

// ── Mock data ────────────────────────────────────────────────────
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

export const MOCK_INFRASTRUCTURE: InfrastructurePoint[] = [
  { id: "h-001", name: "Hosp. Hernán Henríquez", lat: -38.24, lng: -72.35, type: "hospital"  },
  { id: "s-001", name: "Escuela La Araucanía",    lat: -38.18, lng: -71.62, type: "school"    },
  { id: "s-002", name: "Liceo Técnico Curacautín",lat: -38.44, lng: -71.89, type: "school"    },
  { id: "s-003", name: "Colegio Los Volcanes",     lat: -38.35, lng: -72.12, type: "school"    },
  { id: "e-001", name: "Bomberos Lonquimay",       lat: -38.44, lng: -71.24, type: "emergency" },
]

// ── Scenarios ────────────────────────────────────────────────────
export const SCENARIOS: Record<ScenarioId, Scenario> = {
  none: {
    id: "none", label: "Current",
    env: MOCK_ENV,
    fires: MOCK_FIRES,
  },
  wind: {
    id: "wind", label: "Wind Intensifies",
    env: { ...MOCK_ENV, wind: { speed: 52, fromDeg: 315 } },
    fires: MOCK_FIRES,
  },
  humidity: {
    id: "humidity", label: "Humidity Drops",
    env: { ...MOCK_ENV, humidity: 8, tempC: 37 },
    fires: MOCK_FIRES,
  },
  worst: {
    id: "worst", label: "Worst Case",
    env: { wind: { speed: 65, fromDeg: 315 }, humidity: 5, tempC: 42, visibilityKm: 0.8 },
    fires: [
      { id: "fire-001", lat: -38.14, lng: -71.73, intensity: 1.00, name: "FIRE-001"          },
      { id: "fire-002", lat: -38.42, lng: -72.08, intensity: 1.00, name: "FIRE-002 (PRIMARY)" },
    ],
  },
}

// ── AQI thresholds ───────────────────────────────────────────────
export const AQI_THRESHOLDS: Array<{
  max: number; color: string; label: string; risk: AQIInfo["riskLevel"]
}> = [
  { max: 50,       color: "#22c55e", label: "Good",          risk: "LOW"       },
  { max: 100,      color: "#eab308", label: "Moderate",      risk: "MODERATE"  },
  { max: 150,      color: "#f97316", label: "Unhealthy (S)", risk: "HIGH"      },
  { max: Infinity, color: "#ef4444", label: "Unhealthy",     risk: "VERY HIGH" },
]

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  LOW:      "#22c55e",
  MODERATE: "#eab308",
  HIGH:     "#f97316",
  CRITICAL: "#ef4444",
}

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

export function computeThreatLevel(aqi: number): ThreatLevel {
  if (aqi < 50)  return "LOW"
  if (aqi < 100) return "MODERATE"
  if (aqi < 150) return "HIGH"
  return "CRITICAL"
}

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
  const wX = Math.sin(toRad)
  const wY = Math.cos(toRad)
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

- [ ] **Step 2: Rewrite page.tsx with state + placeholder imports**

Replace the entire `frontend/app/air/page.tsx` with:

```tsx
"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import {
  MAP_CENTER, computeAQI, aqiInfo, computeThreatLevel,
  SCENARIOS, type ScenarioId,
} from "@/components/air/types"
import { SmokeAlert }       from "@/components/air/smoke-alert"
import { AQIOverlay }       from "@/components/air/aqi-overlay"
import { EnvStatus }        from "@/components/air/env-status"
import { AQILegend }        from "@/components/air/aqi-legend"
import { ThreatIndicator }  from "@/components/air/threat-indicator"
import { ActionPlan }       from "@/components/air/action-plan"
import { AIBriefing }       from "@/components/air/ai-briefing"
import { IncidentTimeline } from "@/components/air/incident-timeline"
import { ScenarioControls } from "@/components/air/scenario-controls"

const AirMap = dynamic(
  () => import("@/components/air/air-map").then(m => m.AirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function AirPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("none")
  const scenario = SCENARIOS[scenarioId]

  const rawAQI = useMemo(
    () => computeAQI(scenario.fires, scenario.env.wind, MAP_CENTER.lat, MAP_CENTER.lng),
    [scenario]
  )
  const aqiData = useMemo(() => aqiInfo(rawAQI, 127_450), [rawAQI])
  const threat  = computeThreatLevel(rawAQI)

  return (
    <div
      className="h-screen w-screen flex flex-col bg-background overflow-hidden"
      data-threat={threat}
    >
      <div className="pointer-events-none fixed inset-0 z-[9999] scanline-overlay" />

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
        <div className="flex items-center gap-4">
          <ThreatIndicator level={threat} />
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-red-500"
              style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
            />
            <span className="text-xs font-mono text-muted-foreground">LIVE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <AirMap wind={scenario.env.wind} />
        <SmokeAlert wind={scenario.env.wind} />
        <AQIOverlay info={aqiData} />
        <EnvStatus env={scenario.env} />
        <AQILegend />

        <div className="absolute top-14 right-4 z-[1000] w-64 flex flex-col gap-3 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-none">
          <ActionPlan threat={threat} aqi={rawAQI} />
          <AIBriefing threat={threat} env={scenario.env} />
          <IncidentTimeline scenarioId={scenarioId} />
        </div>

        <ScenarioControls active={scenarioId} onSelect={setScenarioId} />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run in `frontend/`:
```
npx tsc --noEmit
```
Expected: errors only about missing new component files (ThreatIndicator, ActionPlan, etc.) — that's fine, they'll be created in later tasks.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/air/types.ts frontend/app/air/page.tsx
git commit -m "feat(air): add scenario/threat types and lift state to page"
```

---

## Task 2: CSS Animations + ThreatIndicator Component

**Files:**
- Modify: `frontend/app/globals.css`
- Create: `frontend/components/air/threat-indicator.tsx`

- [ ] **Step 1: Add animations to globals.css**

Append to the end of `frontend/app/globals.css`:

```css
/* ── SENTINEL Command Center Animations ── */

@keyframes threatPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50%       { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
}

@keyframes threatPulseOrange {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.5); }
  50%       { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); }
}

@keyframes ambientPulse {
  0%, 100% { opacity: 0.025; }
  50%       { opacity: 0.05;  }
}

@keyframes slideInRight {
  from { transform: translateX(16px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes fadeInUp {
  from { transform: translateY(6px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

@keyframes borderGlow {
  0%, 100% { border-color: rgba(239, 68, 68, 0.2); }
  50%       { border-color: rgba(239, 68, 68, 0.6); }
}

/* Scanline texture overlay for cinematic atmosphere */
.scanline-overlay {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.025) 2px,
    rgba(0, 0, 0, 0.025) 4px
  );
  animation: ambientPulse 5s ease-in-out infinite;
  pointer-events: none;
}

/* Hide scrollbar utility */
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 2: Create threat-indicator.tsx**

Create `frontend/components/air/threat-indicator.tsx`:

```tsx
"use client"

import { THREAT_COLORS, type ThreatLevel } from "./types"

interface Props { level: ThreatLevel }

const LABELS: Record<ThreatLevel, string> = {
  LOW:      "THREAT: LOW",
  MODERATE: "THREAT: MODERATE",
  HIGH:     "THREAT: HIGH",
  CRITICAL: "THREAT: CRITICAL",
}

export function ThreatIndicator({ level }: Props) {
  const color = THREAT_COLORS[level]
  const isCritical = level === "CRITICAL"
  const isHigh     = level === "HIGH"

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-sm border font-mono"
      style={{
        borderColor:     `${color}50`,
        backgroundColor: `${color}12`,
        animation: isCritical
          ? "threatPulse 1.4s ease-in-out infinite"
          : isHigh
            ? "threatPulseOrange 2s ease-in-out infinite"
            : undefined,
      }}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{
          backgroundColor: color,
          animation: "smokeAlertBlink 1.2s ease-in-out infinite",
        }}
      />
      <span
        className="text-[10px] font-semibold tracking-widest"
        style={{ color }}
      >
        {LABELS[level]}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles (only missing-component errors expected)**

```
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css frontend/components/air/threat-indicator.tsx
git commit -m "feat(air): add cinematic CSS animations and ThreatIndicator component"
```

---

## Task 3: AI Action Plan Panel

**Files:**
- Create: `frontend/components/air/action-plan.tsx`

- [ ] **Step 1: Create action-plan.tsx**

Create `frontend/components/air/action-plan.tsx`:

```tsx
"use client"

import { THREAT_COLORS, type ThreatLevel } from "./types"

interface Props {
  threat: ThreatLevel
  aqi: number
}

const ACTIONS: Record<ThreatLevel, string[]> = {
  LOW: [
    "Monitor air quality levels",
    "Normal activities permitted",
    "Keep emergency contacts ready",
  ],
  MODERATE: [
    "Sensitive groups reduce outdoor time",
    "Close windows in affected zones",
    "Avoid strenuous outdoor exercise",
    "Alert healthcare facilities",
  ],
  HIGH: [
    "Suspend outdoor school activities",
    "Deploy N95 masks to vulnerable zones",
    "Avoid outdoor exercise — all groups",
    "Prepare emergency response teams",
    "Alert nearby hospitals",
    "Issue public health advisory",
  ],
  CRITICAL: [
    "IMMEDIATE: Evacuate affected zones",
    "Suspend ALL outdoor activities",
    "Deploy emergency medical units",
    "Activate incident command center",
    "Issue emergency broadcast alert",
    "Request regional air support",
    "Open emergency shelters",
  ],
}

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function ActionPlan({ threat, aqi }: Props) {
  const color   = THREAT_COLORS[threat]
  const actions = ACTIONS[threat]

  return (
    <div
      className="bg-black/80 backdrop-blur-md border rounded-sm p-3 font-mono"
      style={{
        borderColor: `${color}40`,
        animation:   "slideInRight 0.4s ease-out",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] tracking-widest uppercase font-semibold"
          style={{ color }}
        >
          AI RESPONSE PLAN
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: `${color}30` }} />
        <span className="text-[9px] text-muted-foreground tabular-nums">
          AQI {Math.round(aqi)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {actions.map((action, i) => (
          <div
            key={action}
            className="flex items-start gap-2"
            style={{ animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both` }}
          >
            <span
              className="text-[10px] font-bold tabular-nums flex-shrink-0 mt-px"
              style={{ color }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-foreground/80 leading-tight">{action}</span>
          </div>
        ))}
      </div>

      <div
        className="mt-3 pt-2 border-t"
        style={{ borderColor: `${color}20` }}
      >
        <span className="text-[9px] text-muted-foreground">
          Generated by SENTINEL AI · {now()}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/air/action-plan.tsx
git commit -m "feat(air): add AI Action Plan panel with threat-aware response actions"
```

---

## Task 4: AI Briefing + Incident Timeline

**Files:**
- Create: `frontend/components/air/ai-briefing.tsx`
- Create: `frontend/components/air/incident-timeline.tsx`

- [ ] **Step 1: Create ai-briefing.tsx**

Create `frontend/components/air/ai-briefing.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import type { ThreatLevel, EnvData } from "./types"

interface Props {
  threat: ThreatLevel
  env: EnvData
}

const BRIEFINGS: Record<ThreatLevel, string[]> = {
  LOW: [
    "Air quality remains within acceptable parameters across all monitored zones.",
    "Smoke density is minimal. No immediate risk to public health detected.",
    "Wind conditions are favorable. Dispersion rates are adequate.",
  ],
  MODERATE: [
    "Smoke propagation identified, moving toward residential sectors at 24 km/h.",
    "AQI levels are approaching concerning thresholds in northwest districts.",
    "Sensitive populations should begin precautionary indoor measures.",
  ],
  HIGH: [
    "Smoke density is increasing toward populated sectors northwest of the fire source.",
    "Projected AQI deterioration may affect vulnerable populations within 2 hours.",
    "Wind vectoring at 315° is accelerating smoke drift toward the Temuco corridor.",
    "Healthcare facilities in the affected radius have been placed on standby.",
  ],
  CRITICAL: [
    "CRITICAL: Smoke concentration has exceeded safe exposure thresholds.",
    "Emergency response teams have been activated across all affected zones.",
    "Population in the primary exposure corridor must seek shelter immediately.",
    "Air quality is projected to remain critical for the next 4–6 hours.",
  ],
}

export function AIBriefing({ threat, env }: Props) {
  const briefings = BRIEFINGS[threat]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % briefings.length)
        setVisible(true)
      }, 350)
    }, 5500)
    return () => clearInterval(iv)
  }, [briefings.length])

  useEffect(() => {
    setIndex(0)
    setVisible(true)
  }, [threat])

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
          AI INTELLIGENCE
        </span>
        <div className="flex-1 h-px bg-white/10" />
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"
          style={{ animation: "smokeAlertBlink 2.5s ease-in-out infinite" }}
        />
      </div>

      <p
        className="text-[11px] text-foreground/75 leading-relaxed italic"
        style={{
          opacity:    visible ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
      >
        "{briefings[index]}"
      </p>

      <div className="flex gap-1 mt-2.5">
        {briefings.map((_, i) => (
          <div
            key={i}
            className="h-px flex-1 rounded-full transition-colors duration-500"
            style={{
              backgroundColor:
                i === index ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create incident-timeline.tsx**

Create `frontend/components/air/incident-timeline.tsx`:

```tsx
"use client"

import { THREAT_COLORS, type ThreatLevel, type ScenarioId } from "./types"

interface Props { scenarioId: ScenarioId }

interface Event {
  id:      string
  time:    string
  message: string
  level:   ThreatLevel
}

const BASE_EVENTS: Event[] = [
  { id: "e1", time: "13:42", message: "Wildfire detected — FIRE-001 active",           level: "HIGH"     },
  { id: "e2", time: "13:47", message: "Smoke propagation identified",                  level: "HIGH"     },
  { id: "e3", time: "13:51", message: "FIRE-002 escalated to PRIMARY",                 level: "CRITICAL" },
  { id: "e4", time: "13:53", message: "AQI deterioration forecasted",                  level: "MODERATE" },
  { id: "e5", time: "13:55", message: "Emergency alerts dispatched",                   level: "HIGH"     },
  { id: "e6", time: "13:58", message: "32K population in exposure corridor",           level: "HIGH"     },
]

const SCENARIO_EVENTS: Record<string, Event[]> = {
  wind: [
    { id: "w1", time: "14:02", message: "Wind intensification detected — 52 km/h",    level: "CRITICAL" },
    { id: "w2", time: "14:05", message: "Smoke drift velocity escalated significantly",level: "CRITICAL" },
  ],
  humidity: [
    { id: "h1", time: "14:02", message: "Relative humidity critical — 8%",             level: "CRITICAL" },
    { id: "h2", time: "14:05", message: "Fire spread risk elevated to CRITICAL",        level: "CRITICAL" },
  ],
  worst: [
    { id: "x1", time: "14:02", message: "Worst-case scenario conditions active",       level: "CRITICAL" },
    { id: "x2", time: "14:04", message: "All parameters at critical threshold",         level: "CRITICAL" },
    { id: "x3", time: "14:06", message: "Emergency evacuation recommended",            level: "CRITICAL" },
  ],
}

export function IncidentTimeline({ scenarioId }: Props) {
  const extra  = scenarioId !== "none" ? (SCENARIO_EVENTS[scenarioId] ?? []) : []
  const events = [...BASE_EVENTS, ...extra].slice(-7)

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">
      <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold mb-3">
        INCIDENT LOG
      </p>
      <div className="flex flex-col gap-2">
        {events.map((ev, i) => {
          const color = THREAT_COLORS[ev.level]
          const opacity = 0.45 + 0.55 * (i / Math.max(events.length - 1, 1))
          return (
            <div
              key={ev.id}
              className="flex items-start gap-2"
              style={{ opacity }}
            >
              <span className="text-[9px] text-muted-foreground tabular-nums flex-shrink-0 mt-0.5">
                {ev.time}
              </span>
              <div
                className="w-px self-stretch flex-shrink-0 rounded-full"
                style={{ backgroundColor: color + "70" }}
              />
              <span className="text-[10px] text-foreground/70 leading-tight">{ev.message}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/air/ai-briefing.tsx frontend/components/air/incident-timeline.tsx
git commit -m "feat(air): add AI Briefing panel and live Incident Timeline"
```

---

## Task 5: Population Exposure Upgrade + Infrastructure Markers in AirMap

**Files:**
- Modify: `frontend/components/air/aqi-overlay.tsx`
- Modify: `frontend/components/air/air-map.tsx`

- [ ] **Step 1: Add population exposure projection to aqi-overlay.tsx**

Replace the entire `frontend/components/air/aqi-overlay.tsx` with:

```tsx
"use client"

import type { AQIInfo } from "./types"
import { aqiColor } from "./types"

interface Props { info: AQIInfo }

const RECOMMENDATIONS: Record<AQIInfo["riskLevel"], string[]> = {
  "LOW":       ["Monitor air quality", "Normal activities OK", "Stay informed"],
  "MODERATE":  ["Avoid outdoor exercise", "Close windows and doors", "Sensitive groups stay in"],
  "HIGH":      ["Wear N95 mask outdoors", "Close windows and doors", "Avoid outdoor exercise", "Sensitive groups stay in"],
  "VERY HIGH": ["Evacuate if possible", "Wear N95 mask at all times", "Do not go outdoors", "Emergency services on alert"],
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function AQIOverlay({ info }: Props) {
  const barPct    = Math.min(100, (info.current / 300) * 100)
  const pred2hCol = aqiColor(info.predicted2h)
  const recs      = RECOMMENDATIONS[info.riskLevel]

  // Exposure growth: current is the 2h projected max; now is 25%, 1h is 53%
  const popNow  = Math.round(info.affectedPopulation * 0.25)
  const pop1h   = Math.round(info.affectedPopulation * 0.535)
  const pop2h   = info.affectedPopulation

  return (
    <div className="absolute top-14 left-4 z-[1000] w-52 flex flex-col gap-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">

      <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
        Air Quality Index
      </p>

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
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barPct}%`, backgroundColor: info.colorHex }}
          />
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">+2h Forecast</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: pred2hCol }}>
          {info.predicted2h}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">Risk Level</span>
        <span className="text-xs font-semibold" style={{ color: info.colorHex }}>
          {info.riskLevel}
        </span>
      </div>

      <div className="h-px bg-white/10" />

      {/* Population Exposure Projection */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-2">Exposure Projection</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "NOW", pop: popNow },
            { label: "+1H", pop: pop1h  },
            { label: "+2H", pop: pop2h  },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground w-8">{row.label}</span>
              <div className="flex-1 mx-2 h-px bg-white/5" />
              <span
                className="text-[10px] font-semibold tabular-nums"
                style={{ color: info.colorHex }}
              >
                {formatPop(row.pop)} exp.
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-2">Recommendations</p>
        <div className="flex flex-col gap-1.5">
          {recs.map(rec => (
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

- [ ] **Step 2: Add wind prop + infrastructure markers to air-map.tsx**

Replace the entire `frontend/components/air/air-map.tsx` with:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { drawFrame }         from "./smoke-engine"
import { MOCK_ENV, MOCK_INFRASTRUCTURE, type WindData } from "./types"

const TOKEN =
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const SMOKE_SOURCES = [
  { id: "src-a", lng: -71.73, lat: -38.14, intensity: 0.75 },
  { id: "src-b", lng: -72.08, lat: -38.42, intensity: 1.00 },
]

const INFRA_COLORS = { hospital: "#ef4444", school: "#f97316", emergency: "#3b82f6" } as const

interface Props { wind: WindData }

export function AirMap({ wind }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const mapRef          = useRef<any>(null)
  const rafRef          = useRef<number>(0)
  const windRef         = useRef<WindData>(wind)

  // Keep wind ref current so the RAF loop always uses latest wind
  useEffect(() => { windRef.current = wind }, [wind])

  useEffect(() => {
    // Inject Mapbox CSS from CDN — bypasses any Turbopack resolution issues
    if (!document.getElementById("mbgl-css")) {
      const link = document.createElement("link")
      link.id   = "mbgl-css"
      link.rel  = "stylesheet"
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
      document.head.appendChild(link)
    }

    const el  = mapContainerRef.current
    const cvs = canvasRef.current
    if (!el || !cvs) return
    if (mapRef.current) return

    let cancelled = false
    const ctx     = cvs.getContext("2d")!
    const start   = performance.now()

    cvs.width  = window.innerWidth
    cvs.height = window.innerHeight

    const onResize = () => {
      cvs.width  = window.innerWidth
      cvs.height = window.innerHeight
    }
    window.addEventListener("resize", onResize)

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return

      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style:     "mapbox://styles/mapbox/satellite-streets-v12",
        center:    [-71.90, -38.28],
        zoom:      9,
        attributionControl: false,
      })
      mapRef.current = map

      // Add infrastructure markers when map style loads
      map.on("load", () => {
        MOCK_INFRASTRUCTURE.forEach(infra => {
          const dot = document.createElement("div")
          const col = INFRA_COLORS[infra.type]
          Object.assign(dot.style, {
            width:           "10px",
            height:          "10px",
            backgroundColor: col,
            border:          "1.5px solid rgba(255,255,255,0.8)",
            borderRadius:    "50%",
            boxShadow:       `0 0 8px ${col}90, 0 0 2px ${col}`,
            cursor:          "pointer",
          })
          new mapboxgl.Marker({ element: dot })
            .setLngLat([infra.lng, infra.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 12, closeButton: false })
                .setHTML(
                  `<div style="font-family:monospace;font-size:10px;color:#e8e6e0;background:#0a0a0a;padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1)">${infra.name}</div>`
                )
            )
            .addTo(map)
        })
      })

      function loop() {
        if (cancelled) return

        const w       = cvs.width
        const h       = cvs.height
        const elapsed = performance.now() - start
        const currentWind = windRef.current

        ctx.clearRect(0, 0, w, h)

        if (map.loaded()) {
          // AQI impact halos
          SMOKE_SOURCES.forEach(src => {
            const px = map.project([src.lng, src.lat])
            const r  = 110 * src.intensity
            const g  = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, r * 2.8)
            g.addColorStop(0,    `rgba(239,68,68,${(0.13 * src.intensity).toFixed(3)})`)
            g.addColorStop(0.45, `rgba(249,115,22,${(0.08 * src.intensity).toFixed(3)})`)
            g.addColorStop(1,    "rgba(239,68,68,0)")
            ctx.beginPath()
            ctx.arc(px.x, px.y, r * 2.8, 0, Math.PI * 2)
            ctx.fillStyle = g
            ctx.fill()
          })

          // Smoke puffs
          const sources = SMOKE_SOURCES.map(src => {
            const px = map.project([src.lng, src.lat])
            return { id: src.id, x: px.x, y: px.y, intensity: src.intensity }
          })
          drawFrame(ctx, sources, currentWind, elapsed)
        }

        rafRef.current = requestAnimationFrame(loop)
      }

      loop()
    }).catch(err => console.error("[AirMap] mapbox-gl load failed:", err))

    return () => {
      cancelled = true
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(rafRef.current)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const hospitals  = MOCK_INFRASTRUCTURE.filter(i => i.type === "hospital").length
  const schools    = MOCK_INFRASTRUCTURE.filter(i => i.type === "school").length

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Infrastructure at-risk count overlay */}
      <div
        className="absolute font-mono flex flex-col gap-1.5"
        style={{ top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}
      >
        <div className="px-2 py-1 bg-black/75 backdrop-blur-sm border border-red-500/40 rounded-sm text-[10px] text-red-400 whitespace-nowrap">
          ⚠ {hospitals} Hospital in smoke zone
        </div>
        <div className="px-2 py-1 bg-black/75 backdrop-blur-sm border border-orange-500/40 rounded-sm text-[10px] text-orange-400 whitespace-nowrap">
          ⚠ {schools} Schools at risk
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          position:      "absolute",
          inset:         0,
          width:         "100%",
          height:        "100%",
          zIndex:        10,
          filter:        "blur(1.5px)",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/air/aqi-overlay.tsx frontend/components/air/air-map.tsx
git commit -m "feat(air): population exposure projections + infrastructure markers on map"
```

---

## Task 6: Scenario Simulation Controls

**Files:**
- Create: `frontend/components/air/scenario-controls.tsx`

- [ ] **Step 1: Create scenario-controls.tsx**

Create `frontend/components/air/scenario-controls.tsx`:

```tsx
"use client"

import type { ScenarioId } from "./types"

interface Props {
  active:   ScenarioId
  onSelect: (id: ScenarioId) => void
}

const BUTTONS: { id: Exclude<ScenarioId, "none">; label: string; danger: boolean }[] = [
  { id: "wind",     label: "Wind Intensifies",  danger: false },
  { id: "humidity", label: "Humidity Drops",     danger: false },
  { id: "worst",    label: "⚠ Worst Case",       danger: true  },
]

export function ScenarioControls({ active, onSelect }: Props) {
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 font-mono">
      <span className="text-[9px] text-muted-foreground tracking-widest uppercase mr-1 select-none">
        SIMULATE
      </span>
      {BUTTONS.map(btn => {
        const isActive = active === btn.id
        const activeColor = btn.danger ? "#ef4444" : "#f97316"
        return (
          <button
            key={btn.id}
            onClick={() => onSelect(isActive ? "none" : btn.id)}
            className="px-3 py-1.5 text-[10px] rounded-sm border transition-all duration-300 tracking-wide"
            style={{
              borderColor:     isActive ? activeColor           : "rgba(255,255,255,0.15)",
              color:           isActive ? activeColor           : "rgba(255,255,255,0.45)",
              backgroundColor: isActive ? `${activeColor}15`   : "rgba(0,0,0,0.6)",
              boxShadow:       isActive ? `0 0 12px ${activeColor}30` : "none",
            }}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```
npx tsc --noEmit
```

Expected: zero errors (all components now exist).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/air/scenario-controls.tsx
git commit -m "feat(air): add scenario simulation controls (wind, humidity, worst-case)"
```

---

## Task 7: Enhanced Smoke Engine + Status Cards Upgrade

**Files:**
- Modify: `frontend/components/air/smoke-engine.ts`
- Modify: `frontend/components/air/env-status.tsx`

- [ ] **Step 1: Enhance smoke-engine.ts**

Replace the entire `frontend/components/air/smoke-engine.ts` with:

```typescript
import type { WindData } from "./types"

export interface SmokeSource {
  id:        string
  x:         number
  y:         number
  intensity: number
}

const PUFF_COUNT    = 28
const PUFF_DURATION = 5000
const MAX_DRIFT_PX  = 420

function windCanvasVec(wind: WindData): { dx: number; dy: number } {
  const toRad = ((wind.fromDeg + 180) % 360) * (Math.PI / 180)
  return { dx: Math.sin(toRad), dy: -Math.cos(toRad) }
}

function drawHaze(
  ctx:     CanvasRenderingContext2D,
  sources: SmokeSource[],
  wind:    WindData,
  elapsed: number
): void {
  const { dx, dy } = windCanvasVec(wind)
  const windMag    = wind.speed / 24

  sources.forEach(src => {
    for (let i = 0; i < 6; i++) {
      const t     = ((elapsed * 0.28 + i * 900) % 7000) / 7000
      const drift = t * 700 * windMag
      const hx    = src.x + dx * drift
      const hy    = src.y + dy * drift
      const r     = (90 + t * 280) * src.intensity
      const alpha = Math.sin(t * Math.PI) * 0.055 * src.intensity

      if (alpha < 0.002) continue

      const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, r)
      grad.addColorStop(0, `rgba(110,108,118,${alpha.toFixed(3)})`)
      grad.addColorStop(1, "rgba(70,70,80,0)")
      ctx.beginPath()
      ctx.arc(hx, hy, r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }
  })
}

export function drawFrame(
  ctx:     CanvasRenderingContext2D,
  sources: SmokeSource[],
  wind:    WindData,
  elapsed: number
): void {
  const { dx, dy } = windCanvasVec(wind)
  const windMag    = wind.speed / 24

  // Background atmospheric haze layer
  drawHaze(ctx, sources, wind, elapsed)

  sources.forEach(src => {
    const ox = src.x
    const oy = src.y

    // Smoke puffs
    for (let i = 0; i < PUFF_COUNT; i++) {
      const phaseMs = (i / PUFF_COUNT) * PUFF_DURATION
      const t       = ((elapsed + phaseMs) % PUFF_DURATION) / PUFF_DURATION

      const drift = t * MAX_DRIFT_PX * windMag
      const wobX  = Math.sin(t * Math.PI * 3.5 + i * 1.3) * 18
      const wobY  = Math.cos(t * Math.PI * 2.8 + i * 0.9) * 12

      const sx     = ox + dx * drift + wobX
      const sy     = oy + dy * drift + wobY
      const radius = (18 + t * 120) * src.intensity
      const alpha  = Math.sin(t * Math.PI) * 0.20 * src.intensity

      if (alpha < 0.005 || radius < 1) continue

      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(Math.atan2(dy, dx))
      ctx.scale(1.5, 1)

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      grad.addColorStop(0,   `rgba(155,152,168,${alpha.toFixed(3)})`)
      grad.addColorStop(0.4, `rgba(115,112,128,${(alpha * 0.65).toFixed(3)})`)
      grad.addColorStop(0.8, `rgba(80,78,92,${(alpha * 0.25).toFixed(3)})`)
      grad.addColorStop(1,   "rgba(60,60,72,0)")

      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // Emission point glow — neutral gray
    const pulse = 0.28 + Math.sin(elapsed / 550) * 0.07
    const glow  = ctx.createRadialGradient(ox, oy, 0, ox, oy, 48)
    glow.addColorStop(0,   `rgba(185,175,165,${pulse.toFixed(3)})`)
    glow.addColorStop(0.5, `rgba(135,128,122,${(pulse * 0.4).toFixed(3)})`)
    glow.addColorStop(1,   "rgba(80,80,80,0)")

    ctx.beginPath()
    ctx.arc(ox, oy, 48, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  })
}
```

- [ ] **Step 2: Upgrade env-status.tsx**

Replace the entire `frontend/components/air/env-status.tsx` with:

```tsx
"use client"

import { Wind, Droplets, Thermometer, Eye } from "lucide-react"
import type { EnvData } from "./types"

interface Props { env: EnvData }

const BEARING_NAMES = ["N","NE","E","SE","S","SW","W","NW"]
function bearingName(deg: number): string {
  return BEARING_NAMES[Math.round(deg / 45) % 8]
}

export function EnvStatus({ env }: Props) {
  const windDir    = bearingName(env.wind.fromDeg)
  const highWind   = env.wind.speed > 40
  const lowHumid   = env.humidity < 15
  const highTemp   = env.tempC > 35
  const lowVis     = env.visibilityKm < 1.5

  const chips = [
    {
      Icon:  Wind,
      label: "WIND",
      value: `${env.wind.speed} km/h ${windDir}`,
      alert: highWind,
      color: highWind ? "#ef4444" : undefined,
    },
    {
      Icon:  Droplets,
      label: "HUMIDITY",
      value: `${env.humidity}%`,
      alert: lowHumid,
      color: lowHumid ? "#f97316" : undefined,
    },
    {
      Icon:  Thermometer,
      label: "TEMP",
      value: `${env.tempC}°C`,
      alert: highTemp,
      color: highTemp ? "#f97316" : undefined,
    },
    {
      Icon:  Eye,
      label: "VISIBILITY",
      value: `${env.visibilityKm} km`,
      alert: lowVis,
      color: lowVis ? "#ef4444" : undefined,
    },
  ]

  return (
    <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-1 font-mono">
      <div className="flex gap-2">
        {chips.map(chip => (
          <div
            key={chip.label}
            className="flex flex-col gap-1 px-3 py-2 bg-black/80 backdrop-blur-md border rounded-sm transition-all duration-500"
            style={{
              borderColor:  chip.alert ? `${chip.color}60` : "rgba(255,255,255,0.1)",
              boxShadow:    chip.alert ? `0 0 8px ${chip.color}25` : "none",
            }}
          >
            <div className="flex items-center gap-1.5">
              <chip.Icon
                className="h-3 w-3 flex-shrink-0"
                style={{ color: chip.alert ? chip.color : "var(--muted-foreground)" }}
              />
              <span className="text-[9px] tracking-widest text-muted-foreground">{chip.label}</span>
              {chip.alert && (
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: chip.color,
                    animation:       "smokeAlertBlink 1s ease-in-out infinite",
                  }}
                />
              )}
            </div>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: chip.alert ? chip.color : "rgba(232,230,224,0.8)" }}
            >
              {chip.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript — zero errors expected**

```
npx tsc --noEmit
```
Expected: clean compilation.

- [ ] **Step 4: Push everything**

```bash
git add frontend/components/air/smoke-engine.ts frontend/components/air/env-status.tsx
git commit -m "feat(air): enhanced smoke engine with haze layer + upgraded env status cards"
git push origin frontendaire
```

---

## Self-Review

**Spec coverage:**
1. ✅ AI Action Plan Panel — `action-plan.tsx`, threat-aware ACTIONS record
2. ✅ Dynamic Threat Level System — `threat-indicator.tsx`, `computeThreatLevel()`, data-threat attr on root div
3. ✅ Live Incident Timeline — `incident-timeline.tsx`, scenario-aware extra events
4. ✅ Infrastructure at Risk Layer — Mapbox markers + count overlay in `air-map.tsx`
5. ✅ Population Exposure Estimator — Now/+1H/+2H rows in `aqi-overlay.tsx`
6. ✅ AI Environmental Briefing — `ai-briefing.tsx`, rotating narration per threat level
7. ✅ Advanced Smoke Visualization — enhanced `smoke-engine.ts` (28 puffs, haze layer)
8. ✅ Cinematic Atmosphere — scanline overlay, `globals.css` animations, glow effects
9. ✅ Responsive Status Cards — upgraded `env-status.tsx` with alert states
10. ✅ Scenario Simulation — `scenario-controls.tsx`, scenarioId state in `page.tsx`, wind prop on `AirMap`

**Placeholder scan:** No TBDs or vague steps found.

**Type consistency:** `ScenarioId`, `ThreatLevel`, `InfrastructurePoint` defined in Task 1 and used consistently in all subsequent tasks. `WindData` prop on `AirMap` uses the same interface from types.ts.
