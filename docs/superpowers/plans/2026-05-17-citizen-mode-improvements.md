# Citizen Mode Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the citizen mode map centering bug, add proximity-based alert threshold, and add personalized escape route calculation from the citizen's GPS position.

**Architecture:** Three independent incremental changes: (1) surgical map fix in `sentinel-map.tsx`, (2) proximity gating + new `ScreenSafe` UI in `citizen-app.tsx` and `screens.tsx`, (3) new `/analyze/citizen` endpoint in `agent-routes` plus backend relay and frontend socket listener.

**Tech Stack:** Next.js 16 (frontend), Express/Socket.io (backend), Mapbox GL JS, OpenRouteService API, OpenRouter LLM (mistral via `callOpenRouter`), Vitest (tests).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/components/citizen/sentinel-map.tsx` | Modify | Remove fitBounds; zoom 15→14; setMinZoom(12) |
| `frontend/components/citizen/citizen-app.tsx` | Modify | Add `nearestFireKm`, proximity check, `'safe'` screen state, `citizenRoutes` in buildScene |
| `frontend/components/citizen/screens.tsx` | Modify | Add `ScreenSafe` component |
| `frontend/hooks/use-socket.ts` | Modify | Listen `citizen-routes` event; expose `citizenRoutes` state; call `/api/citizen-routes` in `triggerCitizen` |
| `frontend/contexts/sentinel-context.tsx` | Modify | Add `citizenRoutes` to `SentinelContextValue` |
| `frontend/app/api/citizen-routes/route.ts` | Create | Next.js proxy for `/api/citizen-routes` |
| `backend/packages/agent-routes/src/analyze.ts` | Modify | Add `haversineKmLocal`, `destinationPoint`, `bearingToCompass`, `computeEscapeBearing`, `runA5CitizenRoutes`, `calculateCitizenEscapeRoute` |
| `backend/packages/agent-routes/src/analyze.test.ts` | Modify | Tests for `computeEscapeBearing` |
| `backend/packages/agent-routes/src/index.ts` | Modify | Register `POST /analyze/citizen` |
| `backend/packages/backend/src/routes/index.ts` | Modify | Add `POST /api/citizen-routes` endpoint |

---

## Task 1: Fix Map Centering

**Files:**
- Modify: `frontend/components/citizen/sentinel-map.tsx:133-139` (zoom)
- Modify: `frontend/components/citizen/sentinel-map.tsx:277-294` (remove fitBounds block)

- [ ] **Step 1.1: Change zoom from 15 to 14**

In `sentinel-map.tsx`, find the `new mapboxgl.Map({...})` call (around line 133). Change `zoom: 15` to `zoom: 14`:

```ts
const map = new mapboxgl.Map({
  container: el,
  style: "mapbox://styles/mapbox/satellite-streets-v12",
  center: [user.lon, user.lat],
  zoom: 14,
  attributionControl: false,
})
```

- [ ] **Step 1.2: Replace fitBounds block with setMinZoom**

Find and remove the comment `// ── Frame the scene tight and lock the view close` through the end of `map.setMaxBounds(...)`. Replace the entire block (lines 277–294) with a single line:

```ts
          map.setMinZoom(12)
```

The resulting end of the `map.on("load", ...)` callback should look like:

```ts
          markersRef.current.push(
            new mapboxgl.Marker({ element: makeLabelEl(route.label, "#bbf7d0"), offset: [0, 18] })
              .setLngLat([dest.lon, dest.lat]).addTo(map),
          )

          map.setMinZoom(12)
        })
```

- [ ] **Step 1.3: Verify visually**

Start the frontend dev server (`cd frontend && pnpm dev`) and open http://localhost:3010/dashboard/citizen. Click "Activar ubicación GPS" (allow GPS). The map should render centered on your GPS coordinates at street/neighborhood level — not the whole globe.

- [ ] **Step 1.4: Commit**

```bash
git add frontend/components/citizen/sentinel-map.tsx
git commit -m "fix(citizen): center map on user GPS, remove fitBounds that caused zoom-out"
```

---

## Task 2: Proximity Threshold + ScreenSafe

**Files:**
- Modify: `frontend/components/citizen/citizen-app.tsx`
- Modify: `frontend/components/citizen/screens.tsx`

### 2A — Add nearestFireKm helper and 'safe' screen state

- [ ] **Step 2A.1: Add nearestFireKm helper to citizen-app.tsx**

