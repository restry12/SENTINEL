# Responsive Overhaul Design

**Date:** 2026-05-17  
**Branch:** test-front-andy  
**Scope:** All non-login pages — Dashboard, Air, Tornado, Chat, News, Citizen

## Problem

Login page works on mobile. All other pages broken: TopBar overflows, side panels cover the full screen, BottomNav missing from some pages, content clipped behind BottomNav.

## Approach

Mobile-first component wrappers (Option A). Create reusable `<MobileDrawer>` and update `TopBar` for mobile. Desktop layout unchanged. Mobile gets drawer-based panel UX + slim topbar + expanded BottomNav.

## New Components

### `components/ui/mobile-drawer.tsx`
- Uses existing shadcn `<Sheet>` (bottom position)
- Props: `trigger: ReactNode`, `title: string`, `children: ReactNode`
- Trigger renders as FAB over the map, above BottomNav (`bottom-20 left-4`)
- Invisible on desktop (`md:hidden`)

## Modified Components

### `components/dashboard/top-bar.tsx`
- Brand section (logo): always visible, `shrink-0`, remove `min-w-[250px]`
- Nav links section: `hidden md:flex`
- Status + time + lang section: `hidden md:flex`
- Add `md:hidden` block: status dot (color matches risk level) + compact time
- Padding: `px-4 md:px-8`

### `components/ui/bottom-nav.tsx`
- Expand from 4 to 6 tabs: Dashboard, Air, Tornado, Chat, News, Citizen
- Icon size: `w-4 h-4` (down from `w-5 h-5`)
- Label size: `text-[8px]` (down from `text-[9px]`)

## Per-Page Changes

| Page | File | Change |
|------|------|--------|
| Dashboard | `app/dashboard/page.tsx` | Verify `pb-16 md:pb-0` on content, panels clear BottomNav |
| Air | `app/air/page.tsx` | Hide absolute panels on mobile (`hidden md:block`), add `<MobileDrawer>` with combined left+right panel content |
| Tornado | `app/tornado/page.tsx` | Same pattern as Air |
| Chat | `components/chat/chat-page.tsx` | Add `pb-16 md:pb-0` to scroll container |
| News | `app/news/page.tsx` | Audit layout, add `pb-16 md:pb-0`, fix overflow |

## Breakpoints

Using Tailwind default: `md = 768px`. Mobile = below 768px.

## Constraints

- Desktop layout: zero visual changes
- BottomNav already has `md:hidden` — stays mobile-only
- All pages under `<AuthGuard>` — no changes to auth flow
- Tailwind v4 (CSS-based config, no `tailwind.config.ts`)

## Success Criteria

- All 6 pages usable on 375px wide screen (iPhone SE)
- TopBar fits without overflow on mobile
- Panels accessible via drawer on Air/Tornado pages
- No content clipped behind BottomNav
- Desktop: no visual regressions
