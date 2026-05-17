# Top 150 enriquecidos + resto crudo (token de corrida) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/api/fires/filter` guarde la lista completa de focos bajo un `runId` y devuelva solo el top 150 por FRP; que `/api/trigger/full` recupere por `runId` y superponga los 150 enriquecidos sobre el resto crudo.

**Architecture:** Dos módulos nuevos y testeables — `run-cache` (Map en memoria con TTL, guarda/recupera por runId) y `mergeEnriched` (función pura que superpone enriquecidos sobre la lista completa por coordenada). Las dos rutas existentes los invocan. Make.com solo mueve un token de texto entre las 2 requests (esquiva la limitación de serialización de arrays).

**Tech Stack:** TypeScript, Express, Vitest, `crypto.randomUUID()` (built-in Node).

**Spec:** `docs/superpowers/specs/2026-05-16-focos-top150-resto-design.md`

---

## File Structure

- `backend/packages/backend/src/services/run-cache.ts` — NUEVO: Map en memoria, `storeRun`/`getRun`, TTL 15 min, tope 20, `_resetRunCache` (test-only).
- `backend/packages/backend/src/services/run-cache.test.ts` — NUEVO.
- `backend/packages/backend/src/utils/mergeEnriched.ts` — NUEVO: función pura de superposición por coord-key.
- `backend/packages/backend/src/utils/mergeEnriched.test.ts` — NUEVO.
- `backend/packages/backend/src/routes/index.ts` — MODIFICAR: imports, `ENRICH_LIMIT`, cuerpo de `/api/fires/filter`, construcción de `firms` en `/api/trigger/full`.
- Make.com — cambio manual del usuario (Task 4, documentado, sin código).

**Comando de test (backend), desde `/Users/restry/Desktop/SENTINEL/backend/packages/backend`:**
`npx vitest run src/<ruta>.test.ts`

---

### Task 1: `run-cache` (TDD)

**Files:**
- Create: `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/services/run-cache.ts`
- Test: `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/services/run-cache.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/services/run-cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { storeRun, getRun, _resetRunCache } from './run-cache'
import type { FireData } from '@sentinel/types'

const fire = (frp: number): FireData => ({
  lat: -16.4, lon: -92.1, frp, brightness: 300, timestamp: '2026-05-16T00:00:00Z',
})

describe('run-cache', () => {
  beforeEach(() => { _resetRunCache() })
  afterEach(() => { vi.useRealTimers() })

  it('storeRun devuelve un runId y getRun recupera lo guardado', () => {
    const fires = [fire(100), fire(50)]
    const id = storeRun(fires)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(getRun(id)).toBe(fires)
  })

  it('runIds distintos para llamadas distintas', () => {
    expect(storeRun([fire(1)])).not.toBe(storeRun([fire(2)]))
  })

  it('getRun de un id inexistente devuelve undefined', () => {
    expect(getRun('no-existe')).toBeUndefined()
  })

  it('una entrada expirada (>15 min) devuelve undefined', () => {
    vi.useFakeTimers()
    const id = storeRun([fire(10)])
    expect(getRun(id)).toBeDefined()
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(getRun(id)).toBeUndefined()
  })

  it('al superar el tope de 20 entradas se descarta la más vieja', () => {
    const first = storeRun([fire(0)])
    for (let i = 1; i < 21; i++) storeRun([fire(i)])
    expect(getRun(first)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd /Users/restry/Desktop/SENTINEL/backend/packages/backend && npx vitest run src/services/run-cache.test.ts`
Expected: FAIL — no se puede importar `./run-cache`.

- [ ] **Step 3: Implementar**

Crear `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/services/run-cache.ts`:

```ts
import type { FireData } from '@sentinel/types'
import { randomUUID } from 'crypto'

// Cache en memoria de corridas. /api/fires/filter guarda la lista completa
// deduplicada bajo un runId; /api/trigger/full la recupera para superponer
// los focos enriquecidos. Single instance en Render → Map en memoria alcanza.
const TTL_MS = 15 * 60 * 1000
const MAX_ENTRIES = 20

interface Entry {
  fires: FireData[]
  createdAt: number
}

const store = new Map<string, Entry>()

function sweep(now: number): void {
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(id)
  }
  // Map preserva orden de inserción → la primera clave es la más vieja.
  while (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function storeRun(fires: FireData[]): string {
  const now = Date.now()
  sweep(now)
  const runId = randomUUID()
  store.set(runId, { fires, createdAt: now })
  return runId
}

export function getRun(runId: string): FireData[] | undefined {
  const entry = store.get(runId)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(runId)
    return undefined
  }
  return entry.fires
}

// Solo para tests — limpia el estado del módulo entre casos.
export function _resetRunCache(): void {
  store.clear()
}
```

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd /Users/restry/Desktop/SENTINEL/backend/packages/backend && npx vitest run src/services/run-cache.test.ts`
Expected: PASS — 5 tests verdes.

- [ ] **Step 5: Commit**

```bash
cd /Users/restry/Desktop/SENTINEL && git add backend/packages/backend/src/services/run-cache.ts backend/packages/backend/src/services/run-cache.test.ts && git commit -m "feat(fires): run-cache - guarda lista completa por runId con TTL

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: `mergeEnriched` (TDD)

