# Chat SENTINEL AI — Fix location hallucination + lay-person tone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the SENTINEL AI chat from inventing fire locations, switch the default tone to plain-language for citizens, add an explicit "Modo experto" toggle, and broaden geographic scope from Chile-only to the Americas.

**Architecture:** Frontend-only change. The chat route (`frontend/app/api/chat/route.ts`) is extended to (a) accept `perFireExpansions` from the existing `SentinelUpdate` and emit a per-fire named list into the system prompt, (b) accept a `mode: 'citizen' | 'expert'` field, and (c) replace the Chile-only restriction with an Americas-wide one plus a strict per-fire anti-invention rule. The chat page (`frontend/components/chat/chat-page.tsx`) adds a mode toggle persisted in `localStorage` and swaps welcome copy + suggestions based on mode.

**Tech Stack:** Next.js 16 App Router (Edge runtime for chat route), React client component, TypeScript, Mistral Large via OpenRouter. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-05-17-chat-fix-location-tone-design.md`

**Note on testing:** The frontend has no test runner (no `vitest` / `jest` in `frontend/package.json`). Verification is via TypeScript compile (`pnpm tsc --noEmit`), the dev server (`pnpm dev` on port 3010), and explicit curl-based prompt inspection. Where the spec calls for testable logic (the prompt builder), it is extracted to a pure function and verified by invoking the API route directly and inspecting the streamed system prompt echo.

---

## File Structure

**Modified files:**

- `frontend/app/api/chat/route.ts` — extend `SentinelSnapshot` interface with `perFireExpansions`, add `mode` to request, rewrite `buildSystemPrompt` to (a) emit per-fire named list, (b) drop Chile-only restriction, (c) inject mode directive, (d) replace hardcoded few-shot place names.
- `frontend/components/chat/chat-page.tsx` — add `mode` state with `localStorage` persistence, add toggle UI in header, swap suggestions and welcome subtitle by mode, pass `mode` in request body.

**No new files.** No new dependencies. No backend changes. No Supabase changes.

---

## Task 1: Extend chat request types for per-fire location and mode

**Files:**
- Modify: `frontend/app/api/chat/route.ts:15-60`

- [ ] **Step 1: Read current types**

Read `frontend/app/api/chat/route.ts` lines 10-60 to confirm the current `SentinelSnapshot` and `ChatRequest` shape before changing them.

- [ ] **Step 2: Extend `SentinelSnapshot` with `perFireExpansions` and `ChatRequest` with `mode`**

In `frontend/app/api/chat/route.ts`, replace the `SentinelSnapshot` and `ChatRequest` interfaces with:

```ts
interface PerFireRegionalContext {
  region_name: string
  country: string
  vegetation_type?: string
}

interface PerFireExpansion {
  lat: number
  lon: number
  frp: number
  regional_context?: PerFireRegionalContext
}

interface SentinelSnapshot {
  timestamp: string
  fires: FireData[]
  airQuality: { pm25: number; aqi: number; category: string }
  riskLevel: string
  riskAssessment?: { zona_afectada: string; resumen: string }
  report?: {
    nivel_emergencia: string
    poblacion_en_riesgo_estimada: number
    resumen_ejecutivo: string
    acciones_inmediatas: string[]
    zonas_evacuacion_prioritaria: string[]
  }
  naturalRoutes?: {
    punto_encuentro_principal: string
    rutas: Array<{ nombre: string; estado: string; distancia_km: number }>
  }
  prediction?: {
    analisis_6h: string
    analisis_24h: string
    analisis_72h: string
    confianza: string
  }
  perFireExpansions?: PerFireExpansion[]
}

type ChatMode = 'citizen' | 'expert'