In `citizen-app.tsx`, add this function directly after the existing `compassToDeg` function (around line 32):

```ts
function nearestFireKm(
  userLoc: { lat: number; lon: number },
  fires: { lat: number; lon: number }[],
): number {
  if (fires.length === 0) return Infinity
  return Math.min(...fires.map((f) => haversineKm(userLoc.lat, userLoc.lon, f.lat, f.lon)))
}

const CITIZEN_ALERT_RADIUS_KM = 0.8
```

- [ ] **Step 2A.2: Add 'safe' to ScreenState**

Change the `ScreenState` type at line 16:

```ts
type ScreenState = 'locating' | 'alert' | 'compass' | 'trapped_confirm' | 'trapped_live' | 'safe'
```

- [ ] **Step 2A.3: Modify handleLocated to gate on proximity**

Replace the entire `handleLocated` function:

```ts
const handleLocated = useCallback((coords?: { lat: number; lon: number }) => {
  if (coords) {
    setUserLoc(coords)
    triggerCitizen(coords.lat, coords.lon)
    if (!connected) {
      console.warn('[CitizenApp] socket not connected — trigger-citizen not sent')
    }
    if (sentinelUpdate && sentinelUpdate.fires.length > 0) {
      const nearest = nearestFireKm(coords, sentinelUpdate.fires)
      setScreen(nearest <= CITIZEN_ALERT_RADIUS_KM ? 'alert' : 'safe')
    } else {
      setScreen('alert')
    }
  } else {
    setScreen('alert')
  }
}, [triggerCitizen, connected, sentinelUpdate])
```

- [ ] **Step 2A.4: Add ScreenSafe to the return JSX**

In the `CitizenApp` return, add the `safe` screen after `trapped_live`:

```tsx
      {screen === 'trapped_live' && (
        <ScreenTrappedLive
          onRecall={() => setScreen('alert')}
        />
      )}
      {screen === 'safe' && (
        <ScreenSafe
          nearestKm={userLoc && data.fires.length > 0
            ? nearestFireKm(userLoc, data.fires)
            : null}
          weather={data.weather}
          onRefresh={() => setScreen('locating')}
        />
      )}
```

Also add `ScreenSafe` to the import line at the top of `citizen-app.tsx`:

```ts
import {
  ScreenLocating,
  ScreenAlert,
  ScreenTrappedConfirm,
  ScreenTrappedLive,
  ScreenSafe,
} from './screens'
```

### 2B — Add ScreenSafe to screens.tsx

- [ ] **Step 2B.1: Add ScreenSafe component at the end of screens.tsx**

Append this component to `screens.tsx`:

