# Sentinel Tor Live Map & HUD Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the iPhone HUD overlap and add a real-time Mapbox radar with GPS location and escape routes to the Sentinel Tor prototype.

**Architecture:** Use `useGeolocation` for live coordinates, a new `SentinelRadarMap` (Mapbox) for geographic visualization, and updated `screens.tsx` to display real-time safety data.

**Tech Stack:** React, Mapbox GL, TypeScript, Geolocation API.

---

### Task 1: HUD Cleanup in IOSDevice

**Files:**
- Modify: `frontend/components/sentineltor/ios-frame.tsx`

- [ ] **Step 1: Strip out fake iPhone elements**

Remove `IOSStatusBar`, `IOSGlassPill`. Simplify `IOSDevice` to a rounded container with 16px top padding.

- [ ] **Step 2: Commit cleanup**

```bash
git add frontend/components/sentineltor/ios-frame.tsx
git commit -m "refactor(sentineltor): remove iphone hud elements and fix padding"
```

### Task 2: Create SentinelRadarMap Component

**Files:**
- Create: `frontend/components/sentineltor/sentinel-radar-map.tsx`

- [ ] **Step 1: Implement Mapbox-based radar map**

Adapt logic from `frontend/components/citizen/sentinel-map.tsx`. Use satellite-streets style. Define tornado swath and shelter markers.

- [ ] **Step 2: Commit new component**

```bash
git add frontend/components/sentineltor/sentinel-radar-map.tsx
git commit -m "feat(sentineltor): add mapbox-based radar map component"
```

### Task 3: Integrate Geolocation in Prototype Page

**Files:**
- Modify: `frontend/app/sentineltor/page.tsx`

- [ ] **Step 1: Use useGeolocation hook and provide data to screens**

```tsx
import { useGeolocation } from '@/hooks/use-geolocation'
// ... inside component ...
const coords = useGeolocation() || { lat: 19.4326, lon: -99.1332 }
// Pass coords to screens
```

- [ ] **Step 2: Commit integration**

```bash
git add frontend/app/sentineltor/page.tsx
git commit -m "feat(sentineltor): integrate live geolocation into prototype"
```

### Task 4: Update Screens with Live Data & Real Map

**Files:**
- Modify: `frontend/components/sentineltor/screens.tsx`

- [ ] **Step 1: Update Header padding and replace Radar with SentinelRadarMap**

Import `SentinelRadarMap`. Update `Header` padding. Pass user coordinates to `SentinelRadarMap`.

- [ ] **Step 2: Calculate real distance to tornado/shelter**

Replace static "12 MIN" and "4.8 KM" with calculated values based on user location vs mock tornado location.

- [ ] **Step 3: Commit final updates**

```bash
git add frontend/components/sentineltor/screens.tsx
git commit -m "feat(sentineltor): finalize screens with live map and real-time data"
```
