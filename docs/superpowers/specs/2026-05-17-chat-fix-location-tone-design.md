# Chat SENTINEL AI — Fix location hallucination + lay-person tone

**Date:** 2026-05-17
**Status:** Design (pending review)
**Owner:** andy

## Problem

Two bugs in the SENTINEL AI chat tab (`/chat`):

1. **Location hallucination.** The chatbot cites fire locations (Quilpué, Valparaíso, etc.) that do not match the actual coordinates shown on the map. Numbers (FRP, AQI, count) are correct, but place names are wrong.
2. **Overly technical tone.** Default replies use jargon (FRP, AQI, PM2.5, MW) that the average citizen does not understand. The chat is intended for both authorities and the general public, but the lay-person path is underserved.

Map coverage is now continental (Americas), but the existing chat prompt forbids mentioning anything outside Chile, which further amplifies the hallucination problem when fires appear in Brazil, USA, México, etc.

## Root cause analysis

### Location hallucination

- `frontend/app/api/chat/route.ts` builds the system prompt from `SentinelSnapshot`. It surfaces:
  - aggregate fire count
  - global FRP max
  - a single `riskAssessment.zona_afectada` string
  - report-level `zonas_evacuacion_prioritaria`
- It **does not** include the per-fire `regional_context.country` / `region_name` that already exists in `perFireExpansions[]` (see `shared/types/index.ts:113-134`).
- The system prompt contains hardcoded few-shot examples ("Quilpué", "Valparaíso") that the LLM parrots back when asked "the most dangerous fire," because it has no per-fire location data in scope.
- The prompt also restricts answers to Chile (`Solo Chile. Agencias: CONAF, ONEMI, SENAPRED, Bomberos (132). Nunca menciones CONAFOR ni agencias de otros países.`), which conflicts with the now-continental map.

### Tone

- The prompt already contains a tone-adaptation rule, but defaults bias technical because:
  - Welcome screen copy is operational ("Analista Operacional de Emergencias", "datos en vivo y conocimiento operacional").
  - Suggestions mix technical (`¿Cuál es el foco más peligroso ahora?`) with lay phrasing.
  - There is no explicit signal in the prompt that "default = vecino, raise level only on technical questions."

### Upstream contributing factor (deferred — see Out of scope)

`agent-fire` uses an LLM (`runAContext` in `backend/packages/agent-fire/src/analyze.ts:50`) to infer `country` and `region_name` per fire from coordinates. This is itself a hallucination source. It is the right next fix, but is out of scope for this spec to avoid blowing scope. Chat will consume whatever `regional_context` agent-fire already produces.

## Goals

- Eliminate location hallucination in chat responses (use only data present in the prompt; refuse to invent).
- Default to a citizen-friendly tone with an explicit "Modo experto" toggle for authorities.
- Continental coverage (Americas), not Chile-only.

## Non-goals

- Fixing `runAContext` (LLM geocoding of fires) — out of scope; tracked separately.
- Building a Supabase gazetteer / PostGIS lookup — not needed; `perFireExpansions[].regional_context` already provides per-fire country + region.
- Persisting chat history or feedback — explicitly deferred per user direction ("no añadamos tantas cosas").
- Adding new agents or backend pipeline changes.

## Design

Frontend-only change. Scope: `frontend/app/api/chat/route.ts` and `frontend/components/chat/chat-page.tsx`.

### 1. Pass per-fire location to the prompt

The chat route currently destructures only top-level snapshot fields. Extend it to forward `perFireExpansions` from the existing `SentinelUpdate`:

```ts
interface SentinelSnapshot {
  // existing fields...
  perFireExpansions?: Array<{
    lat: number
    lon: number
    frp: number
    regional_context?: {
      region_name: string
      country: string
      vegetation_type: string
    }
  }>
}
```

In `buildSystemPrompt`, when `perFireExpansions` is present, emit a **named fire list** before the aggregate block:

```
## FOCOS ACTIVOS (con ubicación)
1. Foco lat -33.05, lon -71.30 — 142.3 MW — California (Valparaíso), Chile
2. Foco lat 19.21, lon -103.65 — 89.1 MW — Colima, México
3. Foco lat -16.55, lon -54.78 — 76.5 MW — Mato Grosso, Brasil
...
```

Cap at the top 8 by FRP to keep prompt size bounded.

### 2. Tighten the anti-invention rule

Replace the current Chile-only restriction with a per-fire rule:

```
## REGLA ANTI-INVENCIÓN (CRÍTICA)
- Solo puedes nombrar ubicaciones de focos que aparecen literalmente en la sección "FOCOS ACTIVOS" más abajo.
- Si el usuario pregunta por un foco específico y no está en la lista, di "No tengo ese foco en los datos en vivo" y no inventes nombres.
- Si la lista está vacía o no llegó: di "No tengo datos en vivo de focos en este momento."
- Nunca inventes coordenadas, FRP, AQI, hectáreas, agencias ni rutas que no estén en el contexto.
```