**Files:**
- Create: `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/utils/mergeEnriched.ts`
- Test: `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/utils/mergeEnriched.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/utils/mergeEnriched.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergeEnriched } from './mergeEnriched'
import type { FireData } from '@sentinel/types'

const raw = (lat: number, lon: number, frp: number): FireData => ({
  lat, lon, frp, brightness: 300, timestamp: '2026-05-16T00:00:00Z',
})
const enrich = (lat: number, lon: number, frp: number): FireData => ({
  ...raw(lat, lon, frp),
  weather: { speed: 5, deg: 180, humidity: 40 },
  pm25: 35,
})

describe('mergeEnriched', () => {
  it('full vacío → devuelve enriched tal cual (degradación)', () => {
    const e = [enrich(-16.4, -92.1, 200)]
    expect(mergeEnriched([], e)).toBe(e)
  })

  it('superpone el enriquecido sobre el crudo del mismo punto (~2 decimales)', () => {
    const full = [raw(-16.451, -92.103, 210), raw(-17.90, -93.20, 80)]
    const enriched = [enrich(-16.450, -92.101, 210)]   // mismo cell a 2 decimales
    const out = mergeEnriched(full, enriched)
    expect(out).toHaveLength(2)
    expect(out[0].weather).toEqual({ speed: 5, deg: 180, humidity: 40 })
    expect(out[0].pm25).toBe(35)
    expect(out[1].weather).toBeUndefined()
    expect(out[1].pm25).toBeUndefined()
  })

  it('mantiene el largo de full y no agrega enriquecidos sin match', () => {
    const full = [raw(1, 1, 10), raw(2, 2, 20)]
    const enriched = [enrich(9, 9, 99)]   // no matchea ninguno
    const out = mergeEnriched(full, enriched)
    expect(out).toHaveLength(2)
    expect(out.every(f => f.weather === undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd /Users/restry/Desktop/SENTINEL/backend/packages/backend && npx vitest run src/utils/mergeEnriched.test.ts`
Expected: FAIL — no se puede importar `./mergeEnriched`.

- [ ] **Step 3: Implementar**

Crear `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/utils/mergeEnriched.ts`:

```ts
import type { FireData } from '@sentinel/types'

// Mismo redondeo que dedupeFires (2 decimales) para que el match sea
// consistente con cómo se agruparon los focos.
function cellKey(f: FireData): string {
  return `${f.lat.toFixed(2)},${f.lon.toFixed(2)}`
}

// Superpone los focos enriquecidos sobre la lista completa: cada foco de `full`
// cuyo cell coincide con uno enriquecido se reemplaza por el enriquecido; el
// resto queda crudo. Si `full` está vacío (runId perdido) devuelve `enriched`.
export function mergeEnriched(full: FireData[], enriched: FireData[]): FireData[] {
  if (full.length === 0) return enriched
  const byCell = new Map<string, FireData>()
  for (const e of enriched) byCell.set(cellKey(e), e)
  return full.map(f => byCell.get(cellKey(f)) ?? f)
}
```

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd /Users/restry/Desktop/SENTINEL/backend/packages/backend && npx vitest run src/utils/mergeEnriched.test.ts`
Expected: PASS — 3 tests verdes.

- [ ] **Step 5: Commit**

```bash
cd /Users/restry/Desktop/SENTINEL && git add backend/packages/backend/src/utils/mergeEnriched.ts backend/packages/backend/src/utils/mergeEnriched.test.ts && git commit -m "feat(fires): mergeEnriched - superpone enriquecidos sobre lista completa

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Cablear en las rutas

**Files:**
- Modify: `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/routes/index.ts`

- [ ] **Step 1: Agregar imports**

En `/Users/restry/Desktop/SENTINEL/backend/packages/backend/src/routes/index.ts`, después de la línea `import { mapRawFiresToFireData } from '../utils/mapRawFires'`, agregar:

