# Remove iPhone HUD Sentinel Tor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the fake iPhone HUD (notch, status bar, home indicator) from the Sentinel Tor prototype for a cleaner, app-focused view while keeping the mobile frame feel.

**Architecture:** Simplified `IOSDevice` component that only provides a rounded, shadowed container. Adjusted padding in `Header` and `IOSDevice` to compensate for the removed HUD.

**Tech Stack:** React, TypeScript, Tailwind/Inline Styles (matching project style).

---

### Task 1: Clean up IOSDevice component

**Files:**
- Modify: `frontend/components/sentineltor/ios-frame.tsx`

- [ ] **Step 1: Remove unused components and HUD elements**

```tsx
// Remove IOSStatusBar and IOSGlassPill
// Simplify IOSDevice to only the container
export function IOSDevice({ children, width = 402, height = 874, dark = false }: { children: React.ReactNode; width?: number; height?: number; dark?: boolean }) {
  return (
    <div style={{ 
      width, 
      height, 
      borderRadius: 48, 
      overflow: 'hidden', 
      position: 'relative', 
      background: dark ? '#000' : '#F2F2F7', 
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)', 
      fontFamily: '-apple-system, system-ui, sans-serif', 
      WebkitFontSmoothing: 'antialiased' 
    }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 16 }}>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit changes**

```bash
git add frontend/components/sentineltor/ios-frame.tsx
git commit -m "refactor(sentineltor): remove fake iphone hud elements from IOSDevice"
```

### Task 2: Adjust Screen Header Padding

**Files:**
- Modify: `frontend/components/sentineltor/screens.tsx`

- [ ] **Step 1: Update Header component padding**

```tsx
function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
      {/* ... rest of code unchanged ... */}
```

- [ ] **Step 2: Commit changes**

```bash
git add frontend/components/sentineltor/screens.tsx
git commit -m "style(sentineltor): adjust header padding after HUD removal"
```

### Task 3: Clean up Prototype Page

**Files:**
- Modify: `frontend/app/sentineltor/page.tsx`

- [ ] **Step 1: Remove redundant labels and crosshairs**

```tsx
// Remove the crosshairs map and the "SENTINEL TORNADO · PROTOTIPO MÓVIL" div
// keep the state dock
export default function SentinelTorPage() {
  // ... state logic ...

  return (
    <div style={{
      minHeight: '100vh',
      // ... background ...
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0 100px',
    }}>
      {/* atmospheric grid ... */}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <IOSDevice dark={true} width={390} height={820}>
          <div key={state} style={{ height: '100%', overflowY: 'auto', background: '#03070B' }}>
            {screen}
          </div>
        </IOSDevice>
      </div>

      {/* state dock ... */}
    </div>
  )
}
```

- [ ] **Step 2: Commit changes**

```bash
git add frontend/app/sentineltor/page.tsx
git commit -m "refactor(sentineltor): clean up prototype page layout"
```
