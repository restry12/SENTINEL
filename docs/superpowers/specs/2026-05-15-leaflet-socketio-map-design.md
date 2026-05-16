# Design: Leaflet Map + Socket.io Integration — SENTINEL

**Date:** 2026-05-15  
**Author:** P1 (frontend)  
**Status:** Approved

---

## Overview

Replace the SVG placeholder map in `map-panel.tsx` with a real interactive Leaflet map using NASA GIBS satellite tiles. Add a socket.io backend that emits mock hotspot data every 5 seconds. The system is designed so P2 (backend) and P3 (agents) can swap in real data without touching frontend internals.

---

## Architecture

```
backend/
  └── server.js                    Express + socket.io server (port 3001)

frontend/
  ├── .env.local                   NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_FIRMS_TOKEN
  ├── hooks/use-socket.ts          WebSocket connection hook
  ├── components/dashboard/
  │   ├── leaflet-map.tsx          Leaflet map component (client-only)
  │   └── map-panel.tsx            Modified: loads LeafletMap via dynamic()
  └── package.json                 +react-leaflet, +leaflet, +socket.io-client
```

---

## Data Contract

```ts
interface Hotspot {
  id: string
  lat: number
  lng: number
  intensity: "low" | "medium" | "high" | "critical"
  frp: number        // Fire Radiative Power in MW
  label?: string     // e.g. "FIRE-001"
}
```

### Socket events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `hotspots` | server → client | `Hotspot[]` | Emitted every 5s |
| `alert` | server → client | `string` | SMS alert text (future use) |

---

## Components

### `backend/server.js`

- Express HTTP server on port 3001 with CORS enabled for `http://localhost:3000`
- socket.io attached to the HTTP server
- `getMockHotspots()` function — returns 3 hardcoded hotspots near LA (34.05°N, 118.24°W)
- On client connect: emits `hotspots` immediately, then every 5 seconds
- **`// TODO: REPLACE WITH REAL DATA`** comment on `getMockHotspots()` for P2

### `frontend/hooks/use-socket.ts`

- Connects to `NEXT_PUBLIC_SOCKET_URL` (default `http://localhost:3001`)
- Listens to `hotspots` event, stores in React state (`useState<Hotspot[]>`)
- Returns `{ hotspots, connected }` — `connected` boolean for UI status indicator
- Disconnects on component unmount
- Falls back to initial mock hotspots if socket never connects (so the map is never empty)

### `frontend/components/dashboard/leaflet-map.tsx`

- `"use client"` — Leaflet requires browser APIs
- `TILE_URL` constant at top of file:
  ```
  https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible/{z}/{y}/{x}.jpg
  ```
  - **`// TODO: swap TILE_URL for FIRMS satellite tiles when token is ready`**
- `<MapContainer>` centered at `[34.05, -118.24]`, zoom 10
- `<TileLayer>` with NASA GIBS URL
- `<CircleMarker>` per hotspot, color coded by intensity:
  - `low` → green (`#22c55e`)
  - `medium` → yellow (`#eab308`)
  - `high` → orange (`#f97316`)
  - `critical` → red (`#ef4444`)
- Popup on click showing: label, FRP (MW), intensity
- Pulsing CSS ring on critical markers (reuses existing `pulse-ring` class)
- Props: `hotspots: Hotspot[]`

### `frontend/components/dashboard/map-panel.tsx`

- Imports `LeafletMap` via `dynamic(() => import('./leaflet-map'), { ssr: false })`
- Uses `use-socket` hook to get live hotspots
- Shows connection status dot in the map header (green = connected, gray = offline/mock)
- Preserves existing header (coordinates, legend) and footer (scale bar, sector label)
- Removes all SVG map content

---

## Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_FIRMS_TOKEN=       # empty — P3 fills this when ready
```

---

## Swap Points for Teammates

| File | What to replace | Who |
|------|----------------|-----|
| `backend/server.js` → `getMockHotspots()` | Real FIRMS/agent data query | P2 |
| `frontend/.env.local` → `NEXT_PUBLIC_SOCKET_URL` | Production socket URL | P2 |
| `frontend/components/dashboard/leaflet-map.tsx` → `TILE_URL` | NASA FIRMS tile URL | P3 |
| `frontend/.env.local` → `NEXT_PUBLIC_FIRMS_TOKEN` | Real FIRMS token | P3 |

---

## Error Handling

- Socket disconnects: `use-socket` keeps last received hotspots in state — map stays populated
- Socket never connects: fallback to 3 mock hotspots defined in the hook
- Leaflet SSR: handled by `dynamic({ ssr: false })` — no `window is not defined` error
- Missing tile images: Leaflet's built-in tile error handling (gray tile placeholder)

---

## Dependencies to Install

**Frontend:**
```
pnpm add react-leaflet leaflet socket.io-client
pnpm add -D @types/leaflet
```

**Backend:**
```
npm init -y   (if no package.json)
npm install express socket.io cors
```

---

## Out of Scope

- Real FIRMS API integration (future — P3)
- Evacuation route drawing on Leaflet (keeps existing right-panel text for now)
- Fire spread polygon on Leaflet (future)
- Authentication for socket connection