```tsx
// ── Screen Safe: No Nearby Fire ───────────────────────────────────────────

interface ScreenSafeProps {
  nearestKm: number | null
  weather: { wind_speed_kmh: number; wind_dir_deg: number; humidity_pct: number; temp_c: number }
  onRefresh?: () => void
}

export function ScreenSafe({ nearestKm, weather, onRefresh }: ScreenSafeProps) {
  return (
    <div className="screen scanlines" style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse 90% 60% at 50% 40%, rgba(34,197,94,0.08) 0%, var(--background) 65%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <SentinelStatusStrip riskLevel="low" />
      <div style={{ height: 86 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 28 }}>
        {/* Shield icon */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <path d="M 40 8 L 68 18 L 68 42 C 68 58 55 70 40 74 C 25 70 12 58 12 42 L 12 18 Z"
            fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.6)" strokeWidth="2" />
          <path d="M 26 40 L 36 50 L 54 32" stroke="var(--safe)" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>

        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--safe)', marginBottom: 10, textTransform: 'uppercase' }}>
            ÁREA MONITOREADA
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, marginBottom: 12 }}>
            Sin amenaza activa
          </div>
          {nearestKm !== null && isFinite(nearestKm) && (
            <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.45 }}>
              El foco más cercano está a{' '}
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                {nearestKm.toFixed(1)} km
              </span>{' '}
              de tu posición.
            </div>
          )}
        </div>

        {/* Weather strip */}
        <div style={{
          width: '100%', maxWidth: 320, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          {[
            { label: 'VIENTO',    value: `${weather.wind_speed_kmh} km/h` },
            { label: 'HUMEDAD',   value: `${weather.humidity_pct}%` },
            { label: 'TEMP',      value: `${weather.temp_c}°C` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 10px', textAlign: 'center',
            }}>
              <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</div>
              <div className="font-mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 22px 36px' }}>
        <div className="font-mono" style={{
          fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em',
          textAlign: 'center', marginBottom: 14, textTransform: 'uppercase',
        }}>
          SENTINEL MONITOREA EN TIEMPO REAL
        </div>
        <button
          onClick={onRefresh}
          style={{
            width: '100%', minHeight: 56, borderRadius: 14,
            background: 'transparent', color: 'var(--foreground)',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 15, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M 2 8 A 6 6 0 1 1 8 14 M 8 14 L 5 11 M 8 14 L 11 11"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Actualizar mi ubicación
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2B.2: Verify the safe screen**

In the frontend, temporarily change the logic in `handleLocated` to always route to `'safe'` to test it, verify the screen looks correct, then revert.

- [ ] **Step 2B.3: Also fix bearing_deg in buildScene (citizen-app.tsx)**

In `buildScene`, in the `naturalRoutes` mapping block (around line 69), change:
```ts
bearing_deg: u.weather?.deg ?? 0,
```
to:
```ts
bearing_deg: r.bearing_deg ?? u.weather?.deg ?? 0,
```

This ensures that when the agent-routes returns a route with a real bearing (computed from ORS geometry), it is used instead of always defaulting to wind direction.

- [ ] **Step 2B.4: Commit**

```bash
git add frontend/components/citizen/citizen-app.tsx frontend/components/citizen/screens.tsx
git commit -m "feat(citizen): add proximity threshold and ScreenSafe — only alert when fire ≤0.8km"
```

---

## Task 3: Citizen Escape Route in agent-routes

**Files:**
- Modify: `backend/packages/agent-routes/src/analyze.ts`
- Modify: `backend/packages/agent-routes/src/analyze.test.ts`
- Modify: `backend/packages/agent-routes/src/index.ts`

### 3A — Add helpers and citizen route logic to analyze.ts

- [ ] **Step 3A.1: Write failing tests for new helpers**

Open `backend/packages/agent-routes/src/analyze.test.ts`. Append after the existing `initialBearing` tests:

```ts
import { computeEscapeBearing } from './analyze'

describe('computeEscapeBearing', () => {
  it('returns bearing opposite to the fire', () => {
    // User at origin, fire due north — escape should be ~180° (south)
    const fires = [{ lat: 1, lon: 0, frp: 100, brightness: 300, timestamp: '' }]
    const bearing = computeEscapeBearing(0, 0, fires, 270) // wind from west, no correction needed
    expect(bearing).toBeCloseTo(180, 0)
  })

  it('shifts 90° when wind blows escape direction toward user', () => {
    // Fire to north (escape = south = 180°), wind FROM south (deg 180°)
    // Wind from south pushes fire north, away from user heading south — no correction
    // Wind from north (deg 0°) means fire spreads south = INTO escape path → shift
    const fires = [{ lat: 1, lon: 0, frp: 100, brightness: 300, timestamp: '' }]
    const bearingNoShift = computeEscapeBearing(0, 0, fires, 180) // wind from S — fine
    const bearingShifted  = computeEscapeBearing(0, 0, fires, 0)  // wind from N — shift
    expect(bearingNoShift).toBeCloseTo(180, 0)
    // Shifted should be ~90° or ~270° (cross-wind)
    expect([90, 270]).toContain(Math.round(bearingShifted / 90) * 90)
  })

  it('returns a value in [0, 360)', () => {
    const fires = [{ lat: -38, lon: -72, frp: 100, brightness: 300, timestamp: '' }]
    const b = computeEscapeBearing(-38.5, -72.5, fires, 45)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })
})
```

- [ ] **Step 3A.2: Run tests — they should fail**

```bash
cd backend && npm test -- --filter agent-routes 2>&1 | tail -20
```

Expected: FAIL — `computeEscapeBearing is not exported from './analyze'`

- [ ] **Step 3A.3: Add helper functions to analyze.ts**

At the top of `backend/packages/agent-routes/src/analyze.ts`, after the imports, add:

```ts
// ── Citizen-mode helpers ──────────────────────────────────────────────────

