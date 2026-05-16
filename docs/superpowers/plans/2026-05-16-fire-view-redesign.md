# Fire View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the SENTINEL dashboard fire view with a 3-column layout: fire list (left), map with expansion control (center), operational intelligence (right). All data driven by the selected fire + expansion range.

**Architecture:** A single `FireViewContext` manages selected fire, expansion range, and view mode. Three new panel components consume this context. The existing mapbox rendering logic is preserved but moved into the new `FireMapView` component. Auto-selection of the most critical fire on load.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Mapbox GL JS, Lucide icons, existing SentinelProvider/useSocket infrastructure.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/contexts/fire-view-context.tsx` | Central state: selectedFire, expansionRange, fires[], viewMode |
| Create | `frontend/components/dashboard/fire-list-panel.tsx` | Left panel: fire list + summary footer |
| Create | `frontend/components/dashboard/expansion-control.tsx` | Floating 2H/6H/12H toggle over map |
| Create | `frontend/components/dashboard/fire-map-view.tsx` | Map wrapper + expansion control + mapbox engine |
| Create | `frontend/components/dashboard/fire-intel-panel.tsx` | Right panel: operational intelligence |
| Modify | `frontend/app/dashboard/page.tsx` | New layout with new components |
| Modify | `frontend/components/dashboard/top-bar.tsx` | Add mode selector (Fuego Actual / Zonas de Riesgo) |
| Delete | `frontend/components/dashboard/left-panel.tsx` | Replaced by fire-list-panel |
| Delete | `frontend/components/dashboard/right-panel.tsx` | Replaced by fire-intel-panel |
| Delete | `frontend/components/dashboard/map-panel.tsx` | Replaced by fire-map-view |
| Delete | `frontend/components/dashboard/mapbox-panel.tsx` | Merged into fire-map-view |
| Delete | `frontend/contexts/fire-selection-context.tsx` | Replaced by fire-view-context |

---

### Task 1: Create FireViewContext

**Files:**
- Create: `frontend/contexts/fire-view-context.tsx`

- [ ] **Step 1: Create the context file**

```tsx
"use client"

import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react"
import { useSentinel } from "@/contexts/sentinel-context"
import { degToCompass } from "@/lib/utils"

export type FireIntensity = 'critical' | 'high' | 'moderate'
export type ExpansionRange = '2h' | '6h' | '12h'
export type ViewMode = 'fire' | 'risk-zones'

export interface FireExpansion {
  km2: number
  ha: number
}

export interface SelectedFireData {
  id: string
  lat: number
  lon: number
  frp: number
  brightness: number
  intensity: FireIntensity
  windDir: string
  windKmh: number
  expansion2h: FireExpansion
  expansion6h: FireExpansion
  expansion12h: FireExpansion
}

function computeExpansion(windSpeedMs: number, hours: number): FireExpansion {
  const windKmh = windSpeedMs * 3.6
  const ros_f = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_b = 0.3
  const ros_l = Math.sqrt(ros_f * ros_b)
  const a = (ros_f * hours + ros_b * hours) / 2
  const b = Math.max(ros_l * hours, 0.3)
  const km2 = Math.PI * a * b
  return { km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) }
}

function classifyIntensity(frp: number): FireIntensity {
  if (frp >= 300) return 'critical'
  if (frp >= 100) return 'high'
  return 'moderate'
}

interface FireViewContextValue {
  fires: SelectedFireData[]
  selectedFire: SelectedFireData
  expansionRange: ExpansionRange
  viewMode: ViewMode
  selectFire: (id: string) => void
  setExpansionRange: (range: ExpansionRange) => void
  setViewMode: (mode: ViewMode) => void
}

const FireViewContext = createContext<FireViewContextValue | null>(null)

