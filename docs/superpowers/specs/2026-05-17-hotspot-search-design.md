# Hotspot Search — Design Spec
**Date:** 2026-05-17  
**Status:** Approved

---

## Summary

Add a "TOP FOCOS" search button to the dashboard Top Bar. Clicking it opens a dropdown showing the top 10 hotspots sorted by FRP (Fire Radiative Power) descending, plus a text input to search any fire by ID (e.g. `FIRE-120`). Clicking any result flies the map to that fire, opens its popup, and sets it as the selected fire.

---

## Architecture

### New file
**`frontend/components/dashboard/hotspot-search.tsx`**  
Self-contained React component. Reads `sentinelUpdate.fires` from `useSentinel()`, sorts by FRP descending, and exposes a button + dropdown UI. On fire selection, calls `selectFireRef.current(index, fires)` — a callback registered by `MapboxPanel`.

### Modified files

**`frontend/contexts/fire-selection-context.tsx`**  
Add `selectFireRef: React.MutableRefObject<((index: number, fires: FireData[]) => void) | null>` to the context value. Using a ref (not state) avoids re-renders since the action (`flyTo`, popup) is imperative, not declarative.

**`frontend/components/dashboard/mapbox-panel.tsx`**  
Extract the existing click-handler logic into a named function `openFire(fireData, index)`. After fires load, register `selectFireRef.current = (idx, fires) => openFire(fires[idx], idx)`. The existing map click handler calls `openFire` unchanged.

**`frontend/components/dashboard/top-bar.tsx`**  
Add `<HotspotSearch />` between the "Analizar" button and the fire-count chip. No other changes.

---

## UI Behavior

- **Closed state:** button labeled `🔍 TOP FOCOS` styled consistently with the "Analizar" button (orange border, subtle background). Disabled when no data.
- **Open state:** dropdown appears below the button. The SENTINEL logo, brand name, and all other topbar elements remain fully visible and unaffected.
- **Dropdown contents:**
  - Header label: `Top Focos · Ordenado por FRP`
  - Text input: placeholder `Buscar por ID (ej: FIRE-120)…` — filters the full fires array in real time by matching the typed string against fire IDs
  - List: top 10 fires sorted by FRP desc. Each row shows:
    - Colored dot (🔴 critical ≥300 MW, 🟠 high ≥100 MW, 🟡 moderate <100 MW)
    - Fire ID (`FIRE-001`)
    - Coordinates (`-38.281° / -71.902°`)
    - FRP value (`824 MW`)
  - Footer: `+ N focos más • click para volar al foco`
- **Click outside** → closes dropdown (`mousedown` listener on `document`).
- **Click a fire row** → `flyTo(lat, lon, zoom ≥ 11)` + open popup + `setSelectedFire`.

---

## Fire ID Convention

Fire IDs are assigned positionally: `FIRE-${String(i + 1).padStart(3, '0')}` where `i` is the index in `sentinelUpdate.fires[]`. Both `HotspotSearch` and `MapboxPanel` use this same formula, ensuring consistent IDs across the UI.

Searching `FIRE-120` resolves to index 119 of the fires array.

---

## Out of Scope

- No sorting by other fields (brightness, AQI, distance).
- No keyboard navigation within the dropdown.
- No persistence of open/close state across page navigations.
- No changes to the map click handler, left panel, right panel, or language context.
- No new npm dependencies.