Remove the hardcoded few-shot examples that mention Chilean cities. Replace them with examples that reference "Foco 1" or "el foco más cercano a [región del prompt]" so the LLM learns to cite from data, not from its training corpus.

### 3. Continental scope

Drop `Solo Chile`. Replace with:

```
## ÁMBITO
SENTINEL cubre incendios en América (Norte, Centro, Sur). Agencias por país:
- Chile: CONAF, ONEMI, SENAPRED, Bomberos (132)
- México: CONAFOR, Protección Civil
- Brasil: IBAMA, Defesa Civil
- EEUU: CAL FIRE / USFS, 911
- Argentina: SNMF, Defensa Civil
- Colombia: UNGRD
Cita la agencia del país donde está el foco que el usuario pregunta. Si no estás seguro del país, di "no tengo el dato" y no inventes.
```

### 4. Tone modes

Add a `mode: 'citizen' | 'expert'` field to the chat request payload and to the conversation state:

- **citizen (default)**: warm, short sentences, no acronyms unless translated, empathetic. Translates AQI→"calidad del aire", FRP→"intensidad del fuego", PM2.5→"partículas en el aire".
- **expert**: operational, technical, concise. Uses acronyms, MW, km/h, hectares directly.

The mode is appended to the system prompt as a directive section:

```
## TONO ACTUAL: <citizen|expert>
[citizen]: Hablas como vecino informado que ayuda a su comunidad...
[expert]: Hablas como oficial de emergencias en briefing operacional...
```

UI: a toggle next to the "Mistral Large" chip in the chat header. Persist the selection in `localStorage` under `sentinel_chat_mode`. Default to `citizen`.

### 5. Welcome screen + suggestions rework

Current:

```
"¿Cuál es el foco más peligroso ahora?"
"¿Qué hacer si hay humo en mi zona?"
"Resume la situación actual de incendios"
"¿Cuáles son las rutas de evacuación activas?"
```

Citizen-mode suggestions (default visible):

```
"¿Estoy en peligro ahora mismo?"
"¿Qué hago si veo humo cerca de mi casa?"
"¿Es seguro que mis hijos salgan a jugar hoy?"
"¿Cuándo se espera que mejore el aire?"
```

Expert-mode suggestions (shown when toggle is on):

```
"¿Cuál es el foco con mayor FRP actualmente?"
"Resumen operacional: focos activos, AQI, viento"
"Predicción 6h y 24h de propagación"
"Rutas de evacuación activas y estado"
```

Welcome header copy: replace "Analista Operacional de Emergencias" with mode-dependent subtitle:

- citizen: "Te ayudo a entender qué pasa y qué hacer."
- expert: "Analista operacional. Datos en vivo, predicción, rutas."

### 6. Behavior summary

| Aspect | Before | After |
|--------|--------|-------|
| Per-fire location in prompt | Not included | Top 8 by FRP, named via `regional_context` |
| Few-shot place names | Hardcoded Chilean cities | Generic ("el foco más cercano a...") |
| Geographic scope | Chile only | Americas |
| Default tone | Auto-detect, biases technical | Explicit citizen default |
| Tone control | Implicit (from question phrasing) | Explicit toggle, persisted |
| Suggestions | Mixed tone | Mode-specific |

## Data flow

```
backend agent-fire → perFireExpansions[].regional_context (already exists)
   ↓ Socket.io update
frontend SentinelContext (already exists)
   ↓ chat-page.tsx passes snapshot + mode
frontend /api/chat/route.ts (Edge)
   ↓ buildSystemPrompt now includes named fire list + mode
OpenRouter Mistral Large
   ↓ stream
chat UI
```

No new tables. No new endpoints. No new agents.

## Risk and mitigations

- **`regional_context` itself may be wrong** (LLM-derived in agent-fire). Chat is downstream of this. If the country is wrong in `regional_context`, chat will repeat the wrong country — but at least consistently with what the map shows, not from training data. Fixing agent-fire's geocoding is the next ticket.
- **Mode toggle adds UI complexity**. Mitigated by persisting in `localStorage` and defaulting sensibly (citizen).
- **Prompt size growth** from listing fires. Capped at top 8 by FRP. Each line ~80 chars → ~640 chars added. Negligible vs. 60s LLM timeout budget.

## Acceptance criteria

1. Ask "¿cuál es el foco más peligroso?" — response cites a place name that matches the top-FRP fire in `perFireExpansions`. No Chilean city is mentioned unless a Chilean fire is in the data.
2. Ask "¿corro peligro?" in citizen mode — response uses no acronyms (no "FRP", "AQI", "PM2.5"). Tone is empathetic, short sentences.
3. Toggle to expert mode and ask the same — response uses operational language with acronyms.
4. With no live data, ask about a specific fire — response says "no tengo datos en vivo" and refuses to invent.
5. Suggestions on welcome screen change when mode toggle flips.
6. Mode selection persists across page reloads.

## Out of scope (next tickets)

- Replace `runAContext` LLM geocoding with deterministic `country-state-city` lookup (already installed: `backend/packages/backend/package.json`).
- Persist chat history per session in Supabase.
- Thumbs-up/down feedback capture.
