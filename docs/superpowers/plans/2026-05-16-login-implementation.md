# SENTINEL Login Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-fidelity login and register page at `/login` based on the provided SENTINEL Auth.html, including full auth state management and phone number capture for SMS alerts.

**Architecture:** A standalone route `/login` using Next.js App Router. The UI is split into a visual "Scene" (Left) and an interactive "Auth Card" (Right). We use a hybrid styling approach: CSS Modules for complex animations and Tailwind/Shadcn for the UI components.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, React Hook Form, Zod, Framer Motion (optional for tabs).

---

### Task 1: Setup Styles and Assets

**Files:**
- Create: `frontend/app/login/login.module.css`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Port original CSS to CSS Module**
Copy the animation keyframes and complex visual styles from `SENTINEL Auth.html` into a new CSS module.

- [ ] **Step 2: Add specific color variables to globals.css**
Ensure all SENTINEL-specific colors are available globally if not already present.

- [ ] **Step 3: Commit styles**
```bash
git add frontend/app/login/login.module.css frontend/app/globals.css
git commit -m "style: setup login page custom animations and variables"
```

---

### Task 2: Implement Background & Shared Visuals

**Files:**
- Create: `frontend/components/login/background.tsx`
- Create: `frontend/components/login/visual-scene.tsx`
- Create: `frontend/components/login/telemetry-tiles.tsx`

- [ ] **Step 1: Create Background component**
Implement the `Stars`, `GridOverlay`, and `ScanOverlay` components.

- [ ] **Step 2: Create TelemetryTiles component**
Implement the grid of 4 tiles with SVG sparklines as seen in the zip.

- [ ] **Step 3: Create VisualScene component**
Combine the Globe (with scan rings and radar sweep) and the telemetry tiles.

- [ ] **Step 4: Commit visuals**
```bash
git add frontend/components/login/
git commit -m "feat: implement login page background and visual scene"
```

---

### Task 3: Implement Auth Forms with Validation

**Files:**
- Create: `frontend/components/login/login-form.tsx`
- Create: `frontend/components/login/register-form.tsx`
- Create: `frontend/components/login/auth-card.tsx`

- [ ] **Step 1: Define Zod schemas**
Create schemas for Login (email, pass) and Register (name, phone, email, city, pass, confirmPass).

- [ ] **Step 2: Implement LoginForm**
Use `react-hook-form` and the project's `Input`/`Button` components.

- [ ] **Step 3: Implement RegisterForm**
Ensure the phone number field is included and validated. Use a simple city/comuna text input for now.

- [ ] **Step 4: Implement AuthCard with Tab Switching**
Manage the state between Login and Register views with a sliding tab indicator.

- [ ] **Step 5: Commit forms**
```bash
git add frontend/components/login/
git commit -m "feat: implement auth forms with zod validation and phone capture"
```

---

### Task 4: Main Login Page and Integration

**Files:**
- Create: `frontend/app/login/page.tsx`
- Create: `frontend/app/api/auth/login/route.ts` (Mock implementation)

- [ ] **Step 1: Assemble the Login Page**
Combine `Background`, `VisualScene`, and `AuthCard` into the main page layout.

- [ ] **Step 2: Create Mock Auth API**
Create a simple Next.js API route that returns a successful session for testing.

- [ ] **Step 3: Add successful redirect logic**
In the form components, handle the API response and use `useRouter().push('/')`.

- [ ] **Step 4: Final verification**
Run the app, navigate to `/login`, and verify visuals and form behavior.

- [ ] **Step 5: Commit final implementation**
```bash
git add frontend/app/login/ frontend/app/api/auth/
git commit -m "feat: complete login page implementation with mock auth flow"
```
