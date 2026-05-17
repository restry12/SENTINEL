# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all authenticated pages responsive on mobile with a native bottom tab bar replacing the desktop nav.

**Architecture:** New `BottomNav` component renders inside `AuthGuard` (except on citizen page which goes fullscreen on mobile). `TopBar` gets a compact mobile-only header. Each page gets `pb-16 md:pb-0` to clear the bottom nav.

**Tech Stack:** Next.js App Router, Tailwind CSS, lucide-react

---

### Task 1: Create BottomNav component

**Files:**
- Create: `frontend/components/ui/bottom-nav.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Wind, Newspaper, UserCircle } from "lucide-react"

const tabs = [
  { href: "/dashboard",          label: "Dashboard",  Icon: LayoutGrid },
  { href: "/air",                label: "Aire",        Icon: Wind },
  { href: "/news",               label: "Noticias",    Icon: Newspaper },
  { href: "/dashboard/citizen",  label: "Ciudadano",   Icon: UserCircle },
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
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors"
          >
            <Icon
              className={`w-5 h-5 transition-colors ${
                active
                  ? "text-orange drop-shadow-[0_0_6px_rgba(255,126,21,0.6)]"
                  : "text-text-muted"
              }`}
            />
            <span
              className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${
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

- [ ] **Step 2: Commit**

```bash
cd frontend && git add components/ui/bottom-nav.tsx
git commit -m "feat(mobile): add BottomNav component with 4 tabs"
```

---

### Task 2: Add BottomNav to AuthGuard

**Files:**
- Modify: `frontend/components/auth-guard.tsx`

- [ ] **Step 1: Update AuthGuard to render BottomNav (hidden on citizen page)**

Replace the entire file content:

```tsx
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { BottomNav } from "@/components/ui/bottom-nav"

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("sentinel_token")
    if (!token) {
      router.replace("/login")
    } else {
      setAuthorized(true)
    }
  }, [router])

  if (!authorized) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-text-muted font-mono text-xs tracking-widest uppercase">
        Verificando acceso…
      </div>
    )
  }

  const isCitizen = pathname === "/dashboard/citizen"

  return (
    <>
      {children}
      {!isCitizen && <BottomNav />}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/auth-guard.tsx
git commit -m "feat(mobile): render BottomNav in AuthGuard on authenticated pages"
```

---

### Task 3: Make TopBar responsive

**Files:**
- Modify: `frontend/components/dashboard/top-bar.tsx`

- [ ] **Step 1: Replace the `<header>` block with mobile + desktop variants**

The current single `<header>` (line 41) becomes two sibling elements: a mobile header and the existing desktop header.

Replace from line 41 (`<header className=...`) through the closing `</header>` (line 111) with:

```tsx
      {/* Mobile header */}
      <header className="md:hidden h-12 px-4 border-b border-white/5 bg-[#080c14/90] backdrop-blur-xl flex items-center justify-between gap-3">
        <img
          src="/sentinel-logo.png"
          alt="SENTINEL"
          className="h-8 w-auto object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.25)]"
        />
        <div className={`px-3 py-1.5 rounded-full border border-red/40 bg-[linear-gradient(180deg,rgba(255,51,51,0.15),rgba(255,51,51,0.05))] ${statusColor} flex items-center gap-2`}>
          <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(255,51,51,1)] ${connected ? "bg-red animate-pulse" : "bg-text-muted"}`} />
          <span className="text-[10px] font-black tracking-[0.2em] uppercase whitespace-nowrap">{statusLabel}</span>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-1 px-2 py-1.5 bg-surface border border-border-2 rounded-lg text-[10px] font-black tracking-widest text-foreground hover:border-blue/50 transition-all"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'es' ? 'ES' : 'EN'}</span>
        </button>
      </header>

      {/* Desktop header */}
      <header className="hidden md:flex h-[64px] px-6 border-b border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_70%)] bg-[#080c14/90] backdrop-blur-xl items-center justify-between gap-4">
        {/* Brand */}
        <div className="w-80 flex items-center gap-3">
          <img
            src="/sentinel-logo.png"
            alt="SENTINEL"
            className="h-[42px] w-auto object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.25)]"
          />
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="text-[15px] font-black tracking-[0.2em] text-white uppercase drop-shadow-sm">SENTINEL</span>
            <span className="text-[9px] font-bold tracking-[0.25em] text-text-muted uppercase">{tx.brandSub}</span>
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <nav className="flex items-center gap-1 p-1 rounded-lg border border-white/5 bg-surface/40 backdrop-blur-md">
            {([
              { href: '/dashboard',         label: tx.navDashboard },
              { href: '/air',               label: tx.navAir },
              { href: '/news',              label: tx.navNews },
              { href: '/dashboard/citizen', label: 'Ciudadano' },
            ] as const).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase transition-all duration-200 ${
                  pathname === href
                    ? 'bg-orange/15 text-orange border border-orange/30 shadow-[0_0_12px_rgba(255,126,21,0.15)]'
                    : 'text-text-muted hover:text-foreground hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className={`px-4 py-2 rounded-full border border-red/40 bg-[linear-gradient(180deg,rgba(255,51,51,0.15),rgba(255,51,51,0.05))] ${statusColor} flex items-center gap-3 shadow-[0_10px_30px_-10px_rgba(255,51,51,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in zoom-in duration-500`}>
            <div className={`w-2 h-2 rounded-full shadow-[0_0_12px_rgba(255,51,51,1)] ${connected ? "bg-red animate-pulse" : "bg-text-muted"}`} />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase whitespace-nowrap">{statusLabel}</span>
          </div>

          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-surface/60 border border-white/5 rounded-lg text-[11px] font-bold tracking-[0.15em] text-text-dim backdrop-blur-md">
            <span>{tx.hotspots}</span>
            <span className="text-orange-soft font-mono text-base leading-none num drop-shadow-[0_0_8px_rgba(255,174,66,0.4)]">{fireCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Right */}
        <div className="w-80 flex items-center justify-end gap-3">
          <div className="hidden xl:flex items-center gap-2.5 px-3 py-2 bg-green/5 border border-green/20 rounded-lg text-[11px] font-bold tracking-[0.15em] text-green-soft shadow-lg shadow-green/5">
            <Activity className="w-3.5 h-3.5" />
            <span>{tx.operational}</span>
          </div>

          <div className="px-3 py-2 bg-surface/60 border border-white/5 rounded-lg flex items-center gap-3 whitespace-nowrap shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-[12px] font-mono font-bold text-foreground tracking-widest uppercase">
              {time || "00:00:00"} <span className="text-text-muted font-normal ml-0.5 text-[10px]">UTC</span>
            </span>
          </div>

          <button
            onClick={toggle}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-2 rounded-lg text-[11px] font-black tracking-[0.1em] text-foreground hover:border-blue/50 hover:bg-blue/5 hover:text-blue transition-all duration-200"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'ES' : 'EN'}</span>
          </button>
        </div>
      </header>
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/top-bar.tsx
git commit -m "feat(mobile): add compact mobile header to TopBar"
```

---

### Task 4: Fix Dashboard page padding

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Add bottom padding to root div so bottom nav doesn't cover content**

In `frontend/app/dashboard/page.tsx` line 17, change:

```tsx
<div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30">
```

to:

```tsx
<div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30 pb-16 md:pb-0">
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "fix(mobile): add bottom padding to dashboard for BottomNav clearance"
```

---

### Task 5: Fix News page padding

**Files:**
- Modify: `frontend/app/news/page.tsx`

- [ ] **Step 1: Add bottom padding to content scroll area and hide timestamp on small screens**

In `frontend/app/news/page.tsx` line 133, change:

```tsx
<div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
```

to:

```tsx
<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full pb-20 md:pb-6">
```

- [ ] **Step 2: Hide "Actualizado" timestamp on small screens to prevent header overflow**

In `frontend/app/news/page.tsx` around line 149, change:

```tsx
          {cachedAt && (
            <span className="text-[10px] text-text-muted font-mono">
              Actualizado: {cachedAt}
            </span>
          )}
```

to:

```tsx
          {cachedAt && (
            <span className="hidden sm:inline text-[10px] text-text-muted font-mono">
              Actualizado: {cachedAt}
            </span>
          )}
```

- [ ] **Step 3: Commit**

```bash
git add app/news/page.tsx
git commit -m "fix(mobile): news page padding and header overflow fix"
```

---

### Task 6: Fix Air page padding and overlay positions

**Files:**
- Modify: `frontend/app/air/page.tsx`

- [ ] **Step 1: Add bottom padding to main element**

In `frontend/app/air/page.tsx` line 154, change:

```tsx
      <main className="flex-1 relative overflow-hidden">
```

to:

```tsx
      <main className="flex-1 relative overflow-hidden pb-16 md:pb-0">
```

- [ ] **Step 2: Commit**

```bash
git add app/air/page.tsx
git commit -m "fix(mobile): add bottom padding to air page for BottomNav clearance"
```

---

### Task 7: Fix Citizen page — fullscreen on mobile

**Files:**
- Modify: `frontend/app/dashboard/citizen/page.tsx`

- [ ] **Step 1: On mobile show CitizenApp fullscreen (no iOS frame), on desktop keep frame**

Replace the file content:

```tsx
"use client"

import { IOSFrame } from "@/components/citizen/ios-frame"
import { CitizenApp } from "@/components/citizen/citizen-app"
import { SentinelProvider } from "@/contexts/sentinel-context"
import { AuthGuard } from "@/components/auth-guard"

export default function CitizenPage() {
  return (
    <AuthGuard>
      <SentinelProvider>
        {/* Desktop: show iOS frame simulation */}
        <div className="hidden md:flex h-screen items-center justify-center bg-background overflow-hidden">
          <div className="scale-90 origin-center">
            <IOSFrame width={402} height={874} dark>
              <CitizenApp />
            </IOSFrame>
          </div>
        </div>
        {/* Mobile: fullscreen native experience */}
        <div className="md:hidden h-screen bg-background overflow-hidden">
          <CitizenApp />
        </div>
      </SentinelProvider>
    </AuthGuard>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/citizen/page.tsx
git commit -m "feat(mobile): citizen page fullscreen on mobile, keep iOS frame on desktop"
```

---

### Task 8: Add viewport meta to layout

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Add viewport export for correct mobile scaling**

After the `export const metadata` block (after line 30), add:

```tsx
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "fix(mobile): add viewport meta for correct mobile scaling"
```

---

### Task 9: Verify on mobile

- [ ] **Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Open Chrome DevTools → Toggle Device Toolbar → iPhone 12 (390px)**

Verify each page:
- `/dashboard` — map fills screen, metric cards scroll horizontally, bottom nav visible
- `/news` — article grid shows 1 column, bottom nav visible, no horizontal scroll  
- `/air` — map fills, INFO drawer opens from bottom, bottom nav visible
- `/dashboard/citizen` — app fills screen fullscreen, no iOS frame
- `/login` — auth card centered, no nav shown

- [ ] **Step 3: Test bottom nav**

Tap each tab, verify active state (orange icon + label) and routing works.

- [ ] **Step 4: Test landscape orientation at 667px width**

Verify desktop layout kicks in (`md:` breakpoint = 768px). On landscape mobile (667px) bottom nav should still show. This is expected — desktop nav only appears at ≥768px.