```ts
import { storeRun, getRun } from '../services/run-cache'
import { mergeEnriched } from '../utils/mergeEnriched'
```

- [ ] **Step 2: Definir `ENRICH_LIMIT`**

En el mismo archivo, justo después del último `import` (antes de la primera línea que no sea import), agregar:

```ts
// Cuántos focos (top por FRP) se mandan a Make.com para enriquecer. Única
// perilla: subir/bajar acá según cuánto aguante OpenAQ / el tiempo de corrida.
const ENRICH_LIMIT = 150
```

- [ ] **Step 3: Reemplazar el cuerpo de `/api/fires/filter`**

Reemplazar este bloque exacto:

```ts
  // POST /api/fires/filter — recibe CSV de NASA, devuelve TODOS los focos deduplicados (orden FRP desc)
  app.post('/api/fires/filter', (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : ''
    const all = csv ? parseFirmsCSV(csv) : []

    const fires = dedupeFires(all)

    res.json({ fires, total: all.length, dangerous: fires.length })
  })
```

por:

```ts
  // POST /api/fires/filter — recibe CSV de NASA. Deduplica, guarda la lista
  // completa bajo un runId, y devuelve solo el top ENRICH_LIMIT por FRP.
  app.post('/api/fires/filter', (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : ''
    const all = csv ? parseFirmsCSV(csv) : []

    const deduped = dedupeFires(all)
    const runId = storeRun(deduped)

    res.json({
      runId,
      fires: deduped.slice(0, ENRICH_LIMIT),
      total: all.length,
      dangerous: deduped.length,
    })
  })
```

- [ ] **Step 4: Reemplazar la construcción de `firms` en `/api/trigger/full`**

En `/api/trigger/full`, reemplazar estas dos líneas exactas:

```ts
    const body = req.body as { fires?: unknown[] }
    const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : []

    const firms = mapRawFiresToFireData(rawFires)
```

por:

```ts
    const body = req.body as { fires?: unknown[]; runId?: unknown }
    const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : []

    const enriched = mapRawFiresToFireData(rawFires)
    const runId = typeof body.runId === 'string' ? body.runId : undefined
    const full = runId ? (getRun(runId) ?? []) : []
    const firms = mergeEnriched(full, enriched)
```

(NO tocar el resto del handler: `first`, `weather`, `pm25`, `lat`, `lon`,
`res.status(202)`, `executeAndBroadcast` quedan igual. `first = rawFires[0]` y
`pm25Values` siguen calculándose sobre `rawFires` = los enriquecidos, así el
riesgo global no cambia. `firms.length` ahora es el largo mergeado, correcto.)

- [ ] **Step 5: Typecheck**

Run: `cd /Users/restry/Desktop/SENTINEL/backend/packages/backend && npx tsc --noEmit`
Expected: sin errores nuevos. (Errores pre-existentes no relacionados a estos archivos no bloquean; errores en `routes/index.ts` por este cambio SÍ bloquean → corregir.)

- [ ] **Step 6: Verificación manual con backend local**

Levantar el backend (apuntando dotenv al `.env` que tiene SUPABASE, y puerto libre):

Terminal A:
`cd /Users/restry/Desktop/SENTINEL/backend && DOTENV_CONFIG_PATH=/Users/restry/Desktop/SENTINEL/backend/.env PORT=3009 npm run dev -w packages/backend`
Esperar el log `running on port 3009`. (Si el `.env` no tiene SUPABASE_*, el guard fail-fast corta; en ese caso reportar DONE_WITH_CONCERNS y validar solo con los unit tests + relectura del código.)

Terminal B — `/api/fires/filter` con un CSV de >150 focos distintos:

```bash
{ echo "latitude,longitude,bright_ti4,frp,acq_date,acq_time"; for i in $(seq 1 200); do printf -- "-%d.%03d,-90.%03d,300,%d,2026-05-16,0534\n" $((10+i/50)) $((i*7%1000)) $((i*13%1000)) $((300-i)); done; } | curl -s -X POST http://localhost:3009/api/fires/filter -H 'Content-Type: text/plain' --data-binary @- | python3 -c "import sys,json; d=json.load(sys.stdin); print('runId:', d['runId'][:8], '| fires:', len(d['fires']), '| total:', d['total'], '| dangerous:', d['dangerous'])"
```

Expected: `fires: 150`, `total: 200`, `dangerous: 200`, y `runId` un string no vacío.

Luego `/api/trigger/full` con ese `runId` + 1 foco enriquecido (debe ACK 202):

