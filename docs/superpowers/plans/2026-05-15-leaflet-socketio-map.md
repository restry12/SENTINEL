# Leaflet Map + Socket.io Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG placeholder map in SENTINEL with a real interactive Leaflet map fed by live socket.io hotspot data from a new Express backend.

**Architecture:** A new Express + socket.io server (`backend/server.js`) emits mock `Hotspot[]` every 5 seconds. A `use-socket` hook connects to it and stores hotspots in React state. A `leaflet-map.tsx` client component renders those hotspots as colored CircleMarkers on a NASA GIBS satellite basemap, loaded via `dynamic({ ssr: false })` in `map-panel.tsx` to avoid Next.js SSR issues.

**Tech Stack:** react-leaflet v4, leaflet, socket.io-client (frontend); Express, socket.io, cors (backend)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/package.json` | Backend npm manifest |
| Modify | `backend/server.js` | Express + socket.io mock server |
| Create | `frontend/.env.local` | Socket URL and FIRMS token vars |
| Create | `frontend/hooks/use-socket.ts` | WebSocket hook → `{ hotspots, connected }` |
| Create | `frontend/components/dashboard/leaflet-map.tsx` | Leaflet map with NASA GIBS tiles + markers |
| Modify | `frontend/components/dashboard/map-panel.tsx` | Replace SVG with dynamic LeafletMap |

---

## Task 1: Initialize backend package

**Files:**
- Create: `backend/package.json`

- [ ] **Step 1: Init npm and install dependencies**

From the repo root, run:
```bash
cd backend && npm init -y && npm install express socket.io cors
```

Expected: `added N packages` with no errors. `backend/package.json` now exists with `express`, `socket.io`, `cors` in `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: init backend package with express and socket.io"
```

---

## Task 2: Write backend socket.io server

**Files:**
- Modify: `backend/server.js`

- [ ] **Step 1: Write server.js**

Replace the entire content of `backend/server.js` with:

```js
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors({ origin: "http://localhost:3000" }))

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
})

// TODO: REPLACE WITH REAL DATA — swap this function for FIRMS API query or agent pipeline
function getMockHotspots() {
  return [
    { id: "FIRE-001", lat: 34.12, lng: -118.45, intensity: "high",     frp: 142.3, label: "FIRE-001" },
    { id: "FIRE-002", lat: 33.98, lng: -118.21, intensity: "critical",  frp: 287.6, label: "FIRE-002 (PRIMARY)" },
    { id: "FIRE-003", lat: 34.21, lng: -118.09, intensity: "medium",    frp: 89.1,  label: "FIRE-003" },
  ]
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id)

  socket.emit("hotspots", getMockHotspots())

  const interval = setInterval(() => {
    socket.emit("hotspots", getMockHotspots())
  }, 5000)

  socket.on("disconnect", () => {
    clearInterval(interval)
    console.log("Client disconnected:", socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`SENTINEL socket server running on port ${PORT}`)
})
```

- [ ] **Step 2: Test the server starts**

```bash
node backend/server.js
```

Expected output:
```
SENTINEL socket server running on port 3001
```

Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: add socket.io backend with mock hotspot emitter"
```

---

## Task 3: Install frontend dependencies

**Files:**
- Modify: `frontend/package.json`, `frontend/pnpm-lock.yaml`

- [ ] **Step 1: Install packages**

```bash
cd frontend && pnpm add react-leaflet leaflet socket.io-client && pnpm add -D @types/leaflet
```

Expected: packages added with no peer dependency errors.

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore: add react-leaflet, leaflet, socket.io-client to frontend"
```

---

## Task 4: Create environment variables

**Files:**
- Create: `frontend/.env.local`

- [ ] **Step 1: Create .env.local**

Create the file `frontend/.env.local` with:

```
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_FIRMS_TOKEN=
```

- [ ] **Step 2: Verify .env.local is gitignored**

```bash
cat frontend/.gitignore
```

If `.env.local` does not appear in the output, add it:

```bash
echo ".env.local" >> frontend/.gitignore
git add frontend/.gitignore
git commit -m "chore: ensure .env.local is gitignored"
```

`.env.local` itself is never committed.

---

## Task 5: Create use-socket hook

**Files:**
- Create: `frontend/hooks/use-socket.ts`

- [ ] **Step 1: Write the hook**

Create `frontend/hooks/use-socket.ts`:

```ts
"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"

export interface Hotspot {
  id: string
  lat: number
  lng: number
  intensity: "low" | "medium" | "high" | "critical"
  frp: number
  label?: string
}

// Shown when socket never connects — same coordinates as the backend mock
const FALLBACK_HOTSPOTS: Hotspot[] = [
  { id: "FIRE-001", lat: 34.12, lng: -118.45, intensity: "high",     frp: 142.3, label: "FIRE-001" },
  { id: "FIRE-002", lat: 33.98, lng: -118.21, intensity: "critical",  frp: 287.6, label: "FIRE-002 (PRIMARY)" },
  { id: "FIRE-003", lat: 34.21, lng: -118.09, intensity: "medium",    frp: 89.1,  label: "FIRE-003" },
]

export function useSocket() {
  const [hotspots, setHotspots] = useState<Hotspot[]>(FALLBACK_HOTSPOTS)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001"
    const socket: Socket = io(url, { transports: ["websocket"] })

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("hotspots", (data: Hotspot[]) => setHotspots(data))

    return () => {
      socket.disconnect()
    }
  }, [])

  return { hotspots, connected }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/hooks/use-socket.ts