export function FireViewProvider({ children }: { children: ReactNode }) {
  const { sentinelUpdate } = useSentinel()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expansionRange, setExpansionRange] = useState<ExpansionRange>('2h')
  const [viewMode, setViewMode] = useState<ViewMode>('fire')

  const fires = useMemo(() => {
    if (!sentinelUpdate) return []
    const wSpeed = sentinelUpdate.weather?.speed ?? 6.7
    const wDeg = sentinelUpdate.weather?.deg ?? 315
    const spreadDir = degToCompass((wDeg + 180) % 360)
    const wKmh = Math.round(wSpeed * 3.6)

    return sentinelUpdate.fires
      .map((f, i) => ({
        id: `FIRE-${String(i + 1).padStart(3, '0')}`,
        lat: f.lat,
        lon: f.lon,
        frp: f.frp,
        brightness: f.brightness,
        intensity: classifyIntensity(f.frp),
        windDir: spreadDir,
        windKmh: wKmh,
        expansion2h: computeExpansion(wSpeed, 2),
        expansion6h: computeExpansion(wSpeed, 6),
        expansion12h: computeExpansion(wSpeed, 12),
      }))
      .sort((a, b) => b.frp - a.frp)
  }, [sentinelUpdate])

  // Auto-select most critical fire, or preserve selection if still valid
  useEffect(() => {
    if (fires.length === 0) return
    if (selectedId && fires.some(f => f.id === selectedId)) return
    setSelectedId(fires[0].id)
  }, [fires, selectedId])

  const selectedFire = fires.find(f => f.id === selectedId) ?? fires[0]

  const selectFire = (id: string) => {
    setSelectedId(id)
  }

  // Don't render until we have fires
  if (!selectedFire) return null

  return (
    <FireViewContext.Provider value={{
      fires,
      selectedFire,
      expansionRange,
      viewMode,
      selectFire,
      setExpansionRange,
      setViewMode,
    }}>
      {children}
    </FireViewContext.Provider>
  )
}

export function useFireView(): FireViewContextValue {
  const ctx = useContext(FireViewContext)
  if (!ctx) throw new Error("useFireView must be used within <FireViewProvider>")
  return ctx
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit contexts/fire-view-context.tsx 2>&1 | head -20`

Check no type errors. If there are import resolution issues (expected with isolated check), verify manually that the file has no red squiggles in the IDE.

- [ ] **Step 3: Commit**

```bash
git add frontend/contexts/fire-view-context.tsx
git commit -m "feat(fire-view): add FireViewContext with auto-selection and expansion logic"
```

---

### Task 2: Create ExpansionControl component

**Files:**
- Create: `frontend/components/dashboard/expansion-control.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useFireView, type ExpansionRange } from "@/contexts/fire-view-context"

const RANGES: { key: ExpansionRange; label: string }[] = [
  { key: '2h', label: '2H' },
  { key: '6h', label: '6H' },
  { key: '12h', label: '12H' },
]

const COLORS: Record<ExpansionRange, { active: string; border: string }> = {
  '2h':  { active: 'bg-red/20 text-red border-red/40', border: 'shadow-[0_0_12px_rgba(239,68,68,0.2)]' },
  '6h':  { active: 'bg-orange/20 text-orange border-orange/40', border: 'shadow-[0_0_12px_rgba(249,115,22,0.2)]' },
  '12h': { active: 'bg-amber/20 text-amber border-amber/40', border: 'shadow-[0_0_12px_rgba(251,191,36,0.2)]' },
}

