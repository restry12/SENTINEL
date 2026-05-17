# Hotspot Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "TOP FOCOS" button to the dashboard TopBar that opens a dropdown with the top 10 fires sorted by FRP and a search input to navigate to any fire by ID — clicking any result flies the map to that fire and opens its popup.

**Architecture:** A new `HotspotSearch` component reads fires from `useSentinel()` and calls a navigation callback (`selectFireRef`) registered in `FireSelectionContext` by `MapboxPanel`. The ref is imperative (not state) since `flyTo` and popup rendering are imperative Mapbox operations that don't need React re-renders.

**Tech Stack:** Next.js 14, React, TypeScript, Mapbox GL JS, Tailwind CSS, Lucide icons

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `frontend/contexts/fire-selection-context.tsx` | Add `selectFireRef` to context value |
| Modify | `frontend/components/dashboard/mapbox-panel.tsx` | Extract `openFire` fn, register ref |
| Create | `frontend/components/dashboard/hotspot-search.tsx` | Button + dropdown UI component |
| Modify | `frontend/components/dashboard/top-bar.tsx` | Mount `<HotspotSearch />` |

---

## Task 1: Add `selectFireRef` to `FireSelectionContext`

**Files:**
- Modify: `frontend/contexts/fire-selection-context.tsx`

- [ ] **Step 1: Replace the full file with the updated context**

```tsx
"use client"

import { createContext, useContext, useState, useRef, type ReactNode, type MutableRefObject } from "react"
import type { FireData } from "@/hooks/use-socket"

export type FireIntensity = 'critical' | 'high' | 'moderate'

export interface SelectedFireData {
  id: string
  lat: number
  lon: number
  frp: number
  brightness: number
  intensity: FireIntensity
  windImpactDir: string
  windKmh: number
  expansion2h?: { km2: number; ha: number }
  expansion6h?: { km2: number; ha: number }
  expansion12h?: { km2: number; ha: number }
  weather?: { speed: number; deg: number; humidity: number; temp?: number }
}

interface FireSelectionContextValue {
  selectedFire: SelectedFireData | null
  setSelectedFire: (fire: SelectedFireData | null) => void
  selectFireRef: MutableRefObject<((index: number, fires: FireData[]) => void) | null>
}

const FireSelectionContext = createContext<FireSelectionContextValue | null>(null)

export function FireSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedFire, setSelectedFire] = useState<SelectedFireData | null>(null)
  const selectFireRef = useRef<((index: number, fires: FireData[]) => void) | null>(null)
  return (
    <FireSelectionContext.Provider value={{ selectedFire, setSelectedFire, selectFireRef }}>
      {children}
    </FireSelectionContext.Provider>
  )
}

export function useFireSelection(): FireSelectionContextValue {
  const ctx = useContext(FireSelectionContext)
  if (!ctx) throw new Error("useFireSelection must be used within <FireSelectionProvider>")
  return ctx
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors related to `fire-selection-context.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/contexts/fire-selection-context.tsx
git commit -m "feat(context): add selectFireRef to FireSelectionContext"
```

---

## Task 2: Extract `openFire` in `MapboxPanel` and register the ref

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx`

The goal is to extract the click-handler body into a named function `openFire` that both the existing click handler and `selectFireRef` can call. `openFire` lives inside the `apply()` closure so it has access to `map`, `wDeg`, `wSpeed`, and the other local variables.

- [ ] **Step 1: Add `selectFireRef` to the `useFireSelection` destructure**

At line 229 in `mapbox-panel.tsx`, change:
```tsx
const { selectedFire, setSelectedFire } = useFireSelection()
```
to:
```tsx
const { selectedFire, setSelectedFire, selectFireRef } = useFireSelection()
```

- [ ] **Step 2: Define `openFire` inside `apply()` and register `selectFireRef`**

Inside the `apply` function (which starts around line 321), **before** the `map.on('click', POINTS, ...)` handler, add this block:

```tsx
// Shared handler — called from map click AND from HotspotSearch
function openFire(
  lat: number, lon: number,
  id: string, frp: number, brightness: number,
  weatherJson: string, pm25: number | null,
) {
  const color = frp >= 300 ? '#ef4444' : '#f97316'
  const weather = weatherJson ? JSON.parse(weatherJson) : undefined
  const intensity: FireIntensity = frp >= 300 ? 'critical' : frp >= 100 ? 'high' : 'moderate'

  const fireWDeg   = weather?.deg   ?? wDeg
  const fireWSpeed = weather?.speed ?? wSpeed
  const fireSDeg   = (fireWDeg + 180) % 360
  const fireSDirLabel = degToCompass(fireSDeg)
  const fireWKmh   = Math.round(fireWSpeed * 3.6)
  const fireA2  = computeFireSpreadArea(fireWSpeed, 2)
  const fireA6  = computeFireSpreadArea(fireWSpeed, 6)
  const fireA12 = computeFireSpreadArea(fireWSpeed, 12)

  const popupData: PopupData = {
    id, color, intensity: String(intensity),
    frp, lat, lon,
    sDirLabel: fireSDirLabel, wKmh: fireWKmh,
    a2: fireA2, a6: fireA6, a12: fireA12,
    weather, pm25,
  }

  currentPopupRef.current?.popup.remove()

  const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, anchor: 'bottom', maxWidth: '320px' })
    .setLngLat([lon, lat])
    .setHTML(buildPopupHTML(popupData, '2h'))
    .addTo(map)

  popup.getElement()?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest('[data-sentinel-key]')
    if (!btn) return
    const key = btn.getAttribute('data-sentinel-key') as ExpansionKey
    setActiveExpansion(prev => prev === key ? null : key)
  })

  currentPopupRef.current = { popup, data: popupData }

  setSelectedFire({
    id, lat, lon, frp, brightness,
    intensity, windImpactDir: fireSDirLabel, windKmh: fireWKmh,
    expansion2h: fireA2, expansion6h: fireA6, expansion12h: fireA12,
    weather,
  })
  setActiveExpansion('2h')

  const sel = map.getSource('fires-selected-src') as mapboxgl.GeoJSONSource
  sel?.setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }],
  } as any)

  map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 11), duration: 1100, essential: true })
}

// Register for HotspotSearch — updated each time fires reload
selectFireRef.current = (idx, allFires) => {
  const f = allFires[idx]
  if (!f) return
  const id = `FIRE-${String(idx + 1).padStart(3, '0')}`
  openFire(f.lat, f.lon, id, f.frp, f.brightness, f.weather ? JSON.stringify(f.weather) : '', f.pm25 ?? null)
}
```

- [ ] **Step 3: Replace the existing `map.on('click', POINTS, ...)` handler body to call `openFire`**

Find the block starting with `// Click a fire → flyTo + popup + selectedFire context` (around line 454) and replace the entire handler body:

```tsx
map.on('click', POINTS, (e) => {
  const feat = e.features?.[0]
  if (!feat) return
  const props = feat.properties as any
  const [lon, lat] = (feat.geometry as any).coordinates as [number, number]
  openFire(lat, lon, props.id, props.frp, props.brightness, props.weatherJson ?? '', props.pm25 ?? null)
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-test manually**

```bash
cd frontend && pnpm dev
```

Open http://localhost:3010/dashboard, click any fire marker on the map. Verify the popup opens and the left panel updates exactly as before.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): extract openFire fn and register selectFireRef"
```

---

## Task 3: Create `HotspotSearch` component

