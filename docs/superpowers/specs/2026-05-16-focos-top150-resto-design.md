# Spec — Top 150 enriquecidos + resto de focos crudos (token de corrida)

Fecha: 2026-05-16

## Problema

`/api/fires/filter` hoy devuelve TODOS los focos deduplicados (~4003 en una
corrida real). El iterador de Make.com los recorre todos haciendo OpenWeather +
OpenAQ por foco → revienta el rate limit de OpenAQ (`429`) y/o supera el límite
de ejecución de Make.com (~40 min). Enriquecer 4003 es inviable.

Se quiere: enriquecer (clima + aire) solo los **top 150 por FRP**, y que el
mapa igual muestre **todos** los focos restantes como marcadores crudos (lat /
lon / FRP, sin clima/aire).

Restricción dura: Make.com **no puede serializar un array de objetos a JSON**
(gotcha documentado en la memoria del flujo). Por eso los ~3850 focos crudos no
pueden "volver a viajar" por Make como array. Solo puede mover strings escalares
entre módulos.

## Objetivo

1. `/api/fires/filter` deduplica, **guarda la lista completa en memoria** bajo
   un `runId`, y devuelve solo el **top 150 por FRP** + el `runId`.
2. El iterador de Make.com recorre solo esos 150 (corrida ~5-13 min, viable).
3. `/api/trigger/full` recibe `runId` + los 150 enriquecidos, recupera la lista
   completa por `runId`, **superpone** los 150 enriquecidos y deja el resto
   crudos. El análisis corre sobre la lista mergeada (~4003 focos, 150
   enriquecidos).
4. El único dato que Make mueve entre las 2 requests es un **token de texto**
   (esquiva la limitación de serialización).

## Flujo (2 requests)

### POST #1 — `/api/fires/filter` (módulo 4 de Make)
Make manda el CSV crudo de NASA (`{{1.data}}`) — **igual que hoy, no cambia**.
Backend:
1. `parseFirmsCSV(csv)` → ~6027 detecciones.
2. `dedupeFires(...)` → ~4003 focos, ordenados por FRP desc.
3. `storeRun(deduped)` → guarda los ~4003 en memoria, devuelve un `runId`.
4. Responde `{ runId, fires: deduped.slice(0, ENRICH_LIMIT), total: all.length, dangerous: deduped.length }`.

### Make — iterador (sin cambios estructurales)
Módulo 10 itera `{{4...fires}}` = **150**. Módulos 11/17 (OpenWeather/OpenAQ)
por foco. Módulo 15 (Text Aggregator) junta los 150 enriquecidos. Se mantiene
el error handler "Resume" en el módulo 17 y un sleep ~1s (decisión previa) para
no gatillar el `429` de OpenAQ.

### POST #2 — `/api/trigger/full` (módulo 14)
Make manda `{ "runId": "<token>", "fires": [<150 enriquecidos>] }`.
Backend:
1. `enriched = mapRawFiresToFireData(rawFires)` (los 150, con weather/pm25).
2. `full = getRun(runId)` → los ~4003 crudos guardados en POST #1.
3. `merged = mergeEnriched(full, enriched)` → cada foco de `full` cuyo
   coord-key coincide con uno enriquecido se reemplaza por el enriquecido; el
   resto queda crudo.
4. `weather` global y `pm25` global se derivan del subconjunto **enriquecido**
   (el crudo no tiene clima) — mantiene el cálculo de riesgo consistente con
   hoy.
5. `executeAndBroadcast(io, lat, lon, merged, weather, pm25)`.

**Degradación:** si `runId` no existe o expiró (ej. cold start de Render free
tier entre las 2 requests) → `full = []` → se usa solo `enriched` (150 focos).
La demo sigue funcionando, solo sin el resto crudo esa corrida.

## Cambios por archivo

### 1. NUEVO `backend/packages/backend/src/services/run-cache.ts`
Cache en memoria de corridas. Interfaz:

```ts
export function storeRun(fires: FireData[]): string   // genera y devuelve runId
export function getRun(runId: string): FireData[] | undefined
```

