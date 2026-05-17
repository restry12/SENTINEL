# Citizen View — Real Data Design

**Date:** 2026-05-17  
**Status:** Approved

## Context

The `/dashboard/citizen` view currently uses mock data. The frontend is complete; what's missing is the backend plumbing to serve real, location-relative data. Three independent changes are needed:

1. A new `trigger-citizen` socket event + `POST /api/trigger/citizen` endpoint to connect the citizen's GPS to a Make.com flow that fetches real FIRMS/Weather/AQ data for that location.
2. `bearing_deg` added to each `NaturalRoute` (computed from ORS route geometry).
3. `direccion_principal_deg` added to `ExpansionData` (computed from the existing cardinal string).

---

## Section 1 — New socket event `trigger-citizen` + `/api/trigger/citizen`

### Socket event (backend → Make.com → backend)

**`packages/backend/src/socket/handlers.ts`** registers a new `trigger-citizen` event alongside the existing `trigger`. It receives `{ lat: number; lon: number }` from the frontend.

Flow:
1. Apply the same per-socket rate-limit and global lock checks as `trigger`.
2. Emit `status: loading` to the triggering socket only (`socket.emit`, not `io.emit`).
3. If `MAKE_CITIZEN_WEBHOOK_URL` is set: POST `{ lat, lon, socketId: socket.id }` to that URL (fire-and-forget — Make.com will call back).
4. If `MAKE_CITIZEN_WEBHOOK_URL` is not set: fall back to `executeAndBroadcast(io, lat, lon, [], undefined, undefined, socket.id)` so the backend works locally without Make.com (degraded: empty fires).

### Make.com citizen scenario (for P2/Make.com operator)

New scenario with a "Custom webhook" trigger (URL stored as `MAKE_CITIZEN_WEBHOOK_URL`). Receives `{ lat, lon, socketId }`.

Modules (run in sequence or parallel where possible):
- **NASA FIRMS**: focos en radio ~25 km de `(lat, lon)`. Day-range ≥ 3 (NASA requirement).
- **OpenWeather**: clima en `(lat, lon)`.
- **OpenAQ**: AQI en `(lat, lon)`.

Assembles `fires[]` in the same format as the existing flow (each fire: `lat, lon, frp, brightness, speed, deg, humidity, date, pm25`).

Calls `POST /api/trigger/citizen` with body:
```json
{ "fires": [...], "socketId": "<socket.id>", "lat": <number>, "lon": <number> }
```

### New HTTP endpoint `POST /api/trigger/citizen`

**`packages/backend/src/routes/index.ts`** adds this endpoint (rate-limited, same limits as `/api/trigger/full`):

- Reads `{ fires, socketId, lat, lon }` from body.
- Validates `socketId` is a non-empty string; if missing, rejects with 400.
- Responds **202** immediately.
- Calls `executeAndBroadcast(io, lat, lon, firms, undefined, pm25, socketId)` in background.

---

## Section 2 — Targeted emit in `executeAndBroadcast`

**`packages/backend/src/socket/handlers.ts`**:

`executeAndBroadcast` gains an optional `targetSocketId?: string` parameter.

```ts
export async function executeAndBroadcast(
  io: Server,
  lat?: number,
  lon?: number,
  firms?: unknown[],
  weather?: unknown,
  pm25?: number,
  targetSocketId?: string   // NEW
): Promise<void>
```

All internal emits change to:
```ts
const target = targetSocketId ? io.to(targetSocketId) : io
target.emit('status', ...)
target.emit('update', ...)
target.emit('alert', ...)
```

The global analysis lock is still acquired regardless — only one analysis runs at a time.

`setLastUpdate(update)` is **only called** when `targetSocketId` is absent (citizen-specific analyses don't overwrite the global page memory).

---

## Section 3 — `bearing_deg` on `NaturalRoute`

### `shared/types/index.ts`

```ts
export interface NaturalRoute {
  // ... existing fields ...
  bearing_deg?: number   // NEW: initial bearing (0-360°) from route origin to destination
}
```

### `packages/agent-routes/src/analyze.ts`

Add a pure helper:
```ts
function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
        - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
```

When building `RouteData` from ORS response, store the bearing in a local `Map<string, number>` keyed by `dest.name` (= `r.id`):
- `coords[0]` = origin `[lon, lat]`, `coords[1]` = second point `[lon, lat]`.
- `bearingMap.set(dest.name, initialBearing(coords[0][1], coords[0][0], coords[1][1], coords[1][0]))`.

After A5 returns `NaturalRoutes`, inject `bearing_deg` into each route:
```ts
for (const ruta of naturalRoutes.rutas) {
  // Try exact match first, then case-insensitive substring (LLM may rephrase city names)
  let bearing = bearingMap.get(ruta.destino) ?? bearingMap.get(ruta.nombre)
  if (bearing === undefined) {
    for (const [key, val] of bearingMap) {
      if (ruta.destino?.toLowerCase().includes(key.toLowerCase()) ||
          ruta.nombre?.toLowerCase().includes(key.toLowerCase())) {
        bearing = val
        break
      }
    }
  }
  if (bearing !== undefined) ruta.bearing_deg = Math.round(bearing)
  // If no match: bearing_deg stays undefined — frontend handles gracefully (optional field)
}
```

---

## Section 4 — `direccion_principal_deg` on `ExpansionData`

### `shared/types/index.ts`

```ts
export interface ExpansionData {
  // ... existing fields ...
  direccion_principal_deg?: number   // NEW: propagation direction in degrees (0-360°)
}
```

### `packages/agent-fire/src/analyze.ts`

Add a pure helper (inverse of existing `degreesToCardinal`):
```ts
function cardinalToDeg(dir: string): number {
  const map: Record<string, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  }
  return map[dir.toUpperCase()] ?? 0
}
```

After A2 returns, attach the field:
```ts
const a2 = await runA2(...)
a2.direccion_principal_deg = cardinalToDeg(a2.direccion_principal)
```

Update `EMPTY` constant to include `direccion_principal_deg: 0`.

---

## Environment variables added

| Variable | Required | Description |
|---|---|---|
| `MAKE_CITIZEN_WEBHOOK_URL` | optional | Make.com citizen scenario webhook. If absent, falls back to empty-data analysis. |

---

## What this does NOT change

- The existing `trigger` socket event and `/api/trigger/full` endpoint are untouched.
- The global dashboard analysis flow, lock logic, and alert dispatch are untouched.
- `setLastUpdate` (page memory) is not called for citizen-scoped analyses.
- No frontend changes — the frontend already uses `bearing_deg` and `direccion_principal_deg` from mock data; once the backend emits real values the mock falls away naturally.
