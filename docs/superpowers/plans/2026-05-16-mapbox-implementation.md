# Mapbox Core Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Leaflet with Mapbox Satellite view and implement real-time markers.

**Architecture:** Create a new MapboxPanel component using mapbox-gl and swap it into the existing MapPanel. Use a ref to manage the map instance and markers, syncing markers with the `useIncidents` hook.

**Tech Stack:** Next.js, Mapbox GL JS, TypeScript, Tailwind CSS.

---

### Task 1: Implement Mapbox Component

**Files:**
- Create: `frontend/components/dashboard/mapbox-panel.tsx`

- [ ] **Step 1: Create MapboxPanel component**

Create `frontend/components/dashboard/mapbox-panel.tsx` with the following content:

```typescript
"use client"
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useIncidents } from '@/hooks/use-incidents'

const TOKEN = "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

export function MapboxPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const incidents = useIncidents()
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-71.90, -38.28],
      zoom: 9,
      projection: 'globe' as any
    })
    map.on('style.load', () => { map.setFog({}) })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = incidents.map(inc => {
      const el = document.createElement('div')
      el.className = 'w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-pulse'
      return new mapboxgl.Marker(el).setLngLat([inc.lng, inc.lat]).addTo(mapRef.current!)
    })
  }, [incidents])

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): implement MapboxPanel component"
```

---

### Task 2: Swap Leaflet for Mapbox in MapPanel

**Files:**
- Modify: `frontend/components/dashboard/map-panel.tsx`

- [ ] **Step 1: Update MapPanel to use MapboxPanel**

Modify `frontend/components/dashboard/map-panel.tsx` to use dynamic import for `MapboxPanel` and update the UI structure.

```typescript
"use client"
import dynamic from "next/dynamic"

const MapboxPanel = dynamic(
  () => import("./mapbox-panel").then((m) => m.MapboxPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export function MapPanel() {
  return (
    <div className="h-[40vh] md:h-auto md:flex-1 flex flex-col bg-background border-b md:border-b-0 border-border shrink-0">
      <div className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Satellite View</h2>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <MapboxPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/map-panel.tsx
git commit -m "feat(map): replace leaflet with mapbox satellite view"
```