- `Map<string, { fires: FireData[]; createdAt: number }>`.
- `runId` vía `crypto.randomUUID()` (built-in Node, sin dependencia).
- TTL 15 min. Barrido perezoso de expirados en cada `storeRun`.
- Tope duro de entradas (ej. 20): si se supera, se descarta la más vieja.
  Evita crecimiento ilimitado de RAM en el free tier de Render.
- Single instance en Render → Map en memoria es suficiente. No se persiste
  (fuera de alcance); el cold start degrada a "solo 150" (ver arriba).

### 2. NUEVO `backend/packages/backend/src/utils/mergeEnriched.ts`
Función pura:

```ts
export function mergeEnriched(full: FireData[], enriched: FireData[]): FireData[]
```

- Construye un índice de `enriched` por coord-key redondeada a **2 decimales**
  (mismo redondeo que `dedupeFires`, para que el match sea consistente).
- Recorre `full`; si el coord-key está en el índice, usa el foco enriquecido;
  si no, deja el crudo. Devuelve la lista del mismo largo que `full`.
- Si `full` está vacío (runId perdido) → devuelve `enriched` tal cual
  (degradación).

### 3. `backend/packages/backend/src/routes/index.ts` — `/api/fires/filter`
- Tras `dedupeFires`, `const runId = storeRun(deduped)`.
- Responder `{ runId, fires: deduped.slice(0, ENRICH_LIMIT), total: all.length, dangerous: deduped.length }`.
- `ENRICH_LIMIT`: constante = 150 (única perilla; un solo lugar para cambiarla).
- Actualizar el comentario de la ruta.

### 4. `backend/packages/backend/src/routes/index.ts` — `/api/trigger/full`
- Leer `runId` del body (`req.body.runId`, string opcional).
- `enriched = mapRawFiresToFireData(rawFires)` (igual que hoy).
- `full = runId ? (getRun(runId) ?? []) : []`.
- `firms = mergeEnriched(full, enriched)`.
- `weather` global: del primer foco **enriquecido** (no del merged). `pm25`
  global: máximo entre los **enriquecidos**. (Hoy se calcula sobre `rawFires`;
  como `rawFires` = los 150 enriquecidos, el comportamiento del riesgo no
  cambia.)
- Pasar `firms` (merged) a `executeAndBroadcast`.

### 5. Make.com (lo hace el usuario, se documenta)
- Módulo 4: la respuesta ahora trae `runId` + 150 focos (antes todos). El
  iterador sigue apuntando a `{{4...fires}}` (ahora 150) — sin cambio
  estructural.
- Módulo 14: el body RAW pasa de `{"fires":[{{15.text}}]}` a
  `{"runId":"{{4...runId}}","fires":[{{15.text}}]}` (la ruta exacta del runId
  según dónde lo deje Make en la respuesta del módulo 4).
- Mantener error handler "Resume" en módulo 17 + sleep ~1s.

### 6. Sin cambios
Orchestrator, `parseFirmsCSV`, `dedupeFires`, `mapRawFiresToFireData`, tipos
(`FireData` ya tiene `weather?`/`pm25?` opcional), frontend (el popup ya degrada
elegante: focos sin enriquecer no muestran filas de clima/aire).

## Plan de pruebas

- **run-cache (unit):** `storeRun` devuelve runId único; `getRun` devuelve lo
  guardado; entrada expirada (>15 min) devuelve `undefined`; al superar el tope
  se descarta la más vieja.
- **mergeEnriched (unit):** full de N crudos + M enriquecidos cuyos coords
  coinciden con M de los N → resultado largo N, esos M con `weather`/`pm25`, el
  resto sin; `full` vacío → devuelve `enriched`.
- **`/api/fires/filter` (manual curl):** CSV con >150 focos → respuesta trae
  `runId` (string), `fires` con exactamente 150, `total`/`dangerous` correctos.
- **`/api/trigger/full` (manual curl):** con `runId` válido + payload de 150
  enriquecidos → la lista analizada tiene el largo completo y solo 150
  enriquecidos. Con `runId` inválido → usa solo los 150 (degradación), no
  rompe.

## Fuera de alcance

- Persistir el run-cache entre reinicios de Render (in-memory; cold start
  degrada).
- Multipart / mandar el CSV en el body del POST #2.
- Cambiar el redondeo de deduplicación.
- Hacer `ENRICH_LIMIT` configurable por env (constante por ahora).
