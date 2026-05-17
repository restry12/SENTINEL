# Mobile Responsive Design Spec

**Date:** 2026-05-17  
**Goal:** Make all authenticated pages usable on mobile with native app feel.

---

## Architecture

### New Component: `components/ui/bottom-nav.tsx`
- Fixed bottom bar, `md:hidden` (desktop never sees it)
- 4 tabs with lucide icons + labels
- Active tab: orange icon + orange label + subtle glow
- Inactive tabs: muted icon only
- `pb-safe` / `env(safe-area-inset-bottom)` for iPhone home indicator
- Background: `bg-background/95 backdrop-blur-xl border-t border-white/10`

| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | `LayoutGrid` | `/dashboard` |
| Aire | `Wind` | `/air` |
| Noticias | `Newspaper` | `/news` |
| Ciudadano | `UserCircle` | `/dashboard/citizen` |

### Modified: `components/auth-guard.tsx`
- Render `<BottomNav>` inside AuthGuard wrapper so it appears on all authenticated pages automatically.

### Modified: `components/dashboard/top-bar.tsx`
- Add mobile-only header block (`md:hidden`): logo left + status badge center + lang toggle right. Height 48px.
- Wrap existing full header with `hidden md:flex`.
- No nav links in mobile header — navigation is via BottomNav.

---

## Per-Page Adjustments

### Dashboard (`/dashboard`)
- Root div: add `pb-16 md:pb-0` to clear bottom nav.
- `MetricCards`: verify no horizontal overflow on 375px viewport.
- Mobile layout already exists — no structural changes needed.

### News (`/news`)
- Content scroll area: add `pb-16 md:pb-0`.
- "Actualizado: HH:MM" timestamp: wrap in `hidden sm:inline` to prevent header overflow on small screens.

### Air (`/air`)
- Has its own header (not TopBar) — already has `sm:` breakpoints, no structural change.
- Main `<main>` area: add `pb-16 md:pb-0`.
- `AQIOverlay`, `EnvStatus`, `AQILegend` map overlays: verify they don't overlap bottom nav on small screens. Adjust `bottom-` positioning if needed.

### Ciudadano (`/dashboard/citizen`)
- Outer wrapper: add `pb-16 md:pb-0`.
- ios-frame component: verify centered and not overflowing on 375px.

### Login (`/login`)
- No changes. No AuthGuard, no BottomNav shown.

---

## Viewport Meta
- Ensure `viewport` meta tag exists in `app/layout.tsx` with `width=device-width, initial-scale=1` to prevent desktop zoom on mobile.

---

## Out of Scope
- No changes to desktop layout.
- No changes to Air page's existing mobile sidebar drawer logic.
- No changes to login page visuals.

---

## Success Criteria
- All 4 authenticated pages usable on 375px viewport without horizontal scroll.
- Bottom nav visible and functional on mobile, hidden on desktop.
- TopBar shows compact version on mobile, full version on desktop.
- No content hidden behind bottom nav bar.
