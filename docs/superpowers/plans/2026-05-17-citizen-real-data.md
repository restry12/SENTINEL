# Citizen View — Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `/dashboard/citizen` view to real data by adding `bearing_deg` to evacuation routes, `direccion_principal_deg` to fire expansion, and a dedicated `trigger-citizen` socket event + `/api/trigger/citizen` endpoint that feeds a Make.com location-specific analysis back only to the requesting client.

**Architecture:** Two pure math helpers (`cardinalToDeg`, `initialBearing`) compute the new numeric fields inside the agents. A new `trigger-citizen` socket event calls a Make.com citizen webhook (forwarding `socketId`) instead of running analysis directly; the Make.com scenario fetches FIRMS/Weather/AQ for the citizen's GPS coordinates and calls back to the new `POST /api/trigger/citizen` endpoint, which runs `executeAndBroadcast` with a `targetSocketId` so the result is emitted only to the requesting socket — leaving the global dashboard untouched.

**Tech Stack:** TypeScript, Express, Socket.io v4, Vitest 1.x, `node-fetch` (global `fetch` available in Node 18+). All packages in `backend/` monorepo; shared types at `backend/shared/types`.

---

### Task 1: Update shared types

**Files:**
- Modify: `backend/shared/types/index.ts`

- [ ] **Step 1: Add `bearing_deg` to `NaturalRoute` and `direccion_principal_deg` to `ExpansionData`**

In `backend/shared/types/index.ts`, apply these two changes:

```ts
// Change NaturalRoute (around line 169):
export interface NaturalRoute {
  nombre: string
  origen: string
  destino: string
  distancia_km: number
  tiempo_estimado_min: number
  instrucciones: string
  estado: 'LIBRE' | 'CONGESTIONADA' | 'BLOQUEADA'
  prioridad: 1 | 2 | 3
  bearing_deg?: number   // initial compass bearing (0-360°) from route origin to destination
}

// Change ExpansionData (around line 105):
export interface ExpansionData {
  expansion_2h: ExpansionPolygon
  expansion_6h: ExpansionPolygon
  expansion_12h: ExpansionPolygon
  velocidad_propagacion_kmh: number
  direccion_principal: string
  direccion_principal_deg?: number   // propagation direction in degrees (0-360°)
}
```

- [ ] **Step 2: Verify types compile**

Run from `backend/`:
```bash
npm run build 2>&1 | head -30
```
Expected: no type errors. (Build may fail on unrelated dist files — type errors only matter.)

Alternatively, run tsc check only:
```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json 2>&1 | head -20
cd backend && npx tsc --noEmit -p packages/agent-fire/tsconfig.json 2>&1 | head -20
cd backend && npx tsc --noEmit -p packages/agent-routes/tsconfig.json 2>&1 | head -20
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add backend/shared/types/index.ts
git commit -m "feat(types): add bearing_deg to NaturalRoute, direccion_principal_deg to ExpansionData"
```

---

### Task 2: `cardinalToDeg` + `direccion_principal_deg` in agent-fire

**Files:**
- Modify: `backend/packages/agent-fire/src/analyze.ts`
- Modify: `backend/packages/agent-fire/src/analyze.test.ts`

- [ ] **Step 1: Write failing tests for `cardinalToDeg`**

Add to `backend/packages/agent-fire/src/analyze.test.ts` (append after existing tests):

```ts
import { describe, it, expect } from 'vitest'
import { degreesToCardinal, centroid, cardinalToDeg } from './analyze'

// ... existing tests unchanged ...

describe('cardinalToDeg', () => {
  it('returns 0 for N', () => {
    expect(cardinalToDeg('N')).toBe(0)
  })
  it('returns 45 for NE', () => {
    expect(cardinalToDeg('NE')).toBe(45)
  })
  it('returns 90 for E', () => {
    expect(cardinalToDeg('E')).toBe(90)
  })
  it('returns 135 for SE', () => {
    expect(cardinalToDeg('SE')).toBe(135)
  })
  it('returns 180 for S', () => {
    expect(cardinalToDeg('S')).toBe(180)
  })
  it('returns 225 for SW', () => {
    expect(cardinalToDeg('SW')).toBe(225)
  })
  it('returns 270 for W', () => {
    expect(cardinalToDeg('W')).toBe(270)
  })
  it('returns 315 for NW', () => {
    expect(cardinalToDeg('NW')).toBe(315)
  })
  it('is case-insensitive', () => {
    expect(cardinalToDeg('se')).toBe(135)
    expect(cardinalToDeg('Nw')).toBe(315)
  })
  it('returns 0 for unknown string', () => {
    expect(cardinalToDeg('X')).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend/packages/agent-fire && npm test 2>&1 | tail -20
```
Expected: `cardinalToDeg is not a function` or similar import error.