function haversineKmLocal(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function destinationPointLocal(
  lat: number, lon: number, bearingDeg: number, distanceKm: number,
): { lat: number; lon: number } {
  const R = 6371
  const d = distanceKm / R
  const theta = (bearingDeg * Math.PI) / 180
  const phi1 = (lat * Math.PI) / 180
  const lambda1 = (lon * Math.PI) / 180
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(theta),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    )
  return { lat: (phi2 * 180) / Math.PI, lon: (lambda2 * 180) / Math.PI }
}

function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

export function computeEscapeBearing(
  userLat: number,
  userLon: number,
  fires: FireData[],
  windDirDeg: number,
): number {
  // centroid of up to 5 nearest fires
  const sorted = [...fires].sort(
    (a, b) =>
      haversineKmLocal(userLat, userLon, a.lat, a.lon) -
      haversineKmLocal(userLat, userLon, b.lat, b.lon),
  )
  const nearest = sorted.slice(0, 5)
  const avgLat = nearest.reduce((s, f) => s + f.lat, 0) / nearest.length
  const avgLon = nearest.reduce((s, f) => s + f.lon, 0) / nearest.length

  const fireBearing = initialBearing(userLat, userLon, avgLat, avgLon)
  let escapeBearing = (fireBearing + 180) % 360

  // Wind correction: windDirDeg is the direction the wind comes FROM.
  // If wind comes FROM the escape direction (windDirDeg ≈ escapeBearing ± 45°),
  // fire spreads opposite to wind = INTO the escape path → shift 90°.
  const diff = Math.abs(((windDirDeg - escapeBearing) + 540) % 360 - 180)
  if (diff < 45) {
    escapeBearing = (escapeBearing + 90) % 360
  }

  return escapeBearing
}
```

- [ ] **Step 3A.4: Add runA5CitizenRoutes function**

Append after `runA5` in `analyze.ts` (before `calculateEvacuationRoutes`):

```ts
async function runA5CitizenRoutes(
  userLat: number,
  userLon: number,
  nearestFireDistKm: number,
  escapeBearing: number,
  orsRoutes: RouteData[],
  weather: { wind_speed_kmh: number; wind_dir_deg: number },
): Promise<NaturalRoutes> {
  const compassDir = bearingToCompass(escapeBearing)

  const system = `Eres un experto en evacuaciones de emergencia para incendios forestales.
Recibes la posición real de un ciudadano en peligro y rutas calculadas por OpenRouteService.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "rutas": [
    {
      "nombre": "nombre corto de la ruta",
      "origen": "posición del ciudadano",
      "destino": "punto seguro de llegada",
      "distancia_km": número,
      "tiempo_estimado_min": número,
      "instrucciones": "instrucciones claras paso a paso DESDE la posición del ciudadano",
      "estado": "LIBRE" | "CONGESTIONADA" | "BLOQUEADA",
      "prioridad": 1 | 2 | 3
    }
  ],
  "punto_encuentro_principal": "punto de encuentro principal",
  "mensaje_alerta": "mensaje urgente y personalizado para el ciudadano en español"
}`

  const userMsg = `Ciudadano en: lat=${userLat.toFixed(5)}, lon=${userLon.toFixed(5)}
Foco más cercano: ${nearestFireDistKm.toFixed(2)} km
Dirección de escape recomendada: ${Math.round(escapeBearing)}° (${compassDir})
Viento: ${weather.wind_speed_kmh} km/h desde ${weather.wind_dir_deg}°

Rutas calculadas por OpenRouteService (desde la posición del ciudadano):
${JSON.stringify(
  orsRoutes.map((r) => ({
    id: r.id,
    distancia_km: Math.round(r.distance / 1000),
    duracion_min: Math.round(r.duration / 60),
  })),
  null,
  2,
)}

Genera instrucciones de evacuación personalizadas DESDE la posición del ciudadano.`

  const raw = await callOpenRouter(MODELS.small, system, userMsg)
  return parseJSON<NaturalRoutes>(raw, 'Agent5Citizen')
}
```

- [ ] **Step 3A.5: Add calculateCitizenEscapeRoute function**

Append after `calculateEvacuationRoutes` at the end of `analyze.ts`:

```ts
export async function calculateCitizenEscapeRoute(
  userLat: number,
  userLon: number,
  fires: FireData[],
  weather: { wind_speed_kmh: number; wind_dir_deg: number },
): Promise<RoutesResult> {
  if (fires.length === 0) return { routes: [], naturalRoutes: null }

  const escapeBearing = computeEscapeBearing(userLat, userLon, fires, weather.wind_dir_deg)

  // Three candidate destinations at 1km, 3km, 8km along escape bearing
  const destinations = [1, 3, 8].map((d) => {
    const pt = destinationPointLocal(userLat, userLon, escapeBearing, d)
    return { name: `Escape-${d}km`, lat: pt.lat, lon: pt.lon }
  })

  const apiKey = process.env.OPENROUTE_API_KEY
  const avoidPolygon = buildAvoidPolygon(fires)
  const routes: RouteData[] = []
  const bearingMap = new Map<string, number>()

  if (apiKey) {
    for (const dest of destinations) {
      try {
        const route = await fetchOrsRoute(apiKey, userLon, userLat, dest.lon, dest.lat, avoidPolygon)
        if (route) {
          routes.push({ ...route, id: dest.name })
          const coords = route.geometry.coordinates
          if (coords.length >= 2) {
            bearingMap.set(dest.name, initialBearing(
              coords[0][1], coords[0][0],
              coords[1][1], coords[1][0],
            ))
          }
        }
      } catch (err) {
        console.warn(`[agent-routes/citizen] route to ${dest.name} failed:`, err)
      }
    }
  }

  const sortedByDist = [...fires].sort(
    (a, b) =>
      haversineKmLocal(userLat, userLon, a.lat, a.lon) -
      haversineKmLocal(userLat, userLon, b.lat, b.lon),
  )
  const nearestFireDistKm = haversineKmLocal(userLat, userLon, sortedByDist[0].lat, sortedByDist[0].lon)

  let naturalRoutes: NaturalRoutes | null = null
  try {
    naturalRoutes = await runA5CitizenRoutes(
      userLat, userLon, nearestFireDistKm, escapeBearing, routes, weather,
    )
    if (naturalRoutes) {
      for (const ruta of naturalRoutes.rutas) {
        const bearing = bearingMap.get(ruta.destino) ?? bearingMap.get(ruta.nombre)
        if (bearing !== undefined) ruta.bearing_deg = bearing
      }
    }
  } catch (err) {
    console.warn('[agent-routes/citizen] A5 LLM failed, returning ORS routes only:', err)
  }

  return { routes, naturalRoutes }
}
```

- [ ] **Step 3A.6: Run tests — they should pass**

```bash
cd backend && npm test -- --filter agent-routes 2>&1 | tail -20
```

Expected: all tests PASS including the new `computeEscapeBearing` tests.

### 3B — Register POST /analyze/citizen endpoint in index.ts

- [ ] **Step 3B.1: Add citizen route types and import**

In `backend/packages/agent-routes/src/index.ts`, update the import line:

```ts
import { calculateEvacuationRoutes, calculateCitizenEscapeRoute } from './analyze'
```

- [ ] **Step 3B.2: Add the citizen endpoint**

In `index.ts`, append after the existing `/analyze` endpoint and before the `/health` endpoint:

```ts
app.post('/analyze/citizen', async (req, res) => {
  const body = req.body as {
    userLat?: unknown
    userLon?: unknown
    fires?: unknown
    weather?: unknown
  }

  const userLat = typeof body.userLat === 'number' && isFinite(body.userLat) ? body.userLat : null
  const userLon = typeof body.userLon === 'number' && isFinite(body.userLon) ? body.userLon : null
  const fires = Array.isArray(body.fires) ? body.fires : []
  const weather = (body.weather && typeof body.weather === 'object' && !Array.isArray(body.weather))
    ? body.weather as { wind_speed_kmh: number; wind_dir_deg: number }
    : { wind_speed_kmh: 0, wind_dir_deg: 0 }

  if (userLat === null || userLon === null) {
    res.status(400).json({ success: false, data: null, error: 'userLat and userLon required' })
    return
  }

  try {
    const data = await calculateCitizenEscapeRoute(userLat, userLon, fires, weather)
    res.json({ success: true, data } satisfies AgentResponse<typeof data>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<NaturalRoutes>)
  }
})
```

- [ ] **Step 3B.3: Verify endpoint compiles**

```bash
cd backend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3B.4: Commit**

