# Citizen Mode Improvements — Design Spec

**Date:** 2026-05-17  
**Project:** SENTINEL — hackathon, fire monitoring system  
**Scope:** Three targeted fixes to the citizen mobile experience

---

## 1. Problem Summary

The citizen mode (`/dashboard/citizen`) has three issues to address:

1. **Map loads showing the earth from space** — after GPS is obtained, the map briefly or permanently zooms way out instead of centering on the user.
2. **App activates regardless of proximity** — citizen mode shows a full emergency alert even when the nearest fire is hundreds of km away.
3. **Escape route is generic** — `agent-routes` calculates routes from the fire centroid to hardcoded destinations (Temuco, Angol, Victoria), not from the citizen's actual GPS position.

---

## 2. Root Cause Analysis

### 2.1 Map "Earth from Space" Bug

**File:** `frontend/components/citizen/sentinel-map.tsx`

The map initializes correctly with `center: [user.lon, user.lat]` and `zoom: 15`. However, the `map.on("load")` callback calls `fitBounds()` with all points: user position + escape destination + all fire foci. When `sentinelUpdate` arrives from the socket with real fire data (fires detected in Chile by NASA), those coordinates may be hundreds of km from the user's actual GPS position. `fitBounds()` then zooms out to show all of them — "earth from space."

Additionally, the `useEffect` dependency array includes `[user, fires, route, expansion]` — all objects rebuilt on every `buildScene()` call. Each time `sentinelUpdate` changes, the map is destroyed and recreated with the new (far-away) fire data.

### 2.2 No Proximity Filter

**File:** `frontend/components/citizen/citizen-app.tsx`

After GPS is obtained, `handleLocated` always transitions to `screen = 'alert'` regardless of whether any fire is actually nearby. The `haversineKm` function already exists in the file but isn't used for activation gating.

### 2.3 Routes Computed from Fire Centroid, Not User

**File:** `backend/packages/agent-routes/src/analyze.ts`

`calculateEvacuationRoutes(fires)` uses the average lat/lon of all fires as the routing origin. For a citizen needing to escape, the routing origin must be the citizen's own GPS coordinates, not the fire's location.

---

## 3. Design

### 3.1 Fix: Map Always Centered on User

**Change:** Remove `fitBounds` and the subsequent `setMinZoom`/`setMaxBounds` block. Instead:

- Keep map initialization at `center: [user.lon, user.lat]`, change `zoom: 15 → 14` (slightly wider view gives better situational awareness at neighborhood scale)
- After drawing all layers, set `map.setMinZoom(12)` to prevent accidental zoom-out
- Fire foci and escape route are still drawn; they appear in the viewport if they're within ~2km, which they will be when the citizen threshold (§3.2) is active

**Why zoom 14:** At zoom 14, ~3km diameter is visible — enough to show the nearby fire and escape direction without losing the user's local streets.

**File touched:** `frontend/components/citizen/sentinel-map.tsx` — remove lines 278–294 (fitBounds block), update `zoom: 15` → `zoom: 14`.

---

### 3.2 Fix: Proximity Threshold (~2 km²)

**Activation radius:** 2 km² ≈ circle of radius **0.8 km** (area = π × r²).

**Flow change in `citizen-app.tsx`:**

```
handleLocated(coords)
  ├─ setUserLoc(coords)
  ├─ triggerCitizen(lat, lon)          ← unchanged
  └─ determineScreen(coords)
       ├─ if sentinelUpdate exists AND
       │  nearest fire distance > 0.8km → setScreen('safe')
       └─ otherwise (no update yet OR fire nearby) → setScreen('alert')
```

**Why "otherwise → alert" when no update:** Ensures the demo always works (mock data shows the full alert flow). In production, `triggerCitizen` fires and the backend will eventually push a real `sentinelUpdate`.

**New screen `ScreenSafe`** added to `screens.tsx`:
- Green shield icon
- Title: "Área monitoreada — sin amenaza activa"
- Subtitle: "El foco más cercano está a X.X km" (dynamic, from real data)
- Wind speed + humidity strip (reassuring live data)
- "Mantente informado" button → stays on the screen watching for updates

**State addition in `citizen-app.tsx`:**
```ts
type ScreenState = 'locating' | 'alert' | 'compass' | 'trapped_confirm' | 'trapped_live' | 'safe'
```

Helper:
```ts
function nearestFireKm(
  userLoc: { lat: number; lon: number },
  fires: { lat: number; lon: number }[]
): number {
  if (fires.length === 0) return Infinity
  return Math.min(...fires.map(f => haversineKm(userLoc.lat, userLoc.lon, f.lat, f.lon)))
}
```

---

### 3.3 Feature: Citizen Escape Route Endpoint

**New endpoint in `agent-routes`:**