- [ ] **Step 3: Implement `cardinalToDeg` and attach `direccion_principal_deg`**

In `backend/packages/agent-fire/src/analyze.ts`:

**a)** Add the exported helper after `degreesToCardinal` (around line 9):

```ts
export function cardinalToDeg(dir: string): number {
  const map: Record<string, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  }
  return map[dir.toUpperCase()] ?? 0
}
```

**b)** In `runA2`, after `parseJSON` returns `a2`, attach the degree field. Find the `runA2` function (around line 152) — at the end, before the return, add:

```ts
const raw = await callOpenRouter(MODELS.large, system, user)
const a2 = parseJSON<ExpansionData>(raw, 'Agent 2 (Expansion)')
a2.direccion_principal_deg = cardinalToDeg(a2.direccion_principal)
return a2
```

(Replace the existing single-line `return parseJSON<ExpansionData>(raw, 'Agent 2 (Expansion)')`)

**c)** Update the `EMPTY` constant (around line 193) — add the new field:

```ts
expansion: {
  expansion_2h: { type: 'Polygon', coordinates: [], area_km2: 0 },
  expansion_6h: { type: 'Polygon', coordinates: [], area_km2: 0 },
  expansion_12h: { type: 'Polygon', coordinates: [], area_km2: 0 },
  velocidad_propagacion_kmh: 0,
  direccion_principal: 'N',
  direccion_principal_deg: 0,
},
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend/packages/agent-fire && npm test 2>&1 | tail -20
```
Expected: all tests pass including the new `cardinalToDeg` suite.

- [ ] **Step 5: Type-check**

```bash
cd backend && npx tsc --noEmit -p packages/agent-fire/tsconfig.json 2>&1
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/agent-fire/src/analyze.ts backend/packages/agent-fire/src/analyze.test.ts
git commit -m "feat(agent-fire): add cardinalToDeg, attach direccion_principal_deg to ExpansionData"
```

---

### Task 3: `initialBearing` + `bearing_deg` injection in agent-routes

**Files:**
- Modify: `backend/packages/agent-routes/src/analyze.ts`
- Modify: `backend/packages/agent-routes/package.json` (add vitest)
- Create: `backend/packages/agent-routes/src/analyze.test.ts`

- [ ] **Step 1: Add vitest to agent-routes**

`agent-routes` has no test setup yet. Add vitest:

```bash
cd backend/packages/agent-routes && npm install --save-dev vitest@^1.4.0
```

Add `"test": "vitest run"` to the `scripts` section of `backend/packages/agent-routes/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Write failing tests for `initialBearing`**

Create `backend/packages/agent-routes/src/analyze.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { initialBearing } from './analyze'