**Files:**
- Create: `frontend/components/dashboard/hotspot-search.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useRef, useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useSentinel } from '@/contexts/sentinel-context'
import { useFireSelection } from '@/contexts/fire-selection-context'

function frpColor(frp: number): string {
  if (frp >= 300) return '#ef4444'
  if (frp >= 100) return '#f97316'
  return '#fbbf24'
}

export function HotspotSearch() {
  const { sentinelUpdate } = useSentinel()
  const { selectFireRef } = useFireSelection()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const fires = sentinelUpdate?.fires ?? []

  const indexedFires = fires
    .map((f, i) => ({ fire: f, index: i, id: `FIRE-${String(i + 1).padStart(3, '0')}` }))
    .sort((a, b) => b.fire.frp - a.fire.frp)

  const displayFires = query.trim()
    ? indexedFires.filter(f => f.id.includes(query.toUpperCase().trim()))
    : indexedFires.slice(0, 10)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleSelect(index: number) {
    selectFireRef.current?.(index, fires)
    setOpen(false)
    setQuery('')
  }

  const disabled = fires.length === 0

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[11px] font-black tracking-[0.15em] uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
          open
            ? 'border-orange/70 bg-orange/20 text-orange shadow-[0_0_12px_rgba(255,126,21,0.25)]'
            : 'border-orange/40 bg-orange/10 text-orange hover:bg-orange/20'
        }`}
      >
        <Search className="w-3.5 h-3.5" />
        <span>Top Focos</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-[#0d1117] border border-orange/30 rounded-xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(255,126,21,0.08)] z-50">
          <p className="text-[8px] tracking-[0.2em] text-text-muted uppercase px-1 mb-2">
            Top Focos · Ordenado por FRP
          </p>

          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por ID (ej: FIRE-120)…"
            className="w-full bg-[#080c14] border border-border rounded-lg px-3 py-1.5 text-[9px] text-foreground placeholder:text-text-muted font-mono mb-2.5 outline-none focus:border-orange/40 transition-colors"
          />

          <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-none">
            {displayFires.length === 0 ? (
              <p className="text-[9px] text-text-muted px-2 py-3 text-center">Sin resultados</p>
            ) : (
              displayFires.map(({ fire, index, id }, rank) => {
                const color = frpColor(fire.frp)
                const isTop = rank === 0 && !query.trim()
                return (
                  <button
                    key={id}
                    onClick={() => handleSelect(index)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-white/5 ${
                      isTop ? 'bg-red/10 border border-red/20' : ''
                    }`}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black tracking-[0.12em] leading-none" style={{ color }}>
                        {id}
                      </div>
                      <div className="text-[8px] text-text-muted font-mono mt-0.5">
                        {fire.lat.toFixed(3)}° / {fire.lon.toFixed(3)}°
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[13px] font-black leading-none" style={{ color }}>
                        {fire.frp.toFixed(0)}
                      </div>
                      <div className="text-[7px] text-text-muted">MW</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {!query.trim() && indexedFires.length > 10 && (
            <p className="text-[8px] text-text-muted text-center mt-2 pt-2 border-t border-border">
              + {indexedFires.length - 10} focos más · click para volar al foco
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/hotspot-search.tsx
git commit -m "feat(dashboard): add HotspotSearch component"
```

---

## Task 4: Mount `HotspotSearch` in the TopBar

**Files:**
- Modify: `frontend/components/dashboard/top-bar.tsx`

- [ ] **Step 1: Add the import**

At the top of `top-bar.tsx`, after the existing imports, add:

```tsx
import { HotspotSearch } from "@/components/dashboard/hotspot-search"
```

- [ ] **Step 2: Mount the component in the center section**

In the center `<div>` (the one with `flex-1 flex items-center justify-center gap-4`), add `<HotspotSearch />` between the "Analizar" button and the fire-count chip:

```tsx
<button
  onClick={() => trigger()}
  disabled={isLoading || !connected}
  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange/40 bg-orange/10 text-orange text-[11px] font-black tracking-[0.15em] uppercase hover:bg-orange/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
>
  <RadarIcon className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
  <span>{isLoading ? "…" : "Analizar"}</span>
</button>

<HotspotSearch />

<div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-surface/60 border border-white/5 rounded-lg text-[11px] font-bold tracking-[0.15em] text-text-dim backdrop-blur-md">
  <span>{tx.hotspots}</span>
  <span className="text-orange-soft font-mono text-base leading-none num drop-shadow-[0_0_8px_rgba(255,174,66,0.4)]">{fireCount.toLocaleString()}</span>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual end-to-end test**

```bash
cd frontend && pnpm dev
```

Open http://localhost:3010/dashboard. Wait for data to load, then:
1. Click "TOP FOCOS" button — dropdown should open, SENTINEL logo stays visible.
2. Verify top 10 fires appear sorted by FRP descending with colored dots.
3. Click the #1 fire — map should fly to it, popup should open, left panel should update.
4. Click the button again to reopen → type "FIRE-120" in the input → matching fire should appear → click it → map flies there.
5. Click outside the dropdown — it should close.
6. Click a fire directly on the map — still works as before.

- [ ] **Step 5: Final commit**

```bash
git add frontend/components/dashboard/top-bar.tsx
git commit -m "feat(topbar): mount HotspotSearch between Analizar and fire count"
```