interface ChatRequest {
  message: string
  history: ChatMessage[]
  sentinelSnapshot: SentinelSnapshot | null
  newsArticles: NewsArticle[]
  mode?: ChatMode
}
```

- [ ] **Step 3: Wire `mode` through `POST` handler**

Still in `frontend/app/api/chat/route.ts`, in the `POST` function (around line 167), destructure `mode` from the body and default to `'citizen'`. Pass it into `buildSystemPrompt`:

```ts
const body: ChatRequest = await req.json()
const { message, history, sentinelSnapshot, newsArticles, mode } = body
const chatMode: ChatMode = mode === 'expert' ? 'expert' : 'citizen'
// ...
const systemPrompt = buildSystemPrompt(sentinelSnapshot, newsArticles ?? [], chatMode)
```

Update the `buildSystemPrompt` signature to accept `chatMode`:

```ts
function buildSystemPrompt(
  snapshot: SentinelSnapshot | null,
  news: NewsArticle[],
  mode: ChatMode,
): string {
  // ...
}
```

- [ ] **Step 4: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors in `app/api/chat/route.ts`. If other files break because they import `ChatRequest`, none should — `ChatRequest` is not exported.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/chat/route.ts
git commit -m "feat(chat): extend request types with perFireExpansions and mode"
```

---

## Task 2: Replace Chile-only scope and anti-invention rule

**Files:**
- Modify: `frontend/app/api/chat/route.ts:63-94` (the literal system prompt block)

- [ ] **Step 1: Replace the prompt preamble**

In `frontend/app/api/chat/route.ts`, replace the entire `let prompt = ...` initial assignment (lines 63-93 in the current file, ending before `if (snapshot) {`) with the new continental, anti-invention preamble:

```ts
let prompt = `Eres SENTINEL AI, asistente del sistema SENTINEL de monitoreo de incendios forestales en AMÉRICA (Norte, Centro y Sur). Respondes exclusivamente en español.

## REGLA ANTI-INVENCIÓN (CRÍTICA)
- Solo puedes nombrar ubicaciones, países, regiones o ciudades de focos que aparecen LITERALMENTE en la sección "FOCOS ACTIVOS" más abajo.
- Solo puedes citar números (FRP en MW, AQI, PM2.5, hectáreas, viento km/h, conteos) que aparecen LITERALMENTE en las secciones de DATOS EN VIVO.
- Si el usuario pregunta por un foco, región o métrica que no está en el contexto: responde "No tengo ese dato en vivo en este momento" y NO inventes nombres ni números.
- Si la lista de FOCOS ACTIVOS está vacía o ausente: di explícitamente que no hay focos en los datos en vivo y ofrece información general sin valores específicos.
- Está estrictamente prohibido inventar nombres de comunas, estados, ciudades o agencias que no estén en el contexto.

## ÁMBITO
SENTINEL cubre incendios en América. Agencias por país (cita la del país donde está el foco que el usuario pregunta; si no estás seguro del país, no inventes):
- Chile: CONAF, ONEMI, SENAPRED, Bomberos (132)
- Argentina: SNMF, Defensa Civil
- Brasil: IBAMA, Defesa Civil
- México: CONAFOR, Protección Civil
- Colombia: UNGRD
- Perú: SERFOR, INDECI
- EEUU: CAL FIRE / USFS, 911
- Canadá: CIFFC, 911
Para otros países de América, usa "autoridades locales de emergencia" si no conoces la agencia oficial.`
```

- [ ] **Step 2: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/chat/route.ts
git commit -m "feat(chat): replace Chile-only scope with Americas-wide anti-invention rule"
```

---

## Task 3: Inject tone directive based on mode

**Files:**
- Modify: `frontend/app/api/chat/route.ts` — inside `buildSystemPrompt`, after the ÁMBITO block.

- [ ] **Step 1: Append mode-dependent tone block**

In `frontend/app/api/chat/route.ts`, immediately after the new `## ÁMBITO` block from Task 2 and before the `if (snapshot)` branch, add:

```ts
  if (mode === 'citizen') {
    prompt += `\n\n## TONO ACTUAL: CIUDADANO (modo por defecto)