describe('initialBearing', () => {
  it('returns ~0° when destination is due north', () => {
    // from (0,0) to (1,0): moving north
    expect(initialBearing(0, 0, 1, 0)).toBeCloseTo(0, 0)
  })

  it('returns ~90° when destination is due east', () => {
    // from (0,0) to (0,1): moving east
    expect(initialBearing(0, 0, 0, 1)).toBeCloseTo(90, 0)
  })

  it('returns ~180° when destination is due south', () => {
    // from (1,0) to (0,0): moving south
    expect(initialBearing(1, 0, 0, 0)).toBeCloseTo(180, 0)
  })

  it('returns ~270° when destination is due west', () => {
    // from (0,1) to (0,0): moving west
    expect(initialBearing(0, 1, 0, 0)).toBeCloseTo(270, 0)
  })

  it('returns a value in [0, 360)', () => {
    const b = initialBearing(-38.7, -72.5, -37.7, -72.7)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })

  it('returns a rounded integer', () => {
    const b = initialBearing(-38.7, -72.5, -37.7, -72.7)
    expect(b).toBe(Math.round(b))
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd backend/packages/agent-routes && npm test 2>&1 | tail -20
```
Expected: `initialBearing is not a function` or import error.

- [ ] **Step 4: Implement `initialBearing` and bearing injection**

In `backend/packages/agent-routes/src/analyze.ts`:

**a)** Add the exported helper at the top, after the imports:

```ts
export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
        - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
}
```

**b)** In `calculateEvacuationRoutes` (around line 119), build a `bearingMap` while fetching ORS routes. Replace the existing routes-building loop:

```ts
const bearingMap = new Map<string, number>()
const routes: RouteData[] = []
if (apiKey) {
  for (const dest of EVACUATION_DESTINATIONS) {
    try {
      const route = await fetchOrsRoute(apiKey, avgLon, avgLat, dest.lon, dest.lat, avoidPolygon)
      if (route) {
        routes.push({ ...route, id: dest.name })
        // bearing from route origin (first coord) to second coord
        const coords = route.geometry.coordinates
        if (coords.length >= 2) {
          bearingMap.set(dest.name, initialBearing(
            coords[0][1], coords[0][0],   // lat1, lon1 (ORS uses [lon,lat])
            coords[1][1], coords[1][0],   // lat2, lon2
          ))
        }
      }
    } catch (err) {
      console.warn(`[agent-routes] route to ${dest.name} failed:`, err)
    }
  }
}
```

**c)** After the `naturalRoutes = await runA5(...)` call (around line 141), inject `bearing_deg` into each route:

```ts
if (naturalRoutes) {
  for (const ruta of naturalRoutes.rutas) {
    let bearing = bearingMap.get(ruta.destino) ?? bearingMap.get(ruta.nombre)
    if (bearing === undefined) {
      for (const [key, val] of bearingMap) {
        if (
          ruta.destino?.toLowerCase().includes(key.toLowerCase()) ||
          ruta.nombre?.toLowerCase().includes(key.toLowerCase())
        ) {
          bearing = val
          break
        }
      }
    }
    if (bearing !== undefined) ruta.bearing_deg = bearing
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend/packages/agent-routes && npm test 2>&1 | tail -20
```
Expected: all 6 `initialBearing` tests pass.

- [ ] **Step 6: Type-check**

```bash
cd backend && npx tsc --noEmit -p packages/agent-routes/tsconfig.json 2>&1
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add backend/packages/agent-routes/src/analyze.ts \
        backend/packages/agent-routes/src/analyze.test.ts \
        backend/packages/agent-routes/package.json \
        backend/packages/agent-routes/package-lock.json
git commit -m "feat(agent-routes): add initialBearing helper, inject bearing_deg into NaturalRoutes"
```

---

### Task 4: `executeAndBroadcast` — targeted socket emit

**Files:**
- Modify: `backend/packages/backend/src/socket/handlers.ts`
- Create: `backend/packages/backend/src/socket/handlers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/packages/backend/src/socket/handlers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all service dependencies before importing the handler
vi.mock('../services/orchestrator', () => ({
  runAnalysis: vi.fn(),
}))
vi.mock('../services/analysis-lock', () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  isLocked: vi.fn(),
}))
vi.mock('../services/last-update', () => ({
  setLastUpdate: vi.fn(),
  getLastUpdate: vi.fn(),
}))
vi.mock('../services/history', () => ({
  saveIncident: vi.fn(),
}))
vi.mock('../services/alert', () => ({
  triggerMakeWebhook: vi.fn(),
}))

import { executeAndBroadcast } from './handlers'
import { runAnalysis } from '../services/orchestrator'
import { acquireLock, releaseLock } from '../services/analysis-lock'
import { setLastUpdate } from '../services/last-update'
import { saveIncident } from '../services/history'
import { triggerMakeWebhook } from '../services/alert'
import type { SentinelUpdate } from '@sentinel/types'

const MOCK_UPDATE: SentinelUpdate = {
  timestamp: '2026-01-01T00:00:00Z',
  fires: [],
  polygon: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} },
  weather: { speed: 0, deg: 0, humidity: 0 },
  airQuality: { pm25: 0, aqi: 0, category: 'Good' },
  routes: [],
  riskLevel: 'low',
}

function makeMockIo() {
  const roomEmit = vi.fn()
  const to = vi.fn(() => ({ emit: roomEmit }))
  const emit = vi.fn()
  return { io: { emit, to } as any, roomEmit, to, emit }
}

describe('executeAndBroadcast', () => {
  beforeEach(() => {
    vi.mocked(acquireLock).mockReturnValue(true)
    vi.mocked(releaseLock).mockReturnValue(undefined as any)
    vi.mocked(runAnalysis).mockResolvedValue(MOCK_UPDATE)
    vi.mocked(setLastUpdate).mockReturnValue(undefined)
    vi.mocked(saveIncident).mockResolvedValue(undefined)
    vi.mocked(triggerMakeWebhook).mockResolvedValue(undefined)
  })

  it('broadcasts to ALL clients when no targetSocketId', async () => {
    const { io, emit, to } = makeMockIo()
    await executeAndBroadcast(io)
    expect(to).not.toHaveBeenCalledWith(expect.stringContaining(''))
    expect(emit).toHaveBeenCalledWith('update', MOCK_UPDATE)
    expect(vi.mocked(setLastUpdate)).toHaveBeenCalledWith(MOCK_UPDATE)
  })

  it('emits ONLY to target socket when targetSocketId provided', async () => {
    const { io, roomEmit, to, emit } = makeMockIo()
    await executeAndBroadcast(io, undefined, undefined, undefined, undefined, undefined, 'socket-abc')
    expect(to).toHaveBeenCalledWith('socket-abc')
    expect(roomEmit).toHaveBeenCalledWith('update', MOCK_UPDATE)
    // global io.emit should NOT have been called with 'update'
    expect(emit).not.toHaveBeenCalledWith('update', expect.anything())
  })

  it('does NOT call setLastUpdate when targetSocketId provided', async () => {
    const { io } = makeMockIo()
    await executeAndBroadcast(io, undefined, undefined, undefined, undefined, undefined, 'socket-abc')
    expect(vi.mocked(setLastUpdate)).not.toHaveBeenCalled()
  })

  it('skips if lock is not acquired', async () => {
    vi.mocked(acquireLock).mockReturnValue(false)
    const { io, emit } = makeMockIo()
    await executeAndBroadcast(io)
    expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend/packages/backend && npm test 2>&1 | grep -A5 "handlers.test"
```
Expected: tests fail because `executeAndBroadcast` has no `targetSocketId` param yet.

- [ ] **Step 3: Modify `executeAndBroadcast`**

In `backend/packages/backend/src/socket/handlers.ts`, update the function signature and body:

```ts
export async function executeAndBroadcast(
  io: Server,
  lat?: number,
  lon?: number,
  firms?: unknown[],
  weather?: unknown,
  pm25?: number,
  targetSocketId?: string,   // NEW
): Promise<void> {
  if (!acquireLock()) {
    console.warn('[orchestrator] analysis already in progress — skipping duplicate trigger')
    return
  }

  const chan = targetSocketId ? io.to(targetSocketId) : io   // NEW

  chan.emit('status', { state: 'loading' } satisfies StatusPayload)

  try {
    const update = await runAnalysis(lat, lon, firms, weather, pm25)
    if (!targetSocketId) setLastUpdate(update)                // NEW: only update global memory for broadcast analyses
    chan.emit('update', update)
    chan.emit('status', { state: 'ok' } satisfies StatusPayload)

    let alertsSent = false
    if (update.riskLevel === 'high' || update.riskLevel === 'critical') {
      const alert: AlertPayload = {
        riskLevel: update.riskLevel,
        fires: update.fires,
        timestamp: update.timestamp,
      }
      chan.emit('alert', alert)
      const centLat = lat ?? DEFAULT_LAT
      const centLon = lon ?? DEFAULT_LON
      await triggerMakeWebhook(update as SentinelUpdate, centLat, centLon)
      alertsSent = true
    }

    await saveIncident(update, lat ?? DEFAULT_LAT, lon ?? DEFAULT_LON, alertsSent)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[orchestrator] error:', message)
    chan.emit('status', { state: 'error', message } satisfies StatusPayload)
  } finally {
    releaseLock()
  }
}
```

Note: `io.to(socketId)` returns a `BroadcastOperator`, not a `Server`. TypeScript will need the type of `chan` inferred. If there's a type error, add an explicit type:
```ts
const chan: { emit: (ev: string, ...args: unknown[]) => void } =
  targetSocketId ? io.to(targetSocketId) : io
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend/packages/backend && npm test 2>&1 | tail -30
```
Expected: all 4 new tests pass, existing tests still pass.

- [ ] **Step 5: Type-check**

```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json 2>&1
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/backend/src/socket/handlers.ts \
        backend/packages/backend/src/socket/handlers.test.ts
git commit -m "feat(backend): executeAndBroadcast supports targetSocketId for citizen-scoped emit"
```

---

### Task 5: `trigger-citizen` socket event

**Files:**
- Modify: `backend/packages/backend/src/socket/handlers.ts`

- [ ] **Step 1: Add `MAKE_CITIZEN_WEBHOOK_URL` env call and register `trigger-citizen` event**

In `backend/packages/backend/src/socket/handlers.ts`, inside `registerSocketHandlers`, after the existing `socket.on('trigger', ...)` block, add:

```ts
socket.on('trigger-citizen', (data: { lat?: number; lon?: number }) => {
  // Per-socket rate limit (shared map with 'trigger')
  const lastTrigger = socketLastTrigger.get(socket.id) ?? 0
  const elapsed = Date.now() - lastTrigger
  if (elapsed < SOCKET_TRIGGER_COOLDOWN_MS) {
    const waitSec = Math.ceil((SOCKET_TRIGGER_COOLDOWN_MS - elapsed) / 1000)
    socket.emit('status', {
      state: 'error',
      message: `Demasiadas peticiones. Espera ${waitSec}s antes de analizar otra zona.`,
    } satisfies StatusPayload)
    return
  }

  const lat = typeof data.lat === 'number' && isFinite(data.lat) ? data.lat : undefined
  const lon = typeof data.lon === 'number' && isFinite(data.lon) ? data.lon : undefined

  if (!lat || !lon) {
    socket.emit('status', {
      state: 'error',
      message: 'Coordenadas inválidas. Se requiere lat y lon.',
    } satisfies StatusPayload)
    return
  }

  socketLastTrigger.set(socket.id, Date.now())
  socket.emit('status', { state: 'loading' } satisfies StatusPayload)

  const citizenWebhookUrl = process.env.MAKE_CITIZEN_WEBHOOK_URL

  if (citizenWebhookUrl) {
    // Delegate to Make.com — it will fetch FIRMS/Weather/AQ and call back to /api/trigger/citizen
    fetch(citizenWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, socketId: socket.id }),
    }).catch((err) => {
      console.error('[trigger-citizen] Make.com webhook call failed:', err)
      socket.emit('status', {
        state: 'error',
        message: 'No se pudo iniciar el análisis ciudadano.',
      } satisfies StatusPayload)
    })
  } else {
    // Fallback: run analysis with empty data (degraded — no real fires for location)
    console.warn('[trigger-citizen] MAKE_CITIZEN_WEBHOOK_URL not set — running degraded analysis')
    executeAndBroadcast(io, lat, lon, [], undefined, undefined, socket.id).catch((err) => {
      console.error('[trigger-citizen] fallback analysis error:', err)
    })
  }
})
```

- [ ] **Step 2: Type-check**

```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json 2>&1
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/packages/backend/src/socket/handlers.ts
git commit -m "feat(socket): add trigger-citizen event — calls Make.com webhook with socketId"
```

---

### Task 6: `POST /api/trigger/citizen` endpoint

**Files:**
- Modify: `backend/packages/backend/src/routes/index.ts`
- Create: `backend/packages/backend/src/routes/citizen.test.ts`

- [ ] **Step 1: Write failing tests for body parsing validation**

Create `backend/packages/backend/src/routes/citizen.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCitizenBody } from './index'

describe('parseCitizenBody', () => {
  it('returns null when socketId is missing', () => {
    expect(parseCitizenBody({ fires: [], lat: -38, lon: -72 })).toBeNull()
  })

  it('returns null when socketId is empty string', () => {
    expect(parseCitizenBody({ fires: [], lat: -38, lon: -72, socketId: '' })).toBeNull()
  })

  it('returns null when fires is not an array', () => {
    expect(parseCitizenBody({ fires: 'bad', lat: -38, lon: -72, socketId: 'abc' })).toBeNull()
  })

  it('returns parsed body with valid input', () => {
    const fires = [{ lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '' }]
    const result = parseCitizenBody({ fires, lat: -38.5, lon: -72.5, socketId: 'abc123' })
    expect(result).not.toBeNull()
    expect(result?.socketId).toBe('abc123')
    expect(result?.lat).toBe(-38.5)
    expect(result?.lon).toBe(-72.5)
    expect(result?.firms).toBe(fires)
  })

  it('extracts max pm25 from fires', () => {
    const fires = [
      { lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '', pm25: 40 },
      { lat: -38.1, lon: -72.1, frp: 80, brightness: 280, timestamp: '', pm25: 80 },
    ]
    const result = parseCitizenBody({ fires, lat: -38, lon: -72, socketId: 'abc' })
    expect(result?.pm25).toBe(80)
  })

  it('sets pm25 to undefined when no fires have pm25', () => {
    const fires = [{ lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '' }]
    const result = parseCitizenBody({ fires, lat: -38, lon: -72, socketId: 'abc' })
    expect(result?.pm25).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend/packages/backend && npm test 2>&1 | grep -A5 "citizen.test"
```
Expected: `parseCitizenBody is not a function` / export error.

- [ ] **Step 3: Add `parseCitizenBody` and the endpoint**

In `backend/packages/backend/src/routes/index.ts`:

**a)** Add the exported pure parser function (place it near the top, after the imports and before `registerRoutes`):

```ts
type RawCitizenBody = {
  fires?: unknown
  lat?: unknown
  lon?: unknown
  socketId?: unknown
}

export function parseCitizenBody(body: RawCitizenBody): {
  firms: unknown[]
  socketId: string
  lat: number | undefined
  lon: number | undefined
  pm25: number | undefined
} | null {
  const socketId = typeof body.socketId === 'string' && body.socketId.length > 0
    ? body.socketId
    : null
  if (!socketId) return null

  const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : null
  if (!rawFires) return null

  const lat = typeof body.lat === 'number' && isFinite(body.lat) ? body.lat : undefined
  const lon = typeof body.lon === 'number' && isFinite(body.lon) ? body.lon : undefined

  const pm25Values = rawFires
    .map(f => f.pm25)
    .filter((v): v is number => typeof v === 'number')
  const pm25 = pm25Values.length > 0 ? Math.max(...pm25Values) : undefined

  return { firms: rawFires, socketId, lat, lon, pm25 }
}
```

**b)** Inside `registerRoutes`, add the new endpoint after `POST /api/trigger/full` (around line 125):

```ts
// POST /api/trigger/citizen — Make.com citizen scenario callback (rate limited)
// Receives { fires, socketId, lat, lon } — emits analysis only to the requesting citizen socket
app.post('/api/trigger/citizen', triggerLimiter, async (req, res) => {
  const parsed = parseCitizenBody(req.body as RawCitizenBody)
  if (!parsed) {
    res.status(400).json({ ok: false, error: 'socketId required and fires must be an array' })
    return
  }
  const { firms, socketId, lat, lon, pm25 } = parsed

  // Respond immediately — analysis is broadcast over Socket.io
  res.status(202).json({ ok: true, accepted: true, fires: firms.length })

  executeAndBroadcast(io, lat, lon, firms, undefined, pm25, socketId).catch((err) => {
    console.error('[trigger/citizen] background analysis error:', err instanceof Error ? err.message : err)
  })
})
```

Note: `RawCitizenBody` type is already defined above — it can be used directly in the route handler.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend/packages/backend && npm test 2>&1 | tail -30
```
Expected: all tests pass including the 5 new `parseCitizenBody` tests.

- [ ] **Step 5: Type-check**

```bash
cd backend && npx tsc --noEmit -p packages/backend/tsconfig.json 2>&1
```
Expected: no output.

- [ ] **Step 6: Run all backend tests**

```bash
cd backend/packages/backend && npm test 2>&1
cd backend/packages/agent-fire && npm test 2>&1
cd backend/packages/agent-routes && npm test 2>&1
```
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add backend/packages/backend/src/routes/index.ts \
        backend/packages/backend/src/routes/citizen.test.ts
git commit -m "feat(backend): add POST /api/trigger/citizen endpoint for citizen-scoped analysis"
```

---

## Make.com Citizen Scenario (for P2 operator — not code)

Configure a new Make.com scenario with these modules:

1. **Webhook trigger** — set the URL as `MAKE_CITIZEN_WEBHOOK_URL` in Render env. Receives `{ lat, lon, socketId }`.

2. **NASA FIRMS HTTP** — `GET https://firms.modaps.eosdis.nasa.gov/api/area/csv/<API_KEY>/VIIRS_SNPP_NRT/<lon-0.25>,<lat-0.25>,<lon+0.25>,<lat+0.25>/3` (day_range=3, bounding box ~25 km). Parse CSV rows into fire objects.

3. **OpenWeather HTTP** — `GET https://api.openweathermap.org/data/2.5/weather?lat=<lat>&lon=<lon>&appid=<KEY>&units=metric`.

4. **OpenAQ HTTP** — `GET https://api.openaq.org/v3/locations?coordinates=<lat>,<lon>&radius=25000&parameters_id=2` (pm25).

5. **HTTP POST to backend** — `POST https://sentinel-0zkq.onrender.com/api/trigger/citizen` with body:
   ```json
   {
     "socketId": "{{webhook.socketId}}",
     "lat": {{webhook.lat}},
     "lon": {{webhook.lon}},
     "fires": [/* assembled FIRMS array — same format as /api/trigger/full */]
   }
   ```
   Each fire object: `{ lat, lon, frp, brightness, timestamp, speed, deg, humidity, pm25 }` — pull `speed/deg/humidity` from the OpenWeather response (same value for all fires from that location).

---

## Summary of Changes

| File | Change |
|---|---|
| `backend/shared/types/index.ts` | `NaturalRoute.bearing_deg?`, `ExpansionData.direccion_principal_deg?` |
| `backend/packages/agent-fire/src/analyze.ts` | export `cardinalToDeg`, attach `direccion_principal_deg` after A2, update EMPTY |
| `backend/packages/agent-fire/src/analyze.test.ts` | 10 new tests for `cardinalToDeg` |
| `backend/packages/agent-routes/src/analyze.ts` | export `initialBearing`, build `bearingMap` in ORS loop, inject `bearing_deg` after A5 |
| `backend/packages/agent-routes/src/analyze.test.ts` | NEW — 6 tests for `initialBearing` |
| `backend/packages/agent-routes/package.json` | add `vitest`, add `"test"` script |
| `backend/packages/backend/src/socket/handlers.ts` | `executeAndBroadcast` gains `targetSocketId?`; new `trigger-citizen` event |
| `backend/packages/backend/src/socket/handlers.test.ts` | NEW — 4 tests for targeted vs broadcast emit |
| `backend/packages/backend/src/routes/index.ts` | export `parseCitizenBody`; add `POST /api/trigger/citizen` |
| `backend/packages/backend/src/routes/citizen.test.ts` | NEW — 5 tests for `parseCitizenBody` |
