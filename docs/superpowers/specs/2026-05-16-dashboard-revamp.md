# Design Doc: Sentinel Dashboard Revamp (Mapbox + Supabase Integration)

**Date:** 2026-05-16
**Topic:** Replicating the satellite dashboard design with Mapbox and Real-time Supabase data.

## 1. Objective
Transform the current `frontend/app/page.tsx` (Dashboard) into a high-fidelity, satellite-based wildfire monitoring system. It must replicate the visual style of the provided screenshots while integrating real data from Supabase.

## 2. Visual Architecture (Based on Screenshots)
- **Map:** Mapbox Satellite Streets (`v12`).
- **Sidebar Left:** Threat Assessment (Risk Level, Radiative Power, Wind, AQI, SMS Alert log).
- **Sidebar Right:** Situational Intelligence (Social Impact metrics, Safe Routes, Municipal Briefing).
- **Top Bar:** Status indicators (Hotspots count, System status, UTC Clock, Language toggle).

## 3. Technical Stack
- **Map Engine:** Mapbox GL JS (Replacing Leaflet).
- **Data Layer:** Supabase (PostgreSQL + Real-time).
- **Components:** React (Next.js App Router) + Tailwind CSS + Radix UI.
- **Visual Effects:** CSS Animations (Pulse dots, scanlines, glow borders).

## 4. Key Components to Build/Refactor

### 4.1 `MapboxDashboard` (Refactored `MapPanel`)
- Use `mapbox-gl`.
- Global view (Globe projection) for high-level context.
- Zoomed-in view for specific sectors.
- **Markers:** Pulsating orange/red dots for active fires.
- **Layers:** 
    - Orange transparent polygons for "Spread Zones".
    - Solid green lines for "Safe Routes".

### 4.2 `useIncidents` (New Hook)
- Connects to Supabase.
- Fetches active fire records.
- Listens to realtime changes to update the map instantly.

### 4.3 Sidebar Refinements
- **Threat Assessment:** Dynamic risk gauge.
- **Social Impact:** Counters for population at risk and evacuations.
- **SMS Log:** Visual feed of sent alerts.

## 5. Implementation Strategy
1. **Phase 1: Mapbox Integration.** Replace Leaflet with Mapbox in the main dashboard. Set up satellite style and marker system.
2. **Phase 2: Supabase Connection.** Wire up the data fetching. Replace mock fire data with database records.
3. **Phase 3: Visual Polish.** Apply the "Cyberpunk/Military" styling (dark theme, orange/green highlights, specific font-mono usage).

## 6. Testing & Validation
- Verify Mapbox token loading from `.env`.
- Confirm real-time updates by manually editing a row in Supabase.
- Ensure responsive layout (Desktop/Mobile toggle) remains functional.
