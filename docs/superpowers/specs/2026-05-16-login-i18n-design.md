# Login Page i18n — ES/EN Toggle

## Goal
Add ES/EN language toggle to the login page. All visible text switches between Spanish and English. State persists in localStorage.

## Architecture

### New files
- `frontend/lib/i18n/translations.ts` — flat `{ es: Record<string,string>, en: Record<string,string> }` object with every string used in the login page
- `frontend/lib/i18n/language-context.tsx` — `LanguageContext`, `LanguageProvider`, `useLang()` hook. Reads/writes `localStorage.sentinel_lang`, defaults to `'es'`

### Modified files
- `frontend/app/login/page.tsx` — wrap `<main>` with `<LanguageProvider>`, add ES·EN toggle button in header top-right, consume `useLang()`
- `frontend/components/login/visual-scene.tsx` — consume `useLang()` for all hardcoded strings
- `frontend/components/login/telemetry-tiles.tsx` — accept lang prop or consume `useLang()` for tile labels/deltas
- `frontend/components/login/auth-card.tsx` — translate tab labels and footer links
- `frontend/components/login/login-form.tsx` — translate title, subtitle, labels, button, divider, demo button; re-create zod schema inside component using translated messages
- `frontend/components/login/register-form.tsx` — same as login-form

## Toggle UI
Placed in the header top-right area. Style: `font-mono text-[10px] tracking-[0.2em] uppercase`. Two buttons `ES` and `EN` separated by `·`, active one in `text-foreground`, inactive in `text-text-muted`. No border/background — fits existing pill aesthetic.

## Strings scope
All user-visible text: header status labels, visual scene (badge, hero title, subtitle, status pills, globe labels), telemetry tile labels and deltas, auth card tabs, login form, register form, zod validation messages, toast messages.

Technical/monospace decorative strings (lat/lon coordinates, "ENCRYPTED", sparkline delta numbers) stay in English as they are part of the visual aesthetic.

## Zod validation
Each form re-creates its zod schema inside the component body, after `useLang()` call, so validation messages are in the active language.

## State
`LanguageProvider` wraps only the login `<main>`. Not global layout — no other page needs this.
Default language: `'es'`.
Persistence: `localStorage.sentinel_lang = 'es' | 'en'`.