Hablas como vecino informado que ayuda a su comunidad. Reglas:
- Frases cortas y cálidas. Empatía primero, datos después.
- Nunca uses siglas técnicas sin traducirlas: AQI → "calidad del aire", PM2.5 → "partículas en el aire", FRP → "intensidad del fuego", MW/km² → omitir o traducir.
- Si tienes que dar un número, acompáñalo de una analogía cotidiana (ej. "calidad del aire mala — parecido a estar al lado de un fumador").
- Foco práctico: ¿qué hace la persona ahora? Cierra ventanas, mascarilla, evacuar, llamar a emergencias.
- Tres viñetas máximo por respuesta cuando enumeres acciones.
- Nada de jerga operacional ("nivel 2", "perímetro", "FRP máximo"). Si el usuario la pide explícita, ofrece traducir.

EJEMPLOS:
P: ¿Corro peligro?
R: Hay un foco grande cerca de tu zona. No es emergencia inmediata, pero si ves humo, cierra ventanas y ten mascarilla a mano. Si tienes niños chicos o alguien con asma, mejor quédense adentro hoy.

P: ¿Qué tan grave es la calidad del aire?
R: Está mala. Es como estar al lado de alguien fumando todo el rato. Si haces deporte hoy, déjalo para mañana. Si tienes asma, no salgas a menos que sea necesario.`
  } else {
    prompt += `\n\n## TONO ACTUAL: EXPERTO
Hablas como oficial de emergencias en briefing operacional. Reglas:
- Conciso, técnico, sin rodeos.
- Usa siglas y unidades directas: FRP (MW), AQI, PM2.5 (µg/m³), viento (km/h), hectáreas.
- Cita ubicaciones por nombre + país desde FOCOS ACTIVOS.
- Listas operacionales si ayudan (recursos, acciones, prioridades).
- Sin pleonasmos, sin saludos.

EJEMPLOS:
P: ¿Foco más peligroso?
R: [Foco con mayor FRP de la lista FOCOS ACTIVOS] — propagación esperada según viento del contexto. Recursos recomendados: [del reporte si existe].

P: AQI actual.
R: [valor numérico exacto] — [categoría]. Riesgo respiratorio [bajo/medio/alto].`
  }
```

- [ ] **Step 2: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/chat/route.ts
git commit -m "feat(chat): inject mode-specific tone directive into system prompt"
```

---

## Task 4: Emit per-fire named list in prompt

**Files:**
- Modify: `frontend/app/api/chat/route.ts` — inside `buildSystemPrompt`, within the `if (snapshot)` branch, before the existing aggregate `DATOS EN VIVO` block.

- [ ] **Step 1: Add the per-fire named list before aggregate data**

In `frontend/app/api/chat/route.ts`, inside `if (snapshot) {`, BEFORE the existing line `prompt += \`\n\n## DATOS EN VIVO [...]\``, insert:

```ts
    const perFire = snapshot.perFireExpansions ?? []
    if (perFire.length > 0) {
      const topByFrp = [...perFire]
        .sort((a, b) => b.frp - a.frp)
        .slice(0, 8)
      prompt += `\n\n## FOCOS ACTIVOS (con ubicación verificada)\n`
      topByFrp.forEach((f, i) => {
        const ctx = f.regional_context
        const loc = ctx
          ? `${ctx.region_name}, ${ctx.country}`
          : `lat ${f.lat.toFixed(2)}, lon ${f.lon.toFixed(2)} (ubicación sin confirmar)`
        prompt += `${i + 1}. ${loc} — ${f.frp.toFixed(1)} MW (lat ${f.lat.toFixed(2)}, lon ${f.lon.toFixed(2)})\n`
      })
      if (perFire.length > 8) {
        prompt += `(... y ${perFire.length - 8} focos más de menor intensidad, no listados)\n`
      }
    } else {
      prompt += `\n\n## FOCOS ACTIVOS\nNo hay focos con ubicación verificada en este snapshot. Si el usuario pregunta por un foco específico, di que no tienes ese dato.\n`
    }