git commit -m "feat: add use-socket hook for real-time hotspot data"
```

---

## Task 6: Create LeafletMap component

**Files:**
- Create: `frontend/components/dashboard/leaflet-map.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/components/dashboard/leaflet-map.tsx`:

```tsx
"use client"

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import type { Hotspot } from "@/hooks/use-socket"

// NASA GIBS MODIS Terra true-color satellite tiles (free, no API key needed)
// TODO: swap TILE_URL for FIRMS satellite tiles when NEXT_PUBLIC_FIRMS_TOKEN is ready
const today = new Date().toISOString().split("T")[0]
const TILE_URL = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`

const INTENSITY_COLOR: Record<Hotspot["intensity"], string> = {
  low:      "#22c55e",
  medium:   "#eab308",
  high:     "#f97316",
  critical: "#ef4444",
}

const INTENSITY_RADIUS: Record<Hotspot["intensity"], number> = {
  low:      7,
  medium:   9,
  high:     11,
  critical: 14,
}

interface LeafletMapProps {
  hotspots: Hotspot[]
}

export function LeafletMap({ hotspots }: LeafletMapProps) {
  return (
    <MapContainer
      center={[34.05, -118.24]}
      zoom={10}
      style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
      zoomControl={false}
    >
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://earthdata.nasa.gov">NASA GIBS</a>'
        maxZoom={9}
      />
      {hotspots.map((spot) => (
        <CircleMarker
          key={spot.id}
          center={[spot.lat, spot.lng]}
          radius={INTENSITY_RADIUS[spot.intensity]}
          pathOptions={{
            color:       INTENSITY_COLOR[spot.intensity],
            fillColor:   INTENSITY_COLOR[spot.intensity],
            fillOpacity: 0.65,
            weight:      spot.intensity === "critical" ? 2 : 1,
          }}
        >
          <Popup>
            <div style={{ fontFamily: "monospace", fontSize: "12px" }}>
              <strong>{spot.label ?? spot.id}</strong>
              <br />
              FRP: {spot.frp} MW
              <br />
              {spot.intensity.toUpperCase()}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/leaflet-map.tsx
git commit -m "feat: add LeafletMap component with NASA GIBS tiles and hotspot markers"
```

---

## Task 7: Replace map-panel.tsx

**Files:**
- Modify: `frontend/components/dashboard/map-panel.tsx`

- [ ] **Step 1: Replace the entire file**

Replace the entire content of `frontend/components/dashboard/map-panel.tsx` with:

```tsx
"use client"

import dynamic from "next/dynamic"
import { useSocket } from "@/hooks/use-socket"

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-background animate-pulse" />,
  }
)

export function MapPanel() {
  const { hotspots, connected } = useSocket()

  return (
    <div className="h-[40vh] md:h-auto md:flex-1 flex flex-col bg-background border-b md:border-b-0 border-border shrink-0">
      {/* Map Header */}
      <div className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Map
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">34.05°N</span>
            <span className="text-border">|</span>
            <span className="font-mono">118.24°W</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full transition-colors ${
                connected ? "bg-safe" : "bg-muted-foreground"
              }`}
            />
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Fire</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 border border-dashed border-warning rounded-sm" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Spread</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-0.5 w-3 md:w-4 bg-safe" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Evac</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        <LeafletMap hotspots={hotspots} />

        {/* Sector label overlay */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4 z-[1000] pointer-events-none">
          <div className="px-2 py-1 bg-card/80 border border-border rounded text-xs font-mono text-muted-foreground">
            SECTOR 7A
          </div>
        </div>

        {/* Scale bar overlay */}
        <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 z-[1000] pointer-events-none">
          <div className="px-2 py-1 md:px-3 md:py-2 bg-card/90 border border-border rounded">
            <div className="flex items-center gap-2">
              <div className="w-8 md:w-16 h-0.5 bg-foreground" />
              <span className="text-xs font-mono text-foreground">5 km</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/map-panel.tsx
git commit -m "feat: replace SVG placeholder with live Leaflet map in MapPanel"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Start the backend**

```bash
node backend/server.js
```

Expected:
```
SENTINEL socket server running on port 3001
```

Leave it running.

- [ ] **Step 2: Start the frontend (new terminal)**

```bash
cd frontend && pnpm dev
```

Expected: Next.js dev server on `http://localhost:3000` with no build errors.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`. Check:
- [ ] Map loads (NASA GIBS satellite tiles or dark fallback background)
- [ ] 3 colored circle markers visible near LA: orange (FIRE-001), red (FIRE-002), yellow (FIRE-003)
- [ ] Map header shows green dot + "LIVE"
- [ ] Clicking a marker shows popup with label, FRP, and intensity

- [ ] **Step 4: Test offline fallback**

Stop the backend (Ctrl+C in that terminal). Hard-refresh the page.

Check:
- [ ] Map still loads
- [ ] 3 markers still visible (FALLBACK_HOTSPOTS from use-socket.ts)
- [ ] Map header shows gray dot + "OFFLINE"

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: post-verification adjustments"
```

---

## Swap guide for teammates

| What to replace | File | Who | When |
|----------------|------|-----|------|
| `getMockHotspots()` body | `backend/server.js` | P2 | When FIRMS/agent pipeline is ready |
| `NEXT_PUBLIC_SOCKET_URL` | `frontend/.env.local` | P2 | When deploying to prod |
| `TILE_URL` constant | `frontend/components/dashboard/leaflet-map.tsx` | P3 | When FIRMS token is ready |
| `NEXT_PUBLIC_FIRMS_TOKEN` | `frontend/.env.local` | P3 | When FIRMS token is ready |
