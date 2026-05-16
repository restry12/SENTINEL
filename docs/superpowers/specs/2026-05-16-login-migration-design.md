# Design Spec: SENTINEL Login Migration
**Date:** 2026-05-16
**Topic:** Implementation of the high-fidelity SENTINEL login/register page from static HTML to Next.js.

## 1. Overview
Translate the provided `SENTINEL Auth.html` into a fully functional Next.js route (`/login`) with Full Auth support, capturing phone numbers for the SMS alerting system.

## 2. Architecture & Components
### 2.1 Routing
- **Path:** `/login`
- **Layout:** Uses a custom layout to bypass the main dashboard sidebar/topbar if necessary, but standard Next.js App Router structure.

### 2.2 UI Components
- **Background Layer:**
  - `Starfield`: CSS-only twinkling stars background.
  - `GridOverlay`: Fixed grid with radial mask.
  - `ScanOverlay`: CRT-style scanning lines.
- **Main Layout (`LoginContent`):**
  - **Left Section (Scene):**
    - `Globe`: Abstract SVG globe with CSS-animated scan rings, radar sweep, and fire foci.
    - `Telemetry`: Grid of tiles showing real-time stats (Focos, Cobertura, etc.).
  - **Right Section (Auth):**
    - `AuthCard`: Glassmorphism card with corner ticks.
    - `TabSwitcher`: Toggle between Login and Register.
    - `LoginForm`: Email/Password inputs.
    - `RegisterForm`: Name, Phone, Email, City, Password inputs.

## 3. Technical Implementation
### 3.1 Styling
- **Hybrid Approach:** 
  - `globals.css` or CSS Modules for complex animations (Globe, Stars, Scanlines) to maintain 100% visual fidelity to the zip.
  - Tailwind CSS v4 for layout and form elements.
- **Fonts:** Import 'Instrument Serif', 'Inter', and 'JetBrains Mono'.

### 3.2 Form Logic
- **Library:** `react-hook-form` + `zod`.
- **Validation:** 
  - Phone: Required for SMS functionality.
  - Password: Min 10 characters (as per zip design).
- **State:** `useState` for tab switching and loading states.

### 3.3 Auth Integration
- Skeleton for `POST /api/auth/register` and `POST /api/auth/login`.
- Phone number will be sent in the registration payload to support future SMS alerting features.
- Success → `router.push('/')`.

## 4. Visual Fidelity Checklist
- [ ] Rotating globe scan rings.
- [ ] Radar sweep effect.
- [ ] Pulsing fire foci.
- [ ] Twinkling starfield.
- [ ] CRT scanline overlay and vignette.
- [ ] Tab slider animation.
- [ ] Telemetry sparklines (SVG).

## 5. Success Criteria
1. `/login` route renders exactly like the zip file.
2. Register form captures and validates phone numbers.
3. Successful form submission triggers a redirect to the dashboard.
4. Fully responsive design (stacks on mobile).