export function ExpansionControl() {
  const { expansionRange, setExpansionRange } = useFireView()

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1 bg-[#0a0b0e]/85 border border-white/10 rounded-xl backdrop-blur-xl">
      {RANGES.map(({ key, label }) => {
        const isActive = expansionRange === key
        const colors = COLORS[key]
        return (
          <button
            key={key}
            onClick={() => setExpansionRange(key)}
            className={`px-4 py-2 rounded-lg text-[11px] font-black tracking-[0.1em] transition-all duration-200 border ${
              isActive
                ? `${colors.active} ${colors.border}`
                : 'border-transparent text-text-muted hover:text-foreground hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/expansion-control.tsx
git commit -m "feat(fire-view): add ExpansionControl floating toggle"
```

---

### Task 3: Create FireListPanel (left panel)

**Files:**
- Create: `frontend/components/dashboard/fire-list-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useFireView, type SelectedFireData } from "@/contexts/fire-view-context"

function IntensityBadge({ intensity }: { intensity: SelectedFireData['intensity'] }) {
  const config = {
    critical: { label: 'CRÍTICO', cls: 'text-red border-red/40 bg-red/10' },
    high:     { label: 'ALTO',    cls: 'text-orange border-orange/40 bg-orange/10' },
    moderate: { label: 'MODERADO', cls: 'text-amber border-amber/40 bg-amber/10' },
  }
  const { label, cls } = config[intensity]
  return (
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-[0.12em] border ${cls}`}>
      {label}
    </span>
  )
}

function FireListItem({ fire, isSelected, onSelect }: {
  fire: SelectedFireData
  isSelected: boolean
  onSelect: () => void
}) {
  const borderColor = isSelected
    ? fire.intensity === 'critical' ? 'border-red/40' : fire.intensity === 'high' ? 'border-orange/40' : 'border-amber/40'
    : 'border-white/6'
  const bgColor = isSelected
    ? fire.intensity === 'critical' ? 'bg-red/8' : fire.intensity === 'high' ? 'bg-orange/8' : 'bg-amber/8'
    : 'bg-white/2 hover:bg-white/4'
  const frpColor = fire.intensity === 'critical' ? 'text-red' : fire.intensity === 'high' ? 'text-orange' : 'text-amber'

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border ${borderColor} ${bgColor} transition-all duration-150 cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[11px] font-black tracking-[0.1em] ${isSelected ? 'text-foreground' : 'text-text-2'}`}>
          {fire.id}
        </span>
        <IntensityBadge intensity={fire.intensity} />
      </div>
      <div className="text-[10px] text-text-muted font-mono">
        {fire.lat.toFixed(4)}° / {fire.lon.toFixed(4)}° · <span className={`${frpColor} font-bold`}>{fire.frp.toFixed(0)} MW</span>
      </div>
    </button>
  )
}

function FireSummaryFooter({ fire }: { fire: SelectedFireData }) {
  return (
    <div className="border-t border-border p-4 bg-surface/30">
      <div className="text-[9px] font-black tracking-[0.2em] text-text-muted mb-3">RESUMEN DEL FOCO</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/3 rounded-lg p-2.5">
          <div className="text-[8px] font-bold text-text-muted tracking-[0.15em] mb-1">FRP</div>
          <div className="text-base font-black text-orange num leading-none">
            {fire.frp.toFixed(0)}<span className="text-[9px] text-text-dim ml-1">MW</span>
          </div>
        </div>
        <div className="bg-white/3 rounded-lg p-2.5">
          <div className="text-[8px] font-bold text-text-muted tracking-[0.15em] mb-1">VIENTO</div>
          <div className="text-base font-black text-blue num leading-none">
            {fire.windKmh}<span className="text-[9px] text-text-dim ml-1">km/h {fire.windDir}</span>
          </div>
        </div>
        <div className="bg-white/3 rounded-lg p-2.5">
          <div className="text-[8px] font-bold text-text-muted tracking-[0.15em] mb-1">BRILLO</div>
          <div className="text-base font-black text-foreground num leading-none">
            {fire.brightness.toFixed(0)}<span className="text-[9px] text-text-dim ml-1">K</span>
          </div>
        </div>
        <div className="bg-white/3 rounded-lg p-2.5">
          <div className="text-[8px] font-bold text-text-muted tracking-[0.15em] mb-1">PROPAG.</div>
          <div className="text-base font-black text-blue num leading-none">
            {fire.windDir}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FireListPanel() {
  const { fires, selectedFire, selectFire } = useFireView()

  return (
    <div className="w-[300px] border-r border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface/30">
        <span className="text-[9px] font-black tracking-[0.2em] text-text-muted uppercase">Focos Activos</span>
        <span className="text-sm font-black text-orange num">{fires.length}</span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-1.5">
        {fires.map(fire => (
          <FireListItem
            key={fire.id}
            fire={fire}
            isSelected={fire.id === selectedFire.id}
            onSelect={() => selectFire(fire.id)}
          />
        ))}
      </div>

      {/* Summary footer */}
      <FireSummaryFooter fire={selectedFire} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/fire-list-panel.tsx
git commit -m "feat(fire-view): add FireListPanel with selectable fire list"
```

---

### Task 4: Create FireMapView (center)

**Files:**
- Create: `frontend/components/dashboard/fire-map-view.tsx`

- [ ] **Step 1: Create the component**

This component integrates the existing Mapbox logic from `mapbox-panel.tsx` with the new `FireViewContext`. It renders the map, markers, expansion polygons, and the floating expansion control.

```tsx
"use client"

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useSentinel } from '@/contexts/sentinel-context'
import { useFireView, type SelectedFireData, type ExpansionRange } from '@/contexts/fire-view-context'
import { ExpansionControl } from './expansion-control'

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const EXP_COLORS: Record<ExpansionRange, { core: string; mid: string; outer: string }> = {
  '2h':  { core: '#dc2626', mid: '#ef4444', outer: '#f87171' },
  '6h':  { core: '#c2410c', mid: '#ea580c', outer: '#fb923c' },
  '12h': { core: '#b45309', mid: '#d97706', outer: '#fbbf24' },
}

const HOURS: Record<ExpansionRange, number> = { '2h': 2, '6h': 6, '12h': 12 }

function makeFireSpreadPolygon(
  lat: number, lon: number,
  windDegFrom: number, windSpeedMs: number,
  hours: number
) {
  const windKmh = windSpeedMs * 3.6
  const spreadRad = ((windDegFrom + 180) % 360) * (Math.PI / 180)
  const sinS = Math.sin(spreadRad)
  const cosS = Math.cos(spreadRad)
  const ros_forward = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_backing = 0.3
  const ros_flank = Math.sqrt(ros_forward * ros_backing)
  const d_forward = ros_forward * hours
  const d_backing = ros_backing * hours
  const d_flank = Math.max(ros_flank * hours, 0.3)
  const a = (d_forward + d_backing) / 2
  const b = d_flank
  const center_offset = (d_forward - d_backing) / 2
  const cosLat = Math.cos(lat * Math.PI / 180)
  const kmToDegLat = 1 / 111
  const kmToDegLon = 1 / (111 * cosLat)
  const centerLat = lat + cosS * center_offset * kmToDegLat
  const centerLon = lon + sinS * center_offset * kmToDegLon
  const coords: number[][] = []
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    const localAlong = a * Math.cos(angle)
    const localPerp = b * Math.sin(angle)
    const east = localAlong * sinS + localPerp * (-cosS)
    const north = localAlong * cosS + localPerp * sinS
    coords.push([centerLon + east * kmToDegLon, centerLat + north * kmToDegLat])
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

function MapboxEngine() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const { sentinelUpdate } = useSentinel()
  const { fires, selectedFire, selectFire, expansionRange } = useFireView()

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-71.90, -38.28],
      zoom: 9,
      projection: 'globe' as any,
    })
    map.on('style.load', () => {
      map.setFog({
        'color': 'rgba(56, 189, 248, 0.15)',
        'high-color': 'rgba(10, 11, 14, 0.8)',
        'horizon-blend': 0.2,
        'space-color': 'rgb(2, 2, 5)',
        'star-intensity': 0.9,
      })
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Render fire markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    fires.forEach(fire => {
      const isSelected = fire.id === selectedFire.id
      const color = fire.intensity === 'critical' ? '#ef4444' : fire.intensity === 'high' ? '#f97316' : '#fbbf24'
      const size = isSelected ? 36 : 28

      const el = document.createElement('div')
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.cursor = 'pointer'
      el.className = 'relative flex items-center justify-center'

      if (isSelected) {
        const glow = document.createElement('div')
        glow.className = 'absolute inset-0 rounded-full animate-pulse'
        glow.style.background = `radial-gradient(circle, ${color}40, transparent 70%)`
        el.appendChild(glow)
      }

      const ring = document.createElement('div')
      ring.className = 'absolute inset-0 rounded-full border opacity-50'
      ring.style.borderColor = color
      ring.style.animation = 'pulse-ring 3s ease-out infinite'
      el.appendChild(ring)

      const core = document.createElement('div')
      const coreSize = isSelected ? 14 : 10
      core.style.width = `${coreSize}px`
      core.style.height = `${coreSize}px`
      core.className = 'rounded-full z-10'
      core.style.backgroundColor = color
      core.style.boxShadow = `0 0 ${isSelected ? 20 : 12}px ${color}`
      el.appendChild(core)

      el.addEventListener('click', () => {
        selectFire(fire.id)
        map.flyTo({ center: [fire.lon, fire.lat], zoom: 12, duration: 1200 })
      })

      const marker = new mapboxgl.Marker(el)
        .setLngLat([fire.lon, fire.lat])
        .addTo(map)
      markersRef.current.push(marker)
    })
  }, [fires, selectedFire.id])

  // FlyTo on selection change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedFire) return
    map.flyTo({ center: [selectedFire.lon, selectedFire.lat], zoom: 12, duration: 1200 })
  }, [selectedFire.id])

  // Draw expansion polygons
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedFire) return

    const LAYER_IDS = ['exp-outer-fill', 'exp-outer-line', 'exp-mid-fill', 'exp-core-fill', 'exp-core-line', 'exp-arrow']
    const SOURCE_IDS = ['exp-outer', 'exp-mid', 'exp-core', 'exp-arrow-src']

    const draw = () => {
      LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
      SOURCE_IDS.forEach(id => { if (map.getSource(id)) map.removeSource(id) })

      const hours = HOURS[expansionRange]
      const colors = EXP_COLORS[expansionRange]
      const windDeg = sentinelUpdate?.weather?.deg ?? 315
      const windSpeed = sentinelUpdate?.weather?.speed ?? 6.7

      const outerGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeed, hours)
      const midGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeed, hours * 0.55)
      const coreGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeed, hours * 0.25)

      // Direction arrow
      const spreadRad = ((windDeg + 180) % 360) * Math.PI / 180
      const windKmh = windSpeed * 3.6
      const ros_f = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
      const tipKm = ros_f * hours
      const cosLat = Math.cos(selectedFire.lat * Math.PI / 180)
      const tipLon = selectedFire.lon + Math.sin(spreadRad) * tipKm / (111 * cosLat)
      const tipLat = selectedFire.lat + Math.cos(spreadRad) * tipKm / 111

      map.addSource('exp-outer', { type: 'geojson', data: outerGeo as any })
      map.addSource('exp-mid', { type: 'geojson', data: midGeo as any })
      map.addSource('exp-core', { type: 'geojson', data: coreGeo as any })
      map.addSource('exp-arrow-src', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[selectedFire.lon, selectedFire.lat], [tipLon, tipLat]] } } as any,
      })

      map.addLayer({ id: 'exp-outer-fill', type: 'fill', source: 'exp-outer', paint: { 'fill-color': colors.outer, 'fill-opacity': 0.07 } })
      map.addLayer({ id: 'exp-outer-line', type: 'line', source: 'exp-outer', paint: { 'line-color': colors.outer, 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } })
      map.addLayer({ id: 'exp-mid-fill', type: 'fill', source: 'exp-mid', paint: { 'fill-color': colors.mid, 'fill-opacity': 0.14 } })
      map.addLayer({ id: 'exp-core-fill', type: 'fill', source: 'exp-core', paint: { 'fill-color': colors.core, 'fill-opacity': 0.28 } })
      map.addLayer({ id: 'exp-core-line', type: 'line', source: 'exp-core', paint: { 'line-color': colors.core, 'line-width': 2.5, 'line-opacity': 0.9 } })
      map.addLayer({ id: 'exp-arrow', type: 'line', source: 'exp-arrow-src', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [6, 4] } })
    }

    if (map.isStyleLoaded()) draw()
    else map.once('style.load', draw)
  }, [selectedFire.id, expansionRange, sentinelUpdate])

  // Evacuation routes from backend
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sentinelUpdate) return
    const apply = () => {
      const routeId = 'sentinel-routes'
      if (map.getLayer(routeId)) map.removeLayer(routeId)
      if (map.getSource(routeId)) map.removeSource(routeId)
      const routes = sentinelUpdate.routes ?? []
      if (routes.length > 0) {
        map.addSource(routeId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: routes.map(r => ({ type: 'Feature', properties: {}, geometry: r.geometry })) } as any,
        })
        map.addLayer({ id: routeId, type: 'line', source: routeId, paint: { 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.8 } })
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [sentinelUpdate])

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
}

export function FireMapView() {
  const { fires } = useFireView()

  return (
    <div className="relative flex-1 flex flex-col bg-[#04050a] min-h-0 overflow-hidden">
      <div className="flex-1 relative min-h-0">
        {/* Map */}
        <MapboxEngine />

        {/* Expansion control floating */}
        <ExpansionControl />

        {/* Minimal HUD */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Corners */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/15" />
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/15" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-white/15" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-white/15" />

          {/* Fire count chip */}
          <div className="absolute top-4 left-4 px-2.5 py-1.5 bg-[#0a0b0e]/80 border border-white/8 rounded-md backdrop-blur-md">
            <span className="text-[10px] font-mono font-medium text-text-2 tracking-wider">
              TRACKING <b className="text-foreground font-bold">{fires.length}</b> {fires.length === 1 ? 'FIRE' : 'FIRES'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/fire-map-view.tsx
git commit -m "feat(fire-view): add FireMapView with expansion polygons and markers"
```

---

### Task 5: Create FireIntelPanel (right panel)

**Files:**
- Create: `frontend/components/dashboard/fire-intel-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { Building2 } from "lucide-react"
import { useFireView, type ExpansionRange } from "@/contexts/fire-view-context"
import { useSentinel } from "@/contexts/sentinel-context"
import type { InfrastructurePoint } from "@/hooks/use-socket"

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function SectionLabel({ children }: { children: string }) {
  return <div className="text-[9px] font-black tracking-[0.2em] text-text-muted uppercase mb-3">{children}</div>
}

function ExpansionImpact() {
  const { selectedFire, expansionRange } = useFireView()
  const data = expansionRange === '2h' ? selectedFire.expansion2h
    : expansionRange === '6h' ? selectedFire.expansion6h
    : selectedFire.expansion12h

  const colorMap: Record<ExpansionRange, string> = {
    '2h': 'border-red/25 bg-red/6',
    '6h': 'border-orange/25 bg-orange/6',
    '12h': 'border-amber/25 bg-amber/6',
  }
  const labelMap: Record<ExpansionRange, string> = { '2h': '2 HORAS', '6h': '6 HORAS', '12h': '12 HORAS' }

  return (
    <div className={`p-4 rounded-xl border ${colorMap[expansionRange]}`}>
      <div className="text-[8px] font-black tracking-[0.2em] text-text-muted mb-2">
        IMPACTO EN {labelMap[expansionRange]}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-foreground num">{data.km2}</span>
        <span className="text-[11px] text-text-muted">km²</span>
        <span className="text-[10px] text-text-dim ml-auto num">{data.ha.toLocaleString()} ha</span>
      </div>
    </div>
  )
}

function NearbyInfrastructure() {
  const { selectedFire } = useFireView()
  const { sentinelUpdate } = useSentinel()
  const infra: InfrastructurePoint[] = (sentinelUpdate as any)?.infrastructure ?? []

  const nearby = infra
    .map(pt => ({ ...pt, dist: haversineKm(selectedFire.lat, selectedFire.lon, pt.lat, pt.lon) }))
    .filter(pt => pt.dist <= 10)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)

  if (nearby.length === 0) return null

  return (
    <div>
      <SectionLabel>Infraestructura Cercana</SectionLabel>
      <div className="sentinel-card p-4 space-y-0">
        {nearby.map(pt => (
          <div key={pt.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2.5">
              <Building2 className={`w-4 h-4 ${pt.type === 'hospital' ? 'text-red-soft' : pt.type === 'school' ? 'text-blue' : 'text-orange'}`} />
              <span className="text-[12px] font-semibold text-text-2">{pt.name}</span>
            </div>
            <span className="text-[11px] font-bold text-text-muted num">{pt.dist.toFixed(1)} km</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PriorityZones() {
  const { sentinelUpdate } = useSentinel()
  const zones = sentinelUpdate?.report?.zonas_evacuacion_prioritaria ?? []
  if (zones.length === 0) return null

  return (
    <div>
      <SectionLabel>Zonas Prioritarias</SectionLabel>
      <div className="sentinel-card p-4">
        <div className="flex flex-wrap gap-2">
          {zones.slice(0, 4).map((zone, i) => (
            <span key={i} className="px-2 py-1 rounded border border-blue/30 bg-blue/10 text-[10px] font-bold text-blue tracking-wide">
              {zone}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Recommendations() {
  const { sentinelUpdate } = useSentinel()
  const actions = sentinelUpdate?.report?.acciones_inmediatas ?? []
  if (actions.length === 0) return null

  return (
    <div>
      <SectionLabel>Recomendaciones</SectionLabel>
      <div className="sentinel-card p-4 space-y-2.5">
        {actions.slice(0, 4).map((action, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-5 h-5 flex items-center justify-center border border-orange/40 bg-orange/10 text-[9px] font-black text-orange rounded shrink-0 num">
              {i + 1}
            </span>
            <span className="text-[12px] text-text-2 leading-relaxed">{action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SafeRouteCard() {
  const { sentinelUpdate } = useSentinel()
  const routes = sentinelUpdate?.naturalRoutes?.rutas ?? []
  const best = routes.filter(r => r.estado !== 'BLOQUEADA').sort((a, b) => a.prioridad - b.prioridad)[0]
  if (!best) return null

  const statusCls = best.estado === 'LIBRE' ? 'border-green/40 bg-green/10 text-green-soft' : 'border-amber/40 bg-amber/10 text-amber'

  return (
    <div>
      <SectionLabel>Ruta Segura</SectionLabel>
      <div className="p-4 bg-[linear-gradient(180deg,rgba(52,211,153,0.08),transparent_40%)] border border-green/20 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[12px] font-bold text-text-2 truncate pr-2">{best.nombre}</span>
          <span className={`px-2 py-0.5 rounded border text-[9px] font-black tracking-[0.12em] ${statusCls}`}>
            {best.estado}
          </span>
        </div>
        <div className="text-[10px] text-text-muted mb-3">→ {best.destino}</div>
        <div className="pt-3 border-t border-white/8 flex justify-between items-center">
          <span className="text-[9px] font-bold text-text-muted tracking-[0.15em] uppercase">Tiempo est.</span>
          <span className="text-sm font-bold text-foreground num">{best.tiempo_estimado_min} MIN</span>
        </div>
      </div>
    </div>
  )
}

export function FireIntelPanel() {
  return (
    <div className="w-80 border-l border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border bg-surface/30">
        <span className="text-[9px] font-black tracking-[0.2em] text-text-muted uppercase">Inteligencia Operativa</span>
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto scrollbar-none">
        <ExpansionImpact />
        <NearbyInfrastructure />
        <PriorityZones />
        <Recommendations />
        <SafeRouteCard />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/fire-intel-panel.tsx
git commit -m "feat(fire-view): add FireIntelPanel with operational intelligence"
```

---

### Task 6: Update TopBar with mode selector

**Files:**
- Modify: `frontend/components/dashboard/top-bar.tsx`

- [ ] **Step 1: Add mode selector to center nav**

Replace the existing nav links section in `top-bar.tsx` (the `<nav>` element around line 57-75) with a mode selector + nav links:

```tsx
// Replace the <nav> block (lines 57-75) with:
          <div className="flex items-center gap-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-1 p-1 rounded-lg border border-white/5 bg-surface/40 backdrop-blur-md">
              <button className="px-4 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase bg-orange/15 text-orange border border-orange/30 shadow-[0_0_12px_rgba(255,126,21,0.15)]">
                Fuego Actual
              </button>
              <button className="px-4 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase text-text-muted hover:text-foreground hover:bg-white/5 transition-all duration-200">
                Zonas de Riesgo
              </button>
            </div>

            {/* Page Nav */}
            <nav className="flex items-center gap-1 p-1 rounded-lg border border-white/5 bg-surface/40 backdrop-blur-md">
              {([
                { href: '/dashboard',         label: tx.navDashboard },
                { href: '/air',               label: tx.navAir },
                { href: '/dashboard/citizen', label: 'Ciudadano' },
              ] as const).map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase transition-all duration-200 ${
                    pathname === href
                      ? 'bg-orange/15 text-orange border border-orange/30 shadow-[0_0_12px_rgba(255,126,21,0.15)]'
                      : 'text-text-muted hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/top-bar.tsx
git commit -m "feat(fire-view): add mode selector to TopBar"
```

---

### Task 7: Wire up page layout

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the page with new components**

Replace the entire contents of `app/dashboard/page.tsx`:

```tsx
"use client"

import dynamic from "next/dynamic"
import { TopBar } from "@/components/dashboard/top-bar"
import { FireListPanel } from "@/components/dashboard/fire-list-panel"
import { FireIntelPanel } from "@/components/dashboard/fire-intel-panel"
import { AuthGuard } from "@/components/auth-guard"
import { FireViewProvider } from "@/contexts/fire-view-context"

const FireMapView = dynamic(
  () => import("@/components/dashboard/fire-map-view").then(m => m.FireMapView),
  { ssr: false, loading: () => <div className="flex-1 bg-[#04050a]" /> }
)

export default function Dashboard() {
  return (
    <AuthGuard>
      <FireViewProvider>
        <div className="h-screen flex flex-col bg-background overflow-hidden selection:bg-orange/30">
          <TopBar />

          {/* Desktop */}
          <div className="hidden md:grid grid-cols-[300px_1fr_320px] flex-1 min-h-0">
            <FireListPanel />
            <FireMapView />
            <FireIntelPanel />
          </div>

          {/* Mobile — simplified for now */}
          <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0">
              <FireMapView />
            </div>
          </div>
        </div>
      </FireViewProvider>
    </AuthGuard>
  )
}
```

- [ ] **Step 2: Delete old files**

```bash
rm frontend/components/dashboard/left-panel.tsx
rm frontend/components/dashboard/right-panel.tsx
rm frontend/components/dashboard/map-panel.tsx
rm frontend/components/dashboard/mapbox-panel.tsx
rm frontend/contexts/fire-selection-context.tsx
```

- [ ] **Step 3: Remove unused imports from other files**

Check if any other file imports from `fire-selection-context` or the deleted components:

```bash
cd frontend && grep -r "fire-selection-context\|left-panel\|right-panel\|map-panel\|mapbox-panel" --include="*.tsx" --include="*.ts" -l
```

If `components/dashboard/metric-cards.tsx`, `safe-route.tsx`, or `info-sections.tsx` are no longer imported by the page, they can stay (unused but harmless for now — mobile may use them later).

- [ ] **Step 4: Verify the app builds**

```bash
cd frontend && pnpm dev
```

Open http://localhost:3010/dashboard and verify:
- Three columns render
- Fire list shows on left with fires from the socket data
- Map renders with markers
- Right panel shows expansion impact
- Clicking a fire in the list updates the map and panels
- 2H/6H/12H control changes the polygon

- [ ] **Step 5: Commit**

```bash
git add -A frontend/
git commit -m "feat(fire-view): wire up new 3-column layout and remove old components"
```

---

### Task 8: Final polish and cleanup

**Files:**
- Modify: Various (fix any type errors, missing imports, CSS issues found during testing)

- [ ] **Step 1: Fix any TypeScript errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any reported issues. Common ones:
- `InfrastructurePoint` might not be exported from `use-socket.ts` — add the export if needed
- The `(sentinelUpdate as any)?.infrastructure` cast in FireIntelPanel handles missing type

- [ ] **Step 2: Test all interactions in browser**

Verify at http://localhost:3010/dashboard:
1. Fire list ordered by FRP (highest first)
2. Most critical fire auto-selected on load
3. Click fire in list → map flies to it, panels update
4. Click marker on map → list highlights, panels update
5. Click 2H/6H/12H → polygon resizes, impact number changes
6. New socket update → list refreshes, selection preserved

- [ ] **Step 3: Commit any fixes**

```bash
git add -A frontend/
git commit -m "fix(fire-view): resolve type errors and polish interactions"
```

---

## Summary of Commits

1. `feat(fire-view): add FireViewContext with auto-selection and expansion logic`
2. `feat(fire-view): add ExpansionControl floating toggle`
3. `feat(fire-view): add FireListPanel with selectable fire list`
4. `feat(fire-view): add FireMapView with expansion polygons and markers`
5. `feat(fire-view): add FireIntelPanel with operational intelligence`
6. `feat(fire-view): add mode selector to TopBar`
7. `feat(fire-view): wire up new 3-column layout and remove old components`
8. `fix(fire-view): resolve type errors and polish interactions`
