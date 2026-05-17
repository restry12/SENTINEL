# Responsive Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all authenticated pages (Dashboard, Air, Tornado, Chat, News) usable on mobile (375px+) without touching desktop layout.

**Architecture:** Mobile-first component wrappers. `AuthGuard` already injects `BottomNav` into all auth'd pages. `TopBar` gets a mobile-only slim mode. Air/Tornado panels become `hidden md:block` on mobile with a `MobileDrawer` FAB. Height-constrained pages use `h-[calc(100dvh-4rem)] md:h-dvh` on mobile to avoid BottomNav overlap.

**Tech Stack:** Next.js 14, React, Tailwind v4, shadcn/ui (Sheet already available), lucide-react

---

## File Map

| Action | File |
|--------|------|
| Create | `frontend/components/ui/mobile-drawer.tsx` |
| Modify | `frontend/components/ui/bottom-nav.tsx` |
| Modify | `frontend/components/dashboard/top-bar.tsx` |
| Modify | `frontend/app/air/page.tsx` |
| Modify | `frontend/app/tornado/page.tsx` |
| Modify | `frontend/components/chat/chat-page.tsx` |
| Modify | `frontend/app/news/page.tsx` |
| Modify | `frontend/app/dashboard/page.tsx` |

---

## Task 1: Create MobileDrawer component

**Files:**
- Create: `frontend/components/ui/mobile-drawer.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/components/ui/mobile-drawer.tsx
"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Layers } from "lucide-react"

interface MobileDrawerProps {
  title: string
  triggerLabel?: string
  children: React.ReactNode
}

export function MobileDrawer({ title, triggerLabel = "Ver datos", children }: MobileDrawerProps) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button
            className="fixed bottom-20 left-4 z-[1500] flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0f172a]/95 backdrop-blur-xl border border-white/20 shadow-2xl text-white text-[10px] font-black tracking-widest uppercase"
          >
            <Layers className="w-4 h-4 text-blue" />
            {triggerLabel}
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-[80vh] bg-[#0a0b0e] border-white/10 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-[11px] font-black tracking-[0.2em] uppercase text-text-muted">
              {title}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 pb-8 flex flex-col gap-3">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ui/mobile-drawer.tsx
git commit -m "feat(mobile): add MobileDrawer sheet component"
```

---

## Task 2: Update BottomNav to 6 tabs

**Files:**
- Modify: `frontend/components/ui/bottom-nav.tsx`

The current BottomNav has 4 tabs: Dashboard, Aire, Noticias, Ciudadano.
Add Tornado and Chat. Scale icons/labels down to fit 6.

- [ ] **Step 1: Replace BottomNav content**

Replace the entire file with:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Wind, Tornado, MessageCircle, Newspaper, UserCircle } from "lucide-react"

const tabs = [
  { href: "/dashboard",         label: "Dashboard",  Icon: LayoutGrid },
  { href: "/air",               label: "Aire",        Icon: Wind },
  { href: "/tornado",           label: "Tornado",     Icon: Tornado },
  { href: "/chat",              label: "AI",          Icon: MessageCircle },
  { href: "/news",              label: "Noticias",    Icon: Newspaper },
  { href: "/dashboard/citizen", label: "Ciudadano",   Icon: UserCircle },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] flex border-t border-white/10 bg-background/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
          >
            <Icon
              className={`w-4 h-4 transition-colors ${
                active
                  ? "text-orange drop-shadow-[0_0_6px_rgba(255,126,21,0.6)]"
                  : "text-text-muted"
              }`}
            />
            <span
              className={`text-[8px] font-bold tracking-wider uppercase transition-colors ${
                active ? "text-orange" : "text-text-muted"
              }`}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Verify lucide-react exports Tornado icon**

```bash
grep -r "Tornado" /Users/boxs/hackaindies/frontend/node_modules/lucide-react/dist/lucide-react.js | head -1
```

If not found, replace `Tornado` icon with `CloudLightning` and update the import.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/bottom-nav.tsx
git commit -m "feat(mobile): expand BottomNav to 6 tabs"
```

---

## Task 3: Update TopBar for mobile

**Files:**
- Modify: `frontend/components/dashboard/top-bar.tsx`

On mobile (`< md`): show only logo + status dot + compact time. Hide nav links and telemetry section.

- [ ] **Step 1: Edit top-bar.tsx**

Find the `<header>` opening tag and its immediate children. Make these changes:

**Change 1 — header padding and height:**
```tsx
// BEFORE:
<header className="h-[72px] px-8 border-b border-white/10 bg-[#0f172a] backdrop-blur-2xl flex items-center justify-between gap-8 relative">

// AFTER:
<header className="h-[56px] md:h-[72px] px-4 md:px-8 border-b border-white/10 bg-[#0f172a] backdrop-blur-2xl flex items-center justify-between gap-4 md:gap-8 relative">
```

**Change 2 — Brand section (remove min-w, hide subtitle on mobile):**
```tsx
// BEFORE:
<div className="flex items-center gap-4 min-w-[250px]">

