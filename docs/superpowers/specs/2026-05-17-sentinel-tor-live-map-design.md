# Design Spec: Sentinel Tor Live Map & HUD Cleanup

Enhance the Sentinel Tor prototype by removing the distracting iPhone HUD and integrating a live Mapbox radar with real-time GPS location and escape routes, similar to the "Citizen" view.

## Problem
1. The fake iPhone HUD overlaps and obscures the app header.
2. The current radar is a static SVG mockup, which lacks the realism and utility of a real geographic map.
3. The user wants the prototype to feel "alive" by using their actual location to calculate safety.

## Proposed Changes

### 1. HUD & Frame Cleanup
- **`frontend/components/sentineltor/ios-frame.tsx`**:
    - Remove `IOSStatusBar`, `IOSGlassPill`, notch, and home indicator.
    - Maintain the rounded `IOSDevice` container and shadow.
    - Add `paddingTop: 16` to the content area.

### 2. Live Map Integration
- **New Component `frontend/components/sentineltor/sentinel-radar-map.tsx`**:
    - Adaptation of `SentinelMap` from the citizen view.
    - Style: Satellite-streets or a custom dark Mapbox style.
    - Tornado Representation:
        - Pulsing core at the tornado's current location.
        - "Swath" polygon showing the projected path/risk area (instead of teardrop propagation).
    - User Location: Blue dot with "YO" label.
    - Escape Route: Green line to the nearest "Shelter" point.

### 3. Live Geolocation
- **`frontend/app/sentineltor/page.tsx`**:
    - Integrate `useGeolocation` hook.
    - Pass live coords to screens and the new map component.
    - If GPS is unavailable, fallback to a sensible default (e.g., current static coordinates).

### 4. Screen Updates (`frontend/components/sentineltor/screens.tsx`)
- **Header**: Increase top padding to `16px`.
- **ScreenLocating**: Use live coordinates to "center" the search.
- **ScreenAlert**: Replace static SVG `Radar` with `SentinelRadarMap`. Calculate real distance/direction to the nearest shelter.

## Success Criteria
- No overlapping iPhone elements.
- Map displays the user's real-world location (if permitted).
- Tornado risk is visualized geographically.
- Prototype feels dynamic and personalized.