```bash
git add backend/packages/agent-routes/src/analyze.ts backend/packages/agent-routes/src/analyze.test.ts backend/packages/agent-routes/src/index.ts
git commit -m "feat(agent-routes): add /analyze/citizen endpoint with escape bearing from user GPS"
```

---

## Task 4: Backend Relay + Frontend Wiring

**Files:**
- Modify: `backend/packages/backend/src/routes/index.ts`
- Create: `frontend/app/api/citizen-routes/route.ts`
- Modify: `frontend/hooks/use-socket.ts`
- Modify: `frontend/contexts/sentinel-context.tsx`
- Modify: `frontend/components/citizen/citizen-app.tsx`

### 4A — Backend relay endpoint POST /api/citizen-routes

- [ ] **Step 4A.1: Add /api/citizen-routes to routes/index.ts**

In `backend/packages/backend/src/routes/index.ts`, add after the `POST /api/trigger/citizen-init` endpoint (after line 237, before the `POST /api/trigger/citizen` block):

```ts
  // POST /api/citizen-routes — calls agent-routes/analyze/citizen with user GPS + last fires.
  // Returns immediately (202) and emits `citizen-routes` to the requesting socket.
  app.post('/api/citizen-routes', triggerLimiter, async (req, res) => {
    const body = req.body as { userLat?: unknown; userLon?: unknown; socketId?: unknown }
    const userLat = typeof body.userLat === 'number' && isFinite(body.userLat) ? body.userLat : undefined
    const userLon = typeof body.userLon === 'number' && isFinite(body.userLon) ? body.userLon : undefined
    const socketId = typeof body.socketId === 'string' && body.socketId.length > 0 ? body.socketId : undefined

    if (userLat === undefined || userLon === undefined) {
      res.status(400).json({ ok: false, error: 'userLat and userLon required' })
      return
    }

    res.status(202).json({ ok: true, accepted: true })

    const agentRoutesUrl = process.env.AGENT_ROUTES_URL
    if (!agentRoutesUrl) {
      console.warn('[citizen-routes] AGENT_ROUTES_URL not set')
      return
    }

    const last = getLastUpdate()
    const fires = last?.fires ?? []
    const weather = last?.weather ?? { speed: 0, deg: 0 }

    try {
      const response = await fetch(`${agentRoutesUrl}/analyze/citizen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLat,
          userLon,
          fires,
          weather: {
            wind_speed_kmh: Math.round((weather.speed ?? 0) * 3.6),
            wind_dir_deg: weather.deg ?? 0,
          },
        }),
      })
      const data = await response.json() as { success: boolean; data: unknown }
      if (data.success) {
        const emitter = socketId ? io.to(socketId) : io
        emitter.emit('citizen-routes', data.data)
      }
    } catch (err) {
      console.error('[citizen-routes] agent-routes call failed:', err instanceof Error ? err.message : err)
    }
  })