// AFTER:
<div className="flex items-center gap-2 md:gap-4 shrink-0">
```

Inside brand section, hide subtitle on mobile:
```tsx
// BEFORE:
<div className="flex flex-col">
  <h1 className="text-xl font-black tracking-[0.25em] text-white leading-none">SENTINEL</h1>
  <p className="text-[9px] font-bold tracking-[0.3em] text-text-muted mt-1.5 uppercase opacity-70">{tx.brandSub}</p>
</div>

// AFTER:
<div className="flex flex-col">
  <h1 className="text-base md:text-xl font-black tracking-[0.25em] text-white leading-none">SENTINEL</h1>
  <p className="hidden md:block text-[9px] font-bold tracking-[0.3em] text-text-muted mt-1.5 uppercase opacity-70">{tx.brandSub}</p>
</div>
```

Also shrink the logo on mobile:
```tsx
// BEFORE:
className="h-[48px] w-auto relative z-10"

// AFTER:
className="h-[36px] md:h-[48px] w-auto relative z-10"
```

**Change 3 — Hide nav+status section on mobile:**
```tsx
// BEFORE:
<div className="flex-1 flex items-center gap-6">

// AFTER:
<div className="hidden md:flex flex-1 items-center gap-6">
```

**Change 4 — Hide telemetry section on mobile:**
```tsx
// BEFORE:
<div className="flex items-center justify-end gap-4 min-w-[250px]">

// AFTER:
<div className="hidden md:flex items-center justify-end gap-4 min-w-[250px]">
```

**Change 5 — Add mobile status block (after the telemetry div, before closing `</header>`):**
```tsx
{/* Mobile: status dot + time */}
<div className="flex md:hidden items-center gap-3 ml-auto">
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
    <div className={`w-2 h-2 rounded-full ${connected ? (riskLevel === 'critical' ? 'bg-red' : 'bg-green') : 'bg-text-muted'} ${connected ? 'animate-pulse' : ''}`} />
    <span className={`text-[10px] font-black tracking-widest uppercase ${statusColor}`}>
      {statusLabel}
    </span>
  </div>
  <span className="text-[10px] font-mono text-text-muted">{time || "00:00:00"}</span>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/top-bar.tsx
git commit -m "feat(mobile): responsive TopBar - slim on mobile, full on desktop"
```

---

## Task 4: Fix Air page mobile layout

**Files:**
- Modify: `frontend/app/air/page.tsx`

On mobile: hide the absolute-positioned side panels, show MobileDrawer FAB that opens both panels stacked in a sheet.

- [ ] **Step 1: Add MobileDrawer import**

At top of `frontend/app/air/page.tsx`, add:
```tsx
import { MobileDrawer } from "@/components/ui/mobile-drawer"
```

- [ ] **Step 2: Fix outer container height for mobile**

```tsx
// BEFORE:
<div className="h-screen w-screen flex flex-col bg-background overflow-hidden">

// AFTER:
<div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
```

- [ ] **Step 3: Wrap LEFT PANEL in hidden md:block**

```tsx
// BEFORE:
{/* ── LEFT PANEL ── */}
<div className="absolute top-6 left-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">

// AFTER:
{/* ── LEFT PANEL ── */}
<div className="hidden md:block absolute top-6 left-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
```

- [ ] **Step 4: Wrap RIGHT PANEL in hidden md:block**

```tsx
// BEFORE:
{/* ── RIGHT PANEL ── */}
<div className="absolute top-6 right-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">