```

- [ ] **Step 2: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification — inspect rendered prompt**

Start the frontend dev server from `frontend/`:

```bash
pnpm dev
```

In a separate terminal, send a chat request with a snapshot containing two fake `perFireExpansions`:

```bash
curl -N -X POST http://localhost:3010/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "¿Cuál es el foco más peligroso?",
    "history": [],
    "newsArticles": [],
    "mode": "citizen",
    "sentinelSnapshot": {
      "timestamp": "2026-05-17T12:00:00Z",
      "fires": [],
      "airQuality": {"pm25": 30, "aqi": 95, "category": "Moderate"},
      "riskLevel": "high",
      "perFireExpansions": [
        {"lat": -33.05, "lon": -71.30, "frp": 142.3, "regional_context": {"region_name": "Valparaíso", "country": "Chile"}},
        {"lat": 19.21, "lon": -103.65, "frp": 89.1, "regional_context": {"region_name": "Colima", "country": "México"}}
      ]
    }
  }'
```

Expected: streamed response cites "Valparaíso, Chile" (or paraphrase) as the most dangerous fire, with FRP 142.3 MW. Does not mention any city not in the payload. If `OPENROUTER_API_KEY` is missing, the route returns `{"error":"service not configured"}` with status 500 — in that case, skip this step and verify by reading the code only.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/chat/route.ts
git commit -m "feat(chat): emit per-fire named list from perFireExpansions in prompt"
```

---

## Task 5: Add mode state and toggle UI in chat page

**Files:**
- Modify: `frontend/components/chat/chat-page.tsx`

- [ ] **Step 1: Add mode state with localStorage persistence**

In `frontend/components/chat/chat-page.tsx`, replace the imports block at lines 1-8 with:

```tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, Zap, Newspaper, Activity, User, Briefcase } from "lucide-react"
import { TopBar } from "@/components/dashboard/top-bar"
import { useSentinel } from "@/contexts/sentinel-context"
import { MessageBubble, type Message } from "./message-bubble"
import { ChatInput } from "./chat-input"

type ChatMode = 'citizen' | 'expert'
const MODE_LS_KEY = 'sentinel_chat_mode'

const CITIZEN_SUGGESTIONS = [
  "¿Estoy en peligro ahora mismo?",
  "¿Qué hago si veo humo cerca de mi casa?",
  "¿Es seguro que mis hijos salgan a jugar hoy?",
  "¿Cuándo se espera que mejore el aire?",
]

const EXPERT_SUGGESTIONS = [
  "¿Cuál es el foco con mayor FRP actualmente?",
  "Resumen operacional: focos activos, AQI, viento",
  "Predicción 6h y 24h de propagación",
  "Rutas de evacuación activas y estado",
]
```

Then delete the existing `const SUGGESTIONS = [...]` block (current lines 10-15).

- [ ] **Step 2: Add `mode` state and persistence inside `ChatPage`**

In `frontend/components/chat/chat-page.tsx`, inside the `ChatPage` function, just after `const { sentinelUpdate } = useSentinel()` (current line 28), add:

```tsx
  const [mode, setMode] = useState<ChatMode>('citizen')

  // Hydrate persisted mode after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_LS_KEY)
      if (stored === 'citizen' || stored === 'expert') setMode(stored)
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, [])

  const updateMode = (next: ChatMode) => {
    setMode(next)
    try {
      window.localStorage.setItem(MODE_LS_KEY, next)
    } catch {
      /* non-critical */
    }
  }
```

- [ ] **Step 3: Pass `mode` in the chat request body**

In the same file, locate the `fetch('/api/chat', { ... })` call (current ~line 78). Replace the `body` line with:

```tsx
        body: JSON.stringify({
          message: content,
          history,
          sentinelSnapshot: sentinelUpdate,
          newsArticles,
          mode,
        }),
```

- [ ] **Step 4: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/chat/chat-page.tsx
git commit -m "feat(chat): add mode state with localStorage persistence and request wiring"
```

---

## Task 6: Render the mode toggle in the chat header

**Files:**
- Modify: `frontend/components/chat/chat-page.tsx` — the header `<div className="flex items-center gap-3 py-4 ...">` block.

- [ ] **Step 1: Replace the header with mode-aware copy and a toggle**

In `frontend/components/chat/chat-page.tsx`, locate the header block (currently lines 166-193, the `<div className="flex items-center gap-3 py-4 border-b border-white/10 shrink-0">` containing the `Bot` icon, title, and chips). Replace the entire block with:

```tsx
        <div className="flex items-center gap-3 py-4 border-b border-white/10 shrink-0 flex-wrap">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Bot className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-white font-black tracking-widest text-sm uppercase">SENTINEL AI</h1>
            <p className="text-white/40 text-[10px] tracking-wider uppercase">
              {mode === 'citizen'
                ? 'Te ayudo a entender qué pasa y qué hacer'
                : 'Analista operacional · datos en vivo, predicción, rutas'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {/* Mode toggle */}
            <div
              className="flex items-center rounded-md border border-white/10 bg-white/5 p-0.5"
              role="tablist"
              aria-label="Modo de respuesta"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'citizen'}
                onClick={() => updateMode('citizen')}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                  mode === 'citizen'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <User className="w-3 h-3" />
                Ciudadano
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'expert'}
                onClick={() => updateMode('expert')}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                  mode === 'expert'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Briefcase className="w-3 h-3" />
                Experto
              </button>
            </div>
            {hasLiveData && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-orange-500/30 text-orange-400/80 bg-orange-500/5 font-mono">
                <Activity className="w-3 h-3" />
                Datos en vivo
              </span>
            )}
            {hasNews && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 text-blue-400/80 bg-blue-500/5 font-mono">
                <Newspaper className="w-3 h-3" />
                Noticias
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/30 bg-white/5 font-mono">
              <Zap className="w-3 h-3" />
              Mistral Large
            </span>
          </div>
        </div>
```

- [ ] **Step 2: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual UI check**

Run `pnpm dev` from `frontend/`, open `http://localhost:3010/chat`, and verify:
- The toggle shows "Ciudadano | Experto" pills with the active one highlighted in orange.
- Clicking "Experto" highlights it and updates the subtitle to "Analista operacional · datos en vivo, predicción, rutas".
- Reloading the page preserves the last-selected mode.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/chat/chat-page.tsx
git commit -m "feat(chat): render citizen/expert mode toggle in chat header"
```

---

## Task 7: Swap suggestions and welcome subtitle by mode

**Files:**
- Modify: `frontend/components/chat/chat-page.tsx` — `WelcomeScreen` component and its props.

- [ ] **Step 1: Pass `mode` into `WelcomeScreen` from `ChatPage`**

In `frontend/components/chat/chat-page.tsx`, locate the line `<WelcomeScreen onSuggestion={sendMessage} />` (current ~line 198) and replace with:

```tsx
          {messages.length === 0 && (
            <WelcomeScreen onSuggestion={sendMessage} mode={mode} />
          )}
```

- [ ] **Step 2: Update `WelcomeScreen` signature and body**

In `frontend/components/chat/chat-page.tsx`, replace the entire `WelcomeScreen` function (currently lines 220-243) with:

```tsx
function WelcomeScreen({
  onSuggestion,
  mode,
}: {
  onSuggestion: (s: string) => void
  mode: ChatMode
}) {
  const suggestions = mode === 'citizen' ? CITIZEN_SUGGESTIONS : EXPERT_SUGGESTIONS
  const subtitle =
    mode === 'citizen'
      ? 'Pregúntame qué está pasando y qué puedes hacer'
      : 'Datos en vivo, predicción, recursos operacionales'

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
        <Bot className="w-8 h-8 text-orange-400" />
      </div>
      <div>
        <p className="text-white/70 text-sm">¿En qué puedo ayudarte hoy?</p>
        <p className="text-white/30 text-xs mt-1">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="text-left text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual UI check**

With `pnpm dev` running, open `http://localhost:3010/chat`. With no messages:
- Citizen mode: suggestions read "¿Estoy en peligro ahora mismo?", "¿Qué hago si veo humo cerca de mi casa?", etc.
- Click "Experto" — suggestions switch to "¿Cuál es el foco con mayor FRP actualmente?", etc.
- Subtitle changes accordingly.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/chat/chat-page.tsx
git commit -m "feat(chat): mode-specific welcome subtitle and suggestion set"
```

---

## Task 8: End-to-end verification against acceptance criteria

**Files:** None modified.

- [ ] **Step 1: Start backend dependencies if testing live**

Make sure `BACKEND_URL` is set in `frontend/.env.local` and that the backend (or its cached `last_snapshot`) provides a `SentinelUpdate` with non-empty `perFireExpansions`. If running fully local with no Make.com input, the snapshot may be null — in that case the chat should still answer general questions and refuse to invent specific fires.

- [ ] **Step 2: Walk the acceptance criteria from the spec**

With `pnpm dev` running and the chat page open:

1. In **expert mode**, ask "¿cuál es el foco más peligroso?" — the reply names a region/country that appears in the top of `perFireExpansions` sorted by FRP. No Chilean city is named unless a Chilean fire is in the data. **Pass / Fail.**
2. In **citizen mode**, ask "¿corro peligro?" — the reply uses no acronyms (no "FRP", "AQI", "PM2.5") and reads as plain language. **Pass / Fail.**
3. Toggle to expert and ask the same — the reply uses operational language (FRP/AQI/MW). **Pass / Fail.**
4. With `perFireExpansions` absent or empty (test by triggering a chat before any backend snapshot arrives), ask about a specific fire by name not in any data — the reply says "no tengo ese dato" and does not invent. **Pass / Fail.**
5. Suggestions on welcome screen differ between citizen and expert modes. **Pass / Fail.**
6. Reload the page after switching to expert — mode stays expert. **Pass / Fail.**

If any criterion fails, identify which Task's output is wrong and fix it before the final commit.

- [ ] **Step 3: Final lint check**

Run from `frontend/`:

```bash
pnpm lint
```

Expected: no errors in `app/api/chat/route.ts` or `components/chat/chat-page.tsx`.

- [ ] **Step 4: Final commit if any acceptance-driven fixes were made**

```bash
git add -A
git commit -m "fix(chat): final pass on acceptance criteria"
```

If no fixes were needed, skip this step.

---

## Self-Review Notes

- **Spec coverage:**
  - Per-fire named list in prompt → Task 4.
  - Anti-invention rule rewrite → Task 2.
  - Continental scope → Task 2.
  - Mode directive in prompt → Task 3.
  - Mode state + persistence + toggle → Tasks 5 and 6.
  - Mode-specific welcome and suggestions → Task 7.
  - End-to-end acceptance walk → Task 8.
- **Placeholder scan:** No TBDs, no "implement later" steps. Every code step shows the exact code.
- **Type consistency:** `ChatMode = 'citizen' | 'expert'` is defined in route.ts (Task 1) and again in chat-page.tsx (Task 5) — the two files don't share an import, but the string literals match exactly across all uses. `MODE_LS_KEY` is only used in chat-page.tsx. `buildSystemPrompt` signature is updated in Task 1 and matched in Tasks 2, 3, 4.
- **Out-of-scope deferrals** (carried from the spec, not addressed here): `runAContext` LLM geocoding fix in agent-fire, Supabase chat history, feedback capture.
