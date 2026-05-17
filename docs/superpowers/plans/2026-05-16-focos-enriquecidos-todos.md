# Focos Enriquecidos (clima + aire por foco, todos los focos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/api/fires/filter` devuelva TODOS los focos (deduplicados) en vez de solo los 50 de mayor FRP, que el backend guarde el clima+pm25 de cada foco, y que el popup del mapa los muestre.

**Architecture:** Dos funciones puras nuevas y testeables (`dedupeFires`, `mapRawFiresToFireData`) en `utils/`, que las rutas existentes invocan. `FireData` gana campos opcionales (`weather`, `pm25`) → backward-compatible. Make.com y el orchestrator NO se tocan.

**Tech Stack:** TypeScript, Express, Vitest (backend tests), Next.js + Mapbox GL (frontend).

**Spec:** `docs/superpowers/specs/2026-05-16-focos-enriquecidos-todos-design.md`

---

## File Structure

- `backend/shared/types/index.ts` — extiende `FireData` (campos opcionales).
- `backend/packages/backend/src/utils/dedupeFires.ts` — NUEVO: dedup por coordenada, conserva mayor FRP, ordena FRP desc.
- `backend/packages/backend/src/utils/dedupeFires.test.ts` — NUEVO: tests de dedup.
- `backend/packages/backend/src/utils/mapRawFires.ts` — NUEVO: mapea objetos crudos de Make.com a `FireData` con enriquecimiento por foco.
- `backend/packages/backend/src/utils/mapRawFires.test.ts` — NUEVO: tests del mapeo.
- `backend/packages/backend/src/routes/index.ts` — usa ambas funciones en `/api/fires/filter` y `/api/trigger/full`.
- `frontend/hooks/use-socket.ts` — espeja los campos opcionales en su `FireData`.
- `frontend/components/dashboard/mapbox-panel.tsx` — pasa y muestra clima+pm25 por foco en el popup.

**Comando de test (backend):** desde `backend/packages/backend`:
`npx vitest run src/utils/<archivo>.test.ts`

---

### Task 1: Extender `FireData` (backend + frontend)

**Files:**
- Modify: `backend/shared/types/index.ts:1-7`
- Modify: `frontend/hooks/use-socket.ts:16-22`

- [ ] **Step 1: Extender `FireData` en shared/types**

Reemplazar el bloque `export interface FireData { ... }` (líneas 1-7) en `backend/shared/types/index.ts` por:

```ts
export interface FirePerFireWeather {
  speed: number      // m/s
  deg: number        // grados meteorológicos
  humidity: number   // 0-100%
  temp?: number       // °C, opcional
}

export interface FireData {
  lat: number
  lon: number
  frp: number        // Fire Radiative Power (MW)
  brightness: number
  timestamp: string
  weather?: FirePerFireWeather   // clima de ESE foco (OpenWeather vía Make.com)
  pm25?: number | null            // pm25 de ESE foco (OpenAQ); null = sin estación cerca
}
```

- [ ] **Step 2: Espejar en el frontend**

Reemplazar el bloque `export interface FireData { ... }` (líneas 16-22) en `frontend/hooks/use-socket.ts` por:

```ts
export interface FirePerFireWeather {
  speed: number
  deg: number
  humidity: number
  temp?: number
}

export interface FireData {
  lat: number
  lon: number
  frp: number
  brightness: number
  timestamp: string
  weather?: FirePerFireWeather
  pm25?: number | null
}
```

- [ ] **Step 3: Verificar typecheck backend**

Run: `cd backend/packages/backend && npx tsc --noEmit`
Expected: sin errores (los campos son opcionales, nada existente se rompe).

- [ ] **Step 4: Verificar typecheck frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add backend/shared/types/index.ts frontend/hooks/use-socket.ts
git commit -m "feat(types): FireData con clima+pm25 opcional por foco"
```

---

### Task 2: Función pura `dedupeFires` (TDD)

**Files:**
- Create: `backend/packages/backend/src/utils/dedupeFires.ts`
- Test: `backend/packages/backend/src/utils/dedupeFires.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/packages/backend/src/utils/dedupeFires.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dedupeFires } from './dedupeFires'
import type { FireData } from '@sentinel/types'

const f = (lat: number, lon: number, frp: number): FireData => ({
  lat, lon, frp, brightness: 300, timestamp: '2026-05-16T00:00:00Z',
})

