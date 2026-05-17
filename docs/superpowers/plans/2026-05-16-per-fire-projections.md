# Per-Fire Projections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que cada foco de incendio muestre su propia proyección de expansión usando el viento real por foco, en lugar del viento global.

**Architecture:** El backend ya envía `FireData.weather.deg/speed` por foco y `PerFireExpansion.velocidad_kmh/direccion` por foco. Solo hay que cabliar esos datos en el frontend. Se agregan 3 cambios en `mapbox-panel.tsx` y 1 en `fire-selection-context.tsx`.

**Tech Stack:** React, TypeScript, Mapbox GL JS, Next.js 16

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `frontend/contexts/fire-selection-context.tsx` | Agregar campo `weather` a `SelectedFireData` |
| `frontend/components/dashboard/mapbox-panel.tsx` | (1) helper `directionToDeg`, (2) click handler usa viento por foco, (3) draw expansion usa `selectedFire.weather`, (4) per-fire expansions usa `pf.velocidad_kmh/direccion` |

---

### Task 1: Agregar `weather` a `SelectedFireData`

**Files:**
- Modify: `frontend/contexts/fire-selection-context.tsx:7-19`

- [ ] **Step 1: Editar la interfaz**

En `frontend/contexts/fire-selection-context.tsx`, agregar el campo `weather` a `SelectedFireData`:

```ts
export interface SelectedFireData {
  id: string
  lat: number
  lon: number
  frp: number
  brightness: number
  intensity: FireIntensity
  windImpactDir: string
  windKmh: number
  expansion2h?: { km2: number; ha: number }
  expansion6h?: { km2: number; ha: number }
  expansion12h?: { km2: number; ha: number }
  weather?: { speed: number; deg: number; humidity: number; temp?: number }
}
```

- [ ] **Step 2: Verificar que TypeScript no rompe**

```bash
cd /Users/restry/Desktop/SENTINEL/frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores nuevos (puede haber 0 errores).

- [ ] **Step 3: Commit**

```bash
git add frontend/contexts/fire-selection-context.tsx
git commit -m "feat(fire-context): add per-fire weather to SelectedFireData"
```

---

### Task 2: Agregar helper `directionToDeg` en mapbox-panel

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx` — agregar función antes de `makeFireSpreadPolygon` (cerca de línea 15)

- [ ] **Step 1: Agregar la función**

Insertar después de la línea del import de `useGeolocation` (antes de `const TOKEN = ...`):

```ts
function directionToDeg(dir: string): number | null {
  const map: Record<string, number> = {
    N: 0, NORTE: 0,
    NNE: 22.5,
    NE: 45, NORESTE: 45,
    ENE: 67.5,
    E: 90, ESTE: 90,
    ESE: 112.5,
    SE: 135, SURESTE: 135,
    SSE: 157.5,
    S: 180, SUR: 180,
    SSO: 202.5, SSW: 202.5,
    SO: 225, SUROESTE: 225, SW: 225,
    OSO: 247.5, WSW: 247.5,
    O: 270, OESTE: 270, W: 270,
    ONO: 292.5, WNW: 292.5,
    NO: 315, NOROESTE: 315, NW: 315,
    NNO: 337.5, NNW: 337.5,
  }
  return map[dir.toUpperCase().trim()] ?? null
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/restry/Desktop/SENTINEL/frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): add directionToDeg helper for per-fire wind direction"
```

---

### Task 3: Fix click handler — usar viento por foco

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx` — click handler del evento `'click', POINTS` (cerca de líneas 433-471)

El click handler actualmente usa `sDirLabel`, `wKmh`, `a2`, `a6`, `a12` que fueron calculados con el viento global al inicio del efecto. Hay que recalcularlos con el viento del foco si existe.

- [ ] **Step 1: Editar el bloque del click handler**

Dentro de `map.on('click', POINTS, (e) => { ... })`, justo después de parsear `weather` (línea ~439), agregar el cálculo por foco:

```ts
const weather = props.weatherJson ? JSON.parse(props.weatherJson) : undefined
const intensity: FireIntensity = props.frp >= 300 ? 'critical' : props.frp >= 100 ? 'high' : 'moderate'