```bash
RUNID=$(printf '...' )  # opcional; alternativamente repetir el filter y copiar el runId del JSON
curl -s -X POST http://localhost:3009/api/trigger/full -H 'Content-Type: application/json' -d '{"runId":"PEGAR_RUNID_AQUI","fires":[{"lat":-10.000,"lon":-90.001,"frp":299,"brightness":350,"date":"2026-05-16T20:00:00Z","speed":4.2,"deg":120,"humidity":33,"pm25":12}]}' -i | head -1
```

Expected: `HTTP/1.1 202 Accepted`. (El análisis corre en background; el ACK 202
inmediato confirma que el merge no rompió el handler. La verificación e2e real
del mapa es en el deploy.)

- [ ] **Step 7: Commit**

```bash
cd /Users/restry/Desktop/SENTINEL && git add backend/packages/backend/src/routes/index.ts && git commit -m "feat(api): fires/filter devuelve top 150 + runId; trigger/full mergea por runId

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Configuración de Make.com (manual — la hace el usuario)

**No es código.** Documentación del cambio que el usuario aplica en Make.com.

- [ ] **Paso único: ajustar el módulo 14**

El módulo 4 (`POST /api/fires/filter`) ahora devuelve `runId` además de `fires`.
El iterador (módulo 10) sigue apuntando a los `fires` de la respuesta del módulo
4 — ahora son 150 en vez de todos, **sin cambio estructural**.

En el **módulo 14** (`POST /api/trigger/full`), cambiar el body RAW de:

```
{"fires":[{{15.text}}]}
```

a:

```
{"runId":"{{4.data.runId}}","fires":[{{15.text}}]}
```

(La ruta exacta del runId — `{{4.data.runId}}` vs `{{4.runId}}` — depende de
cómo Make.com mapee la respuesta del módulo 4; usar la misma raíz desde la que
hoy sale `{{4.data.fires}}` / `{{4...fires}}` para el iterador.)

Mantener el error handler "Resume" en el módulo 17 (OpenAQ) y el sleep ~1s en
el iterador (decisiones previas) para no gatillar el `429` de OpenAQ con los
150 focos.

---

## Self-Review

**Spec coverage:**
- "filter guarda completa bajo runId, devuelve top 150 + runId" → Task 1 (run-cache) + Task 3 Step 3. ✅
- "iterador recorre solo 150" → consecuencia de Task 3 Step 3 (filter devuelve 150) + Task 4. ✅
- "trigger/full recupera por runId, superpone, resto crudo" → Task 2 (mergeEnriched) + Task 3 Step 4. ✅
- "solo viaja un token entre requests" → Task 3 (runId string) + Task 4 (body). ✅
- "degradación si runId perdido → solo 150" → Task 2 (`full` vacío → devuelve enriched) + Task 3 Step 4 (`getRun(runId) ?? []`). ✅
- "weather/pm25 global del subconjunto enriquecido" → Task 3 Step 4 nota: `first`/`pm25Values` sobre `rawFires` (= los enriquecidos), sin cambio. ✅
- "run-cache: Map, TTL 15min, tope 20, randomUUID" → Task 1. ✅
- "mergeEnriched: redondeo 2 decimales consistente con dedupeFires" → Task 2 (`toFixed(2)`). ✅
- "ENRICH_LIMIT constante = 150" → Task 3 Step 2. ✅
- "Make: body módulo 14 suma runId, iterador sin cambio" → Task 4. ✅
- "sin cambios en orchestrator/parseFirmsCSV/dedupeFires/mapRawFires/tipos/frontend" → ningún task los toca. ✅

**Placeholder scan:** Sin TBD/TODO. El único "PEGAR_RUNID_AQUI" es una
instrucción explícita de verificación manual (copiar el runId real devuelto por
el curl previo), no un placeholder de código. La ambigüedad `{{4.data.runId}}`
vs `{{4.runId}}` es de Make.com (config del usuario), explícitamente acotada a
"la misma raíz que el iterador ya usa".

**Type consistency:** `storeRun(FireData[]): string`, `getRun(string): FireData[] | undefined`, `_resetRunCache(): void`, `mergeEnriched(FireData[], FireData[]): FireData[]` — usados consistentes en Tasks 1-3. `ENRICH_LIMIT` (número) usado en `deduped.slice(0, ENRICH_LIMIT)`. `runId` string opcional en el body de trigger/full. Coherente.

**Nota de proporcionalidad (hackathon):** lógica con estado/decisión aislada en
`run-cache` y `mergeEnriched` con TDD real (Vitest); rutas verificadas con curl
manual (el codebase no tiene tests de rutas — consistente con el plan anterior).