```

- [ ] **Step 4A.2: Verify build**

```bash
cd backend && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

### 4B — Next.js proxy route for /api/citizen-routes

- [ ] **Step 4B.1: Create frontend/app/api/citizen-routes/route.ts**

```ts
import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND_URL}/api/citizen-routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'backend unreachable' }, { status: 502 })
  }
}
```

### 4C — Add citizenRoutes to use-socket.ts

- [ ] **Step 4C.1: Add citizenRoutes state and socket listener**

In `frontend/hooks/use-socket.ts`, inside `useSocket()`:

1. After the existing state declarations (around line 213), add:

```ts
const [citizenRoutes, setCitizenRoutes] = useState<NaturalRoutes | null>(null)
```

2. Inside the `useEffect`, after the `socket.on("update", ...)` handler, add:

```ts
    socket.on("citizen-routes", (data: { routes: unknown[]; naturalRoutes: NaturalRoutes | null }) => {
      if (data.naturalRoutes) setCitizenRoutes(data.naturalRoutes)
    })
```

3. Update the return statement to include `citizenRoutes`:

```ts
return { sentinelUpdate, status, connected, trigger, triggerCitizen, refresh, citizenRoutes }
```

- [ ] **Step 4C.2: Also call /api/citizen-routes in triggerCitizen**

Replace the `triggerCitizen` function:

```ts
const triggerCitizen = useCallback((lat: number, lon: number) => {
  const socketId = socketRef.current?.id ?? null
  const body: Record<string, unknown> = { lat, lon }
  if (socketId) body.socketId = socketId

  // Kick off the Make.com citizen scenario (fires + weather for user's bbox)
  fetch('/api/trigger/citizen-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => console.error('[triggerCitizen] HTTP trigger failed:', err))

  // In parallel: request personalized escape routes from user's exact GPS position
  if (socketId) {
    fetch('/api/citizen-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userLat: lat, userLon: lon, socketId }),
    }).catch((err) => console.error('[triggerCitizen] citizen-routes failed:', err))
  }
}, [])
```