describe('dedupeFires', () => {
  it('colapsa detecciones del mismo punto (≈ misma coord) en una, conservando mayor FRP', () => {
    const input = [f(-16.451, -92.103, 210), f(-16.450, -92.101, 198), f(-16.452, -92.099, 215)]
    const out = dedupeFires(input)
    expect(out).toHaveLength(1)
    expect(out[0].frp).toBe(215)
  })

  it('mantiene focos en puntos distintos', () => {
    const input = [f(-16.45, -92.10, 100), f(-17.90, -93.20, 80)]
    expect(dedupeFires(input)).toHaveLength(2)
  })

  it('ordena por FRP descendente', () => {
    const input = [f(-1, -1, 50), f(-2, -2, 300), f(-3, -3, 120)]
    expect(dedupeFires(input).map(x => x.frp)).toEqual([300, 120, 50])
  })

  it('devuelve [] con entrada vacía', () => {
    expect(dedupeFires([])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd backend/packages/backend && npx vitest run src/utils/dedupeFires.test.ts`
Expected: FAIL — `dedupeFires` no existe / no se puede importar.

- [ ] **Step 3: Implementar `dedupeFires`**

Crear `backend/packages/backend/src/utils/dedupeFires.ts`:

```ts
import type { FireData } from '@sentinel/types'

// NASA FIRMS reporta el mismo incendio en múltiples pasadas de satélite
// (filas distintas, coordenada casi idéntica). Agrupamos por coordenada
// redondeada a 3 decimales (~110 m) y conservamos la detección de mayor FRP.
export function dedupeFires(fires: FireData[]): FireData[] {
  const byCell = new Map<string, FireData>()
  for (const fire of fires) {
    const key = `${fire.lat.toFixed(3)},${fire.lon.toFixed(3)}`
    const existing = byCell.get(key)
    if (!existing || fire.frp > existing.frp) byCell.set(key, fire)
  }
  return [...byCell.values()].sort((a, b) => b.frp - a.frp)
}
```

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd backend/packages/backend && npx vitest run src/utils/dedupeFires.test.ts`
Expected: PASS — 4 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/backend/src/utils/dedupeFires.ts backend/packages/backend/src/utils/dedupeFires.test.ts
git commit -m "feat(fires): dedupeFires - colapsa detecciones repetidas por coordenada"
```

---

### Task 3: Función pura `mapRawFiresToFireData` (TDD)

**Files:**
- Create: `backend/packages/backend/src/utils/mapRawFires.ts`
- Test: `backend/packages/backend/src/utils/mapRawFires.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/packages/backend/src/utils/mapRawFires.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapRawFiresToFireData } from './mapRawFires'

describe('mapRawFiresToFireData', () => {
  it('adjunta clima+pm25 por foco cuando vienen', () => {
    const raw = [{
      lat: -16.4, lon: -92.1, frp: 210, brightness: 330, date: '2026-05-16T12:00:00Z',
      speed: 5.2, deg: 180, humidity: 40, temp: 28, pm25: 35,
    }]
    const out = mapRawFiresToFireData(raw)
    expect(out[0]).toEqual({
      lat: -16.4, lon: -92.1, frp: 210, brightness: 330, timestamp: '2026-05-16T12:00:00Z',
      weather: { speed: 5.2, deg: 180, humidity: 40, temp: 28 },
      pm25: 35,
    })
  })

  it('pm25 = null cuando no es número (OpenAQ sin estación)', () => {
    const raw = [{ lat: 1, lon: 2, frp: 10, brightness: 300, date: 'T', speed: 1, deg: 2, humidity: 3, pm25: null }]
    expect(mapRawFiresToFireData(raw)[0].pm25).toBeNull()
  })

  it('weather = undefined cuando no hay datos de clima', () => {
    const raw = [{ lat: 1, lon: 2, frp: 10, brightness: 300, timestamp: 'T' }]
    const out = mapRawFiresToFireData(raw)
    expect(out[0].weather).toBeUndefined()
    expect(out[0].timestamp).toBe('T')
  })

  it('devuelve [] con entrada vacía', () => {
    expect(mapRawFiresToFireData([])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test, verificar que falla**

Run: `cd backend/packages/backend && npx vitest run src/utils/mapRawFires.test.ts`
Expected: FAIL — `mapRawFiresToFireData` no existe.

- [ ] **Step 3: Implementar `mapRawFiresToFireData`**

Crear `backend/packages/backend/src/utils/mapRawFires.ts`:

```ts
import type { FireData } from '@sentinel/types'

// Make.com manda por cada foco: { lat, lon, frp, brightness, date|timestamp,
// speed, deg, humidity, temp?, pm25 }. pm25 puede venir null (OpenAQ sin
// estación cerca). Conserva el enriquecimiento por foco; antes se descartaba.
export function mapRawFiresToFireData(raw: Record<string, unknown>[]): FireData[] {
  return raw.map(f => {
    const hasWeather = typeof f.speed === 'number'
    return {
      lat: f.lat as number,
      lon: f.lon as number,
      frp: f.frp as number,
      brightness: f.brightness as number,
      timestamp: (f.date ?? f.timestamp) as string,
      weather: hasWeather
        ? {
            speed: f.speed as number,
            deg: f.deg as number,
            humidity: f.humidity as number,
            temp: typeof f.temp === 'number' ? f.temp : undefined,
          }
        : undefined,
      pm25: typeof f.pm25 === 'number' ? f.pm25 : null,
    }
  })
}
```

- [ ] **Step 4: Correr el test, verificar que pasa**

Run: `cd backend/packages/backend && npx vitest run src/utils/mapRawFires.test.ts`
Expected: PASS — 4 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/backend/src/utils/mapRawFires.ts backend/packages/backend/src/utils/mapRawFires.test.ts
git commit -m "feat(fires): mapRawFiresToFireData - conserva clima+pm25 por foco"
```

---

### Task 4: Cablear ambas funciones en las rutas

**Files:**
- Modify: `backend/packages/backend/src/routes/index.ts` (imports; `/api/fires/filter` ~líneas 69-78; `/api/trigger/full` ~líneas 86-88)

- [ ] **Step 1: Agregar imports**

En `backend/packages/backend/src/routes/index.ts`, después de la línea
`import { parseFirmsCSV } from '../utils/parseFirmsCSV'` (línea 6), agregar:

```ts
import { dedupeFires } from '../utils/dedupeFires'
import { mapRawFiresToFireData } from '../utils/mapRawFires'
```

- [ ] **Step 2: Reemplazar el cuerpo de `/api/fires/filter`**

Reemplazar este bloque exacto:

```ts
    const fires = [...all]
      .sort((a, b) => b.frp - a.frp)
      .slice(0, 50)
```

por:

```ts
    const fires = dedupeFires(all)
```

(El comentario de arriba de la ruta dice "devuelve los 50 focos con mayor FRP";
cambiarlo a: `// POST /api/fires/filter — recibe CSV de NASA, devuelve TODOS los focos deduplicados (orden FRP desc)`.)

- [ ] **Step 3: Reemplazar el mapeo de `firms` en `/api/trigger/full`**

Reemplazar este bloque exacto:

```ts
    const firms = rawFires.map(f => ({
      lat: f.lat, lon: f.lon, frp: f.frp, brightness: f.brightness, timestamp: f.date ?? f.timestamp,
    }))
```

por:

```ts
    const firms = mapRawFiresToFireData(rawFires)
```

(No tocar el cálculo de `weather` global (`first`) ni `pm25` máximo más abajo —
el riesgo global queda igual a propósito.)

- [ ] **Step 4: Typecheck**

Run: `cd backend/packages/backend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual de `/api/fires/filter`**

En una terminal: `cd backend && npm run dev -w packages/backend` (espera "running on port").
En otra terminal:

```bash
printf 'latitude,longitude,bright_ti4,frp,acq_date\n-16.451,-92.103,330,210,2026-05-16\n-16.450,-92.101,331,198,2026-05-16\n-17.90,-93.20,300,80,2026-05-16\n' | curl -s -X POST http://localhost:3000/api/fires/filter -H 'Content-Type: text/plain' --data-binary @-
```

Expected: JSON con `"total":3`, `fires` con **2** elementos (las dos primeras
filas son el mismo punto → se conserva la de frp 210), ordenados FRP desc
(`210` antes que `80`).

- [ ] **Step 6: Commit**

```bash
git add backend/packages/backend/src/routes/index.ts
git commit -m "feat(api): fires/filter devuelve todos deduplicados; trigger/full conserva clima+pm25 por foco"
```

---

### Task 5: Mostrar clima+aire por foco en el popup del mapa

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx` (mapeo de fires ~líneas 52-60; popup HTML ~líneas 98-119)

- [ ] **Step 1: Pasar `weather`/`pm25` al objeto de marcador**

En `frontend/components/dashboard/mapbox-panel.tsx`, reemplazar el bloque del
mapeo de `fires` (el `sentinelUpdate ? sentinelUpdate.fires.map(...) : FALLBACK_FIRES`):

```ts
    const fires = sentinelUpdate
      ? sentinelUpdate.fires.map((f, i) => ({
          id: `FIRE-${String(i + 1).padStart(3, '0')}`,
          lat: f.lat,
          lon: f.lon,
          frp: f.frp,
          intensity: sentinelUpdate.riskLevel,
        }))
      : FALLBACK_FIRES
```

por:

```ts
    const fires = sentinelUpdate
      ? sentinelUpdate.fires.map((f, i) => ({
          id: `FIRE-${String(i + 1).padStart(3, '0')}`,
          lat: f.lat,
          lon: f.lon,
          frp: f.frp,
          intensity: sentinelUpdate.riskLevel,
          weather: f.weather,
          pm25: f.pm25,
        }))
      : FALLBACK_FIRES.map(f => ({ ...f, weather: undefined, pm25: undefined }))
```

- [ ] **Step 2: Agregar filas condicionales al popup**

En el mismo archivo, dentro del template del popup, después del bloque
`tactical-stat-row` de "Power (MW)" y antes del cierre `</div>` de
`tactical-popup-body`, insertar:

```ts
            ${(inc as any).weather ? `
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Wind</span>
              <span class="tactical-stat-value num">${(inc as any).weather.speed.toFixed(1)} m/s · ${(inc as any).weather.deg}°</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Humidity</span>
              <span class="tactical-stat-value num">${(inc as any).weather.humidity}%</span>
            </div>` : ''}
            ${(inc as any).weather && typeof (inc as any).weather.temp === 'number' ? `
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Temp</span>
              <span class="tactical-stat-value num">${(inc as any).weather.temp.toFixed(1)}°C</span>
            </div>` : ''}
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">PM2.5</span>
              <span class="tactical-stat-value num">${(inc as any).pm25 == null ? 's/d' : (inc as any).pm25 + ' µg/m³'}</span>
            </div>
```

- [ ] **Step 3: Typecheck + build frontend**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: sin errores de tipos; build OK.

- [ ] **Step 4: Verificación manual visual**

Run: `cd frontend && pnpm dev` → abrir `http://localhost:3010/dashboard`.
Con datos vivos (socket conectado a Render): hacer click en un foco →
el popup muestra Wind / Humidity / (Temp si hay) / PM2.5. Un foco sin
enriquecimiento muestra "s/d" en PM2.5 y no rompe.
(Si el socket aún no conecta por env vars de Vercel/CORS, basta con verificar
que el build no rompe y que el fallback demo sigue mostrando el popup base.)

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): popup muestra clima+aire por foco"
```

---

## Self-Review

**Spec coverage:**
- "fires/filter devuelve todos deduplicados" → Task 2 + Task 4 (Step 2). ✅
- "backend guarda clima+pm25 por foco" → Task 1 (tipos) + Task 3 + Task 4 (Step 3). ✅
- "popup muestra clima+aire por foco" → Task 5. ✅
- "Make.com sin cambios" → ningún task lo toca. ✅
- "orchestrator sin cambios" → confirmado en spec; `runAnalysis` pasa `fires` tal cual (cast estructural conserva campos extra), ningún task lo modifica. ✅
- "riesgo global sin cambios" → Task 4 Step 3 explícitamente NO toca el `weather` global ni el `pm25` máximo. ✅
- "campos opcionales / backward-compatible" → Task 1 usa `?`; Task 3 testea el caso sin clima. ✅
- "dedup conserva mayor FRP por punto" → Task 2 test explícito. ✅

**Placeholder scan:** sin TBD/TODO; todo el código está completo en cada step. ✅

**Type consistency:** `FireData.weather` (tipo `FirePerFireWeather`: `speed/deg/humidity/temp?`) y `pm25?: number | null` se usan consistentes en Tasks 1, 3, 5. `dedupeFires(FireData[]): FireData[]` y `mapRawFiresToFireData(Record<string,unknown>[]): FireData[]` coinciden con su uso en Task 4. ✅

**Notas de proporcionalidad (hackathon):** el codebase no tiene tests de rutas (solo unit con Vitest), así que la lógica testeable se aisló en funciones puras (Tasks 2-3, TDD real) y las rutas/frontend se verifican manualmente (Tasks 4-5). Decisión deliberada por velocidad de demo.