```
POST /analyze/citizen
```

**Request:**
```ts
{
  userLat: number
  userLon: number
  fires: { lat: number; lon: number; frp: number }[]
  weather: { wind_speed_kmh: number; wind_dir_deg: number }
}
```

**Response:** same `RoutesResult` shape as `/analyze` (`{ routes, naturalRoutes }`)

**Algorithm:**
1. Sort fires by distance to user — take closest up to 5
2. Compute escape bearing: bearing *away* from the nearest fire cluster, adjusted by wind (prefer direction where wind blows fire away from user, i.e., bearing opposite to `wind_dir_deg`)
3. Generate 3 candidate escape destinations at distances 1km, 3km, 8km along the escape bearing
4. Call ORS `driving-car` from `[userLon, userLat]` to each destination, with `avoid_polygon` built around fire hotspots (existing `buildAvoidPolygon`)
5. Call LLM (A5) with citizen-specific context: "User is at [lat,lon], nearest fire is X km away, best escape direction is Y°"
6. Return `naturalRoutes` with user-specific instructions ("Turn right on Calle X, head north toward the plaza")

**Escape bearing formula:**
```
fireClusterBearing = bearing from user to centroid of nearby fires
escapeBearing = (fireClusterBearing + 180) % 360
// Wind correction: if wind blows toward escapeBearing (i.e., wind_dir_deg ≈ escapeBearing ± 45°),
// shift escapeBearing by 90° to cross-wind instead
```

**Backend integration — `orchestrator.ts`:**

When the socket receives `trigger-citizen` with `{ lat, lon }`:
1. Use the fires from `lastUpdate` (already in memory)
2. POST to `AGENT_ROUTES_URL/analyze/citizen` with `{ userLat: lat, userLon: lon, fires, weather }`
3. Emit result via socket event `citizen-routes` to the requesting client only (using `socket.emit`, not `io.emit`)

**Frontend — `use-socket.ts`:**
Listen for `citizen-routes` event and update a separate `citizenRoutes` state field, which `buildScene` uses with priority over `sentinelUpdate.naturalRoutes`.

---

## 4. Data Flow After Changes

```
User taps GPS button
  → navigator.geolocation → { lat, lon }
  → setUserLoc + triggerCitizen(lat, lon)
  → sentinelUpdate already in socket? 
      → nearestFire > 0.8km → ScreenSafe
      → nearestFire ≤ 0.8km → ScreenAlert (map centered on user, zoom 14)
  
  In parallel:
  Backend receives trigger-citizen
    → calls agent-routes/analyze/citizen with user coords + last fires
    → socket emits citizen-routes to this client
    → buildScene updates naturalRoutes with personalized route
    → SentinelMap re-renders with personalized escape line
```

---

## 5. Files Changed

| File | Change |
|---|---|
| `frontend/components/citizen/sentinel-map.tsx` | Remove fitBounds block; change zoom 15→14; add setMinZoom(12) |
| `frontend/components/citizen/citizen-app.tsx` | Add `nearestFireKm`, proximity check in `handleLocated`, new `'safe'` screen state |
| `frontend/components/citizen/screens.tsx` | Add `ScreenSafe` component |
| `frontend/hooks/use-socket.ts` | Listen for `citizen-routes` socket event |
| `backend/packages/agent-routes/src/analyze.ts` | Add `calculateCitizenEscapeRoute(userLat, userLon, fires, weather)` |
| `backend/packages/agent-routes/src/index.ts` | Register `POST /analyze/citizen` endpoint |
| `backend/packages/backend/src/orchestrator.ts` | Handle `trigger-citizen` socket event → call agent-routes/citizen → emit `citizen-routes` |

---

## 6. Out of Scope

- SOS flow (ScreenTrappedConfirm / ScreenTrappedLive) — unchanged
- Compass screen — unchanged
- Make.com webhook for citizen (`MAKE_CITIZEN_WEBHOOK_URL`) — already wired, not touched
- Auth — unchanged
- agent-report — not involved

---

## 7. Demo Reliability

All three changes maintain demo fallbacks:
- **Map:** always shows user-centered view; mock fire data is nearby by design
- **Threshold:** if no socket data yet, goes to `alert` screen (demo shows full flow)
- **Routes:** if `trigger-citizen` backend call fails or is slow, `buildScene` falls back to `CITIZEN_MOCK.naturalRoutes` which has pre-baked instructions

---

## 8. Open Questions (resolved)

| Question | Decision |
|---|---|
| Zoom level for map | 14 (neighborhood, ~3km diameter) |
| Activation radius | 0.8km (≈2 km² circle) |
| Route logic location | Extend agent-routes with new /analyze/citizen endpoint |
| Approach | Incremental (3 independent changes) |