### 4D — Add citizenRoutes to context and citizen-app

- [ ] **Step 4D.1: Update SentinelContextValue in sentinel-context.tsx**

In `frontend/contexts/sentinel-context.tsx`, update the interface and provider:

```ts
import type { NaturalRoutes } from "@/hooks/use-socket"

interface SentinelContextValue {
  sentinelUpdate: SentinelUpdate | null
  status: SocketStatus
  connected: boolean
  trigger: (lat?: number, lon?: number) => void
  triggerCitizen: (lat: number, lon: number) => void
  refresh: () => void
  citizenRoutes: NaturalRoutes | null
}
```

The `SentinelProvider` passes `value = useSocket()` which now includes `citizenRoutes`, so no further change is needed.

Update `useSentinel` return type by adding `citizenRoutes: NaturalRoutes | null` — TypeScript will infer this automatically from the context value since it's already there.

- [ ] **Step 4D.2: Update citizen-app.tsx to use citizenRoutes in buildScene**

In `citizen-app.tsx`:

1. Update the `buildScene` function signature (top of function, around line 39):

```ts
function buildScene(
  userLoc: { lat: number; lon: number } | null,
  u: SentinelUpdate | null,
  citizenRoutes: NaturalRoutes | null = null,
): CitizenData {
```

2. Inside `buildScene`, update the `backendRoutes` line (around line 68):

```ts
  const backendRoutes = citizenRoutes?.rutas ?? u?.naturalRoutes?.rutas ?? []
```

3. Add `NaturalRoutes` to the import from `use-socket`:

```ts
import type { SentinelUpdate, NaturalRoutes } from '@/hooks/use-socket'
```

4. Update the destructuring of `useSentinel()` and `useMemo`:

```ts
const { sentinelUpdate, connected, triggerCitizen, citizenRoutes } = useSentinel()
const data = useMemo(
  () => buildScene(userLoc, sentinelUpdate, citizenRoutes),
  [userLoc, sentinelUpdate, citizenRoutes],
)
```

- [ ] **Step 4D.3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4D.4: End-to-end manual test**

1. Start the frontend: `cd frontend && pnpm dev`
2. Start the backend: `cd backend && npm run dev`
3. Open http://localhost:3010/dashboard/citizen
4. Click "Activar ubicación GPS" and allow the browser
5. Verify: map is centered on your location at street level (not the whole globe)
6. Verify: if you're testing in an area without real fire data from the socket, the screen shows `ScreenSafe` with "Sin amenaza activa"
7. Verify: after a few seconds, the route card updates (either from socket citizen-routes event or mock fallback)

- [ ] **Step 4D.5: Commit**

```bash
git add \
  backend/packages/backend/src/routes/index.ts \
  frontend/app/api/citizen-routes/route.ts \
  frontend/hooks/use-socket.ts \
  frontend/contexts/sentinel-context.tsx \
  frontend/components/citizen/citizen-app.tsx
git commit -m "feat(citizen): wire citizen-routes endpoint — personalized escape route from user GPS via socket"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Map fix (§3.1) → Task 1
- ✅ Proximity threshold 0.8km (§3.2) → Task 2
- ✅ ScreenSafe component (§3.2) → Task 2B
- ✅ `calculateCitizenEscapeRoute` from user coords (§3.3) → Task 3A
- ✅ POST /analyze/citizen endpoint (§3.3) → Task 3B
- ✅ Backend relay POST /api/citizen-routes (§3.3) → Task 4A
- ✅ citizen-routes socket event in frontend (§3.3) → Task 4C
- ✅ buildScene uses citizenRoutes with priority (§3.3) → Task 4D
- ✅ bearing_deg fix in buildScene (§3.3) → Task 2B.3
- ✅ Demo fallbacks preserved (§7) — mock data used when no socket/routes data available

**Type consistency:**
- `calculateCitizenEscapeRoute` → returns `RoutesResult` → matches `/analyze/citizen` response
- `citizen-routes` socket event carries `RoutesResult` shape `{ routes, naturalRoutes }`
- `buildScene` receives `NaturalRoutes | null` — same type as `NaturalRoutes` in use-socket.ts
- `computeEscapeBearing` is exported (for tests) ✅

**No placeholders:** all steps have complete code. ✅
