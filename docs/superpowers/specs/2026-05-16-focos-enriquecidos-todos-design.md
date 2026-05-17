# Spec — Todos los focos enriquecidos (clima + aire por foco)

Fecha: 2026-05-16

## Problema

Hoy `/api/fires/filter` corta a los 50 focos de mayor FRP. Make.com enriquece
esos 50 con OpenWeather + OpenAQ y los manda a `/api/trigger/full`. El backend
**descarta** el clima/aire por foco y se queda solo con un clima global (el del
primer foco) y el pm25 más alto. El frontend muestra todos los focos como
marcadores pero el popup solo expone coordenadas y FRP.

Se quiere: **todos** los focos (no solo 50), cada uno con su clima y calidad de
aire, visibles en el frontend.

## Objetivo

1. `/api/fires/filter` devuelve **todos** los focos del CSV, deduplicados.
2. El backend **guarda** el clima + pm25 de cada foco individual.
3. El popup del mapa muestra el clima + aire de ese foco.
4. Make.com **no se modifica** (ya manda los datos por foco).

## Decisiones

- **Deduplicación:** NASA FIRMS reporta el mismo incendio en múltiples pasadas
  de satélite (filas distintas, coordenada casi idéntica). Se deduplica
  agrupando por coordenada redondeada a **2 decimales (~1.1 km)** y conservando,
  de cada grupo, la detección con **mayor FRP**. Resultado: un marcador por foco
  real. (Se eligió 2 decimales y no 3: la resolución de píxel de NASA VIIRS es
  ~375 m y el mismo incendio se corre cientos de metros entre pasadas; redondear
  a ~110 m dejaría pasadas del mismo foco sin colapsar.)
- **Sin tope de focos.** El usuario tiene créditos de sobra en Make.com; no se
  agrega cap. (Se podría añadir una env `MAX_FIRES` en el futuro si hiciera
  falta, fuera de alcance ahora.)
- **Riesgo global sin cambios.** El cálculo de `riskLevel` sigue usando un
  clima global (primer foco) + pm25 máximo. El clima por foco es solo para
  almacenar y mostrar, no recalcula el riesgo. (Decisión explícita del usuario:
  "guardar y mostrar por foco", no "riesgo por foco".)
- **Campos opcionales** en `FireData` → backward-compatible: el análisis
  disparado por socket (sin datos de Make) sigue funcionando.

## Cambios por archivo

### 1. `backend/shared/types/index.ts`
Extender `FireData` con enriquecimiento opcional:

```ts
export interface FireData {
  lat: number
  lon: number
  frp: number
  brightness: number
  timestamp: string
  weather?: { speed: number; deg: number; humidity: number; temp?: number }
  pm25?: number | null   // null = OpenAQ no tenía estación cerca
}
```

### 2. `backend/packages/backend/src/routes/index.ts` — `/api/fires/filter`
- Quitar `.slice(0, 50)`.
- Deduplicar por coordenada redondeada (3 decimales), conservando el de mayor
  FRP por grupo.
- Ordenar por FRP desc (los más fuertes primero — útil para iteración/orden).
- Respuesta: `{ fires, total: all.length, dangerous: deduped.length }`.

### 3. `backend/packages/backend/src/routes/index.ts` — `/api/trigger/full`
Al construir cada `FireData`, adjuntar el enriquecimiento por foco cuando
viene:

```ts
const firms = rawFires.map(f => ({
  lat: f.lat, lon: f.lon, frp: f.frp, brightness: f.brightness,
  timestamp: f.date ?? f.timestamp,
  weather: typeof f.speed === 'number'
    ? { speed: f.speed, deg: f.deg, humidity: f.humidity, temp: f.temp }
    : undefined,
  pm25: typeof f.pm25 === 'number' ? f.pm25 : null,
}))
```

El clima global (`first`) y `pm25` máximo se siguen calculando igual para el
riesgo global — sin cambios en esa parte.

### 4. Orchestrator
Sin cambios. `runAnalysis` hace `externalFirms as FireData[]` y pasa el array
tal cual a `SentinelUpdate.fires`; los campos extra fluyen sin tocarse.

### 5. `frontend/components/dashboard/mapbox-panel.tsx` — popup
Agregar filas al popup cuando el foco tenga `weather` / `pm25`:
viento (m/s + dirección), humedad, temp (si está), pm25 (o "s/d" si `null`).
Si el foco no trae enriquecimiento, no se agregan esas filas (degradación
elegante).

### 6. Make.com
Sin cambios.

## Plan de pruebas

- `/api/fires/filter` con un CSV con duplicados (mismo punto, varios pases) →
  devuelve un solo foco por punto, el de mayor FRP, ordenado por FRP desc.
- `/api/trigger/full` con un payload de Make.com → cada `FireData` resultante
  conserva su `weather`/`pm25`; el `riskLevel` global no cambia respecto al
  comportamiento actual.
- Análisis disparado por socket (sin datos de Make) → sigue funcionando, focos
  sin `weather`/`pm25` (campos `undefined`/ausentes).
- Frontend: popup de un foco enriquecido muestra clima+aire; popup de un foco
  sin enriquecer muestra solo coords+FRP (no rompe).

## Fuera de alcance

- Tope `MAX_FIRES`.
- Recalcular el riesgo usando clima por foco.
- Cambios en el flujo de Make.com.
