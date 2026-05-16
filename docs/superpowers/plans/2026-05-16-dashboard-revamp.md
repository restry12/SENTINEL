# Dashboard Revamp: Mapbox + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the main dashboard into a high-fidelity satellite monitoring system using Mapbox and real-time Supabase data, replicating the "Sentinel" aesthetic from provided screenshots.

**Architecture:** 
- Replace Leaflet with Mapbox GL JS for satellite imagery and globe projection.
- Create a Supabase client and real-time hook to fetch active fire incidents.
- Refactor dashboard components to match the dark "cyberpunk/military" visual style.
- Use CSS animations for pulsating status dots and scanline effects.

**Tech Stack:** Next.js, Mapbox GL JS, Supabase, Tailwind CSS, Lucide React.

---

### Task 1: Supabase Infrastructure

**Files:**
- Create: `frontend/lib/supabase.ts`
- Create: `frontend/hooks/use-incidents.ts`

- [ ] **Step 1: Configure Supabase Client**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sjaufigbsiafyzyaaomq.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)
```

- [ ] **Step 2: Create Real-time Incidents Hook**
```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Incident {
  id: string
  lat: number
  lng: number
  intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  type: string
  created_at: string
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data } = await supabase.from('incidents').select('*')
      if (data) setIncidents(data)
    }

    fetchIncidents()

    const channel = supabase
      .channel('incidents_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, fetchIncidents)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return incidents
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend/lib/supabase.ts frontend/hooks/use-incidents.ts
git commit -m "feat(db): add supabase client and useIncidents hook"
```

---

### Task 2: Mapbox Core Component

**Files:**
- Create: `frontend/components/dashboard/mapbox-panel.tsx`
- Modify: `frontend/components/dashboard/map-panel.tsx`

- [ ] **Step 1: Implement Mapbox Component**
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

- [ ] **Step 2: Swap Leaflet for Mapbox in MapPanel**
Replace import and usage of `LeafletMap` with `MapboxPanel`.

- [ ] **Step 3: Commit**
```bash
git add frontend/components/dashboard/mapbox-panel.tsx frontend/components/dashboard/map-panel.tsx
git commit -m "feat(map): replace leaflet with mapbox satellite view"
```

---

### Task 3: Visual Polish & Header (Screenshot Style)

**Files:**
- Modify: `frontend/components/dashboard/top-bar.tsx`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Update TopBar styling**
Add "CRITICAL ACTIVE" badge, Hotspot count (from incidents.length), and Operational status.

- [ ] **Step 2: Add Global Scanline Effect**
```css
/* frontend/app/globals.css */
.scanline-overlay {
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), 
              linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
  background-size: 100% 3px, 3px 100%;
  pointer-events: none;
}
```

- [ ] **Step 3: Commit**
```bash
git add frontend/components/dashboard/top-bar.tsx frontend/app/globals.css
git commit -m "style: add satellite dashboard visuals and top bar metrics"
```