// AFTER:
{/* ── RIGHT PANEL ── */}
<div className="hidden md:block absolute top-6 right-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
```

- [ ] **Step 5: Wrap floating BACK BUTTON in hidden md:block**

```tsx
// BEFORE:
{selectedCountry && (
  <button
    onClick={handleBack}
    className="absolute pointer-events-auto z-40"

// AFTER:
{selectedCountry && (
  <button
    onClick={handleBack}
    className="hidden md:flex absolute pointer-events-auto z-40"
```

- [ ] **Step 6: Add MobileDrawer after the legend div (inside `<main>`)**

After the `{/* ── LEGEND ── */}` block and before `</main>`, add:

```tsx
{/* ── MOBILE DRAWER ── */}
<MobileDrawer title="Calidad del Aire" triggerLabel="Ver datos">
  <AirLeftPanel
    selectedCountry={panelCountry}
    countryData={panelCountryData}
    selectedCity={selectedCity}
    citiesInCountry={citiesInCountry}
    onCitySelect={handleCitySelect}
    onBackToCountry={() => setSelectedCity(null)}
  />
  {(selectedCountry || selectedCity) && (
    <button
      onClick={handleBack}
      className="self-start flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors px-3 py-1.5 rounded border border-white/10"
    >
      {selectedCity ? "← País" : "← Mundo"}
    </button>
  )}
  <AirRightPanel
    selectedCountry={panelCountry}
    countryData={panelCountryData}
    selectedCity={selectedCity}
    allCountryData={countryData?.countries ?? {}}
    globalAvg={countryData?.globalAvg ?? globalStats.avg}
    globalMax={countryData?.globalMax ?? globalStats.max}
    globalMin={countryData?.globalMin ?? globalStats.min}
  />
</MobileDrawer>
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/air/page.tsx
git commit -m "feat(mobile): Air page - panels hidden on mobile, accessible via drawer"
```

---

## Task 5: Fix Tornado page mobile layout

**Files:**
- Modify: `frontend/app/tornado/page.tsx`

Same pattern as Air. TornadoLeftPanel has its own `absolute top-6 left-6` positioning built into the component, so wrap renders in `hidden md:block`.

- [ ] **Step 1: Add MobileDrawer import**

```tsx
import { MobileDrawer } from "@/components/ui/mobile-drawer"
```

- [ ] **Step 2: Fix outer container height for mobile**

```tsx
// BEFORE:
<div className="h-screen w-screen flex flex-col bg-background overflow-hidden">

// AFTER:
<div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
```

- [ ] **Step 3: Wrap TornadoLeftPanel in hidden md:block**

```tsx
// BEFORE:
{/* Left panel */}
<TornadoLeftPanel
  cells={TORNADO_CELLS}
  selectedCell={selectedCell}
  onCellSelect={handleCellSelect}
  onBack={handleBack}
/>

// AFTER:
{/* Left panel */}
<div className="hidden md:block">
  <TornadoLeftPanel
    cells={TORNADO_CELLS}
    selectedCell={selectedCell}
    onCellSelect={handleCellSelect}
    onBack={handleBack}
  />
</div>
```

- [ ] **Step 4: Wrap TornadoRightPanel in hidden md:block**

```tsx
// BEFORE:
{/* Right panel */}
<TornadoRightPanel selectedCell={selectedCell} />

// AFTER:
{/* Right panel */}
<div className="hidden md:block">
  <TornadoRightPanel selectedCell={selectedCell} />
</div>
```

- [ ] **Step 5: Add MobileDrawer after the EF Scale Legend div (inside `<main>`)**

After the `{/* EF Scale Legend */}` block and before `</main>`, add:

```tsx
{/* ── MOBILE DRAWER ── */}
<MobileDrawer title="Monitoreo de Tornados" triggerLabel="Ver celdas">
  <TornadoLeftPanel
    cells={TORNADO_CELLS}
    selectedCell={selectedCell}
    onCellSelect={handleCellSelect}
    onBack={handleBack}
  />
  <TornadoRightPanel selectedCell={selectedCell} />
</MobileDrawer>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/app/tornado/page.tsx
git commit -m "feat(mobile): Tornado page - panels hidden on mobile, accessible via drawer"
```

---

## Task 6: Fix Chat page mobile padding

**Files:**
- Modify: `frontend/components/chat/chat-page.tsx`

The outer `h-screen overflow-hidden` clips content. On mobile, BottomNav is `fixed bottom-0 ~56px`. Change outer container height so ChatInput isn't hidden behind BottomNav.

- [ ] **Step 1: Update outer container**

```tsx
// BEFORE (line ~153):
<div className="h-screen flex flex-col bg-background overflow-hidden">

// AFTER:
<div className="h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-background overflow-hidden">
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/chat/chat-page.tsx
git commit -m "feat(mobile): Chat page - fix height so input clears BottomNav"
```

---

## Task 7: Fix News and Dashboard mobile padding

**Files:**
- Modify: `frontend/app/news/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

**News:** Same `h-screen overflow-hidden` pattern. Fix height.

**Dashboard:** `MetricCards` mobile overlay sits at `bottom-6` — needs to be above BottomNav.

- [ ] **Step 1: Fix News outer container**

In `frontend/app/news/page.tsx`, find (around line 670):
```tsx
// BEFORE:
<div className="h-screen flex flex-col bg-[#04050a] text-foreground overflow-hidden">

// AFTER:
<div className="h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-[#04050a] text-foreground overflow-hidden">
```

- [ ] **Step 2: Fix Dashboard MetricCards overlay position**

In `frontend/app/dashboard/page.tsx`, find the mobile MetricCards overlay:
```tsx
// BEFORE:
<div className="md:hidden absolute bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-500">

// AFTER:
<div className="md:hidden absolute bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-500">
```

`bottom-20` = 80px, clears BottomNav (~56px) + gap.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/news/page.tsx frontend/app/dashboard/page.tsx
git commit -m "feat(mobile): fix News height and Dashboard metric card position on mobile"
```

---

## Verification Checklist

After all tasks, open browser DevTools → toggle mobile (375px width, iPhone SE):

- [ ] TopBar shows: logo + status dot + time only. No nav overflow.
- [ ] BottomNav shows 6 tabs: Dashboard, Aire, Tornado, AI, Noticias, Ciudadano.
- [ ] Air page: map fills screen, FAB button visible, drawer opens with left+right panel content.
- [ ] Tornado page: map fills screen, FAB button visible, drawer opens with cell list.
- [ ] Chat page: messages scroll, ChatInput visible above BottomNav.
- [ ] News page: content scrollable, not clipped behind BottomNav.
- [ ] Dashboard: MetricCards overlay visible above BottomNav when no fire selected.
- [ ] Desktop (1280px): zero visual regressions on all pages.
