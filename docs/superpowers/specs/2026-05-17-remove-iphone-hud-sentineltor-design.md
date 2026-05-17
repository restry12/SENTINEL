# Design Spec: Remove iPhone HUD from Sentinel Tor Prototype

Remove the "fake" iPhone HUD elements (status bar, notch, home indicator) from the Sentinel Tor prototype to provide a cleaner app-focused view, while maintaining the mobile aspect ratio and rounded frame.

## Problem
The current iPhone frame mockup overlaps with the app's header content (logo and alert pill), making it look broken and cluttered. Since it's a web-based prototype, the fake iOS UI elements are often redundant or distracting.

## Proposed Changes

### 1. `frontend/components/sentineltor/ios-frame.tsx`
- Remove `IOSStatusBar` component.
- Remove `IOSGlassPill` component (unused).
- Simplify `IOSDevice` (consider renaming or keeping name for compatibility):
    - Remove the notch `div`.
    - Remove the `IOSStatusBar` inclusion.
    - Remove the home indicator `div`.
    - Keep the outer container with `borderRadius: 48` and the `boxShadow`.
    - Add `paddingTop: 16` to the content container to ensure the app header has some breathing room from the top edge.

### 2. `frontend/components/sentineltor/screens.tsx`
- Increase `Header` padding slightly to ensure it looks balanced in the new frame-less layout.
- Update `Header` to use `padding: '16px 18px 10px'` (up from `0 18px 10px`).

### 3. `frontend/app/sentineltor/page.tsx`
- Ensure the `IOSDevice` wrapper (or its replacement) is correctly sized.
- (Optional) Clean up background elements if they interfere with the new layout, but the current ones seem fine.

## Success Criteria
- The "SENTINEL" header and "ALERTA TORNADO" pill are fully visible and not covered by any notch.
- The mobile "phone" feel is preserved via rounded corners and shadow.
- The layout looks professional and intentional.