// Per-fire wind — use fire's own weather if available, otherwise global
const fireWDeg   = weather?.deg   ?? wDeg
const fireWSpeed = weather?.speed ?? wSpeed
const fireSDeg   = (fireWDeg + 180) % 360
const fireSDirLabel = degToCompass(fireSDeg)
const fireWKmh   = Math.round(fireWSpeed * 3.6)
const fireA2  = computeFireSpreadArea(fireWSpeed, 2)
const fireA6  = computeFireSpreadArea(fireWSpeed, 6)
const fireA12 = computeFireSpreadArea(fireWSpeed, 12)
```

- [ ] **Step 2: Actualizar `popupData` para usar valores por foco**

Reemplazar la construcción de `popupData`:

```ts
const popupData: PopupData = {
  id: props.id, color, intensity: String(intensity),
  frp: props.frp, lat, lon,
  sDirLabel: fireSDirLabel, wKmh: fireWKmh,
  a2: fireA2, a6: fireA6, a12: fireA12,
  weather, pm25: props.pm25,
}
```

- [ ] **Step 3: Actualizar `setSelectedFire` para incluir weather y valores por foco**

Reemplazar la llamada a `setSelectedFire`:

```ts
setSelectedFire({
  id: props.id, lat, lon, frp: props.frp, brightness: props.brightness,
  intensity, windImpactDir: fireSDirLabel, windKmh: fireWKmh,
  expansion2h: fireA2, expansion6h: fireA6, expansion12h: fireA12,
  weather,
})
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/restry/Desktop/SENTINEL/frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): click handler uses per-fire wind for popup and selectedFire"
```

---

### Task 4: Fix "Draw expansion" — usar `selectedFire.weather`

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx` — useEffect "Draw expansion" (~líneas 573-574)

- [ ] **Step 1: Reemplazar las dos líneas de viento global**

Buscar (dentro del useEffect que llama `drawExpansion`):

```ts
const windDeg = sentinelUpdate?.weather?.deg ?? 315
const windSpeedMs = sentinelUpdate?.weather?.speed ?? 6.7
```

Reemplazar con:

```ts
const windDeg     = selectedFire?.weather?.deg   ?? sentinelUpdate?.weather?.deg   ?? 315
const windSpeedMs = selectedFire?.weather?.speed ?? sentinelUpdate?.weather?.speed ?? 6.7
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/restry/Desktop/SENTINEL/frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): expansion ellipse uses per-fire wind direction"
```

---

### Task 5: Fix per-fire expansion ellipses — usar `pf.velocidad_kmh` y `pf.direccion`

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx` — useEffect per-fire expansions (~líneas 660-670)

- [ ] **Step 1: Reemplazar las dos líneas de viento global en el efecto per-fire**

Buscar dentro del efecto per-fire (el que usa `expansions.map(pf => ...)`):

```ts
const windDeg = sentinelUpdate?.weather?.deg ?? 315
const windSpeedMs = sentinelUpdate?.weather?.speed ?? 6.7
const hours = EXP_CONFIG[activeExpansion].hours

// Generate ellipse polygon for each fire using its FRP-adjusted spread
const features = expansions.map(pf => {
  const frpFactor = 1 + (pf.frp / 500) * 0.3
  return makeFireSpreadPolygon(pf.lat, pf.lon, windDeg, windSpeedMs * frpFactor, hours)
})
```

Reemplazar con:

```ts
const globalWindDeg   = sentinelUpdate?.weather?.deg   ?? 315
const globalWindSpeed = sentinelUpdate?.weather?.speed ?? 6.7
const hours = EXP_CONFIG[activeExpansion].hours

const features = expansions.map(pf => {
  const pfWindDeg   = directionToDeg(pf.direccion) ?? globalWindDeg
  const pfWindSpeed = pf.velocidad_kmh > 0 ? pf.velocidad_kmh / 3.6 : globalWindSpeed
  const frpFactor   = 1 + (pf.frp / 500) * 0.3
  return makeFireSpreadPolygon(pf.lat, pf.lon, pfWindDeg, pfWindSpeed * frpFactor, hours)
})
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/restry/Desktop/SENTINEL/frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 3: Verificar en browser**

```bash
cd /Users/restry/Desktop/SENTINEL/frontend && pnpm dev
```

Abrir http://localhost:3010/dashboard. Seleccionar distintos focos de incendio y verificar que:
- Las elipses de expansión de distintos focos apuntan en distintas direcciones
- El popup de cada foco muestra el viento local (velocidad y dirección pueden variar por foco)
- Si un foco no tiene `weather` individual, sigue mostrando la elipse (con viento global como fallback)

- [ ] **Step 4: Commit final**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(map): per-fire expansion ellipses use individual wind data from backend"
```
