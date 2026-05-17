# Diseño: Proyecciones por foco con viento real

**Fecha:** 2026-05-16  
**Archivo afectado:** `frontend/components/dashboard/mapbox-panel.tsx`  
**Archivo secundario:** `frontend/contexts/fire-selection-context.tsx`

---

## Problema

Las proyecciones de expansión de incendios (elipses 2h/6h/12h) siempre tienen la misma forma y dirección porque el código usa un único viento global (`sentinelUpdate.weather.deg/speed`) para todos los focos. El backend ya envía viento por foco en `FireData.weather` y `PerFireExpansion.velocidad_kmh/direccion`, pero el frontend los ignora.

---

## Solución

Usar los datos reales por foco donde existan, con fallback al viento global cuando no.

---

## Cambios

### 1. `fire-selection-context.tsx` — Ampliar `SelectedFireData`

Agregar campo `weather` opcional:

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

### 2. `mapbox-panel.tsx` — Click handler

Dentro del click handler (en el efecto de fire markers), calcular los valores del viento usando el clima del foco clickeado si existe:

```ts
const fWeather = props.weatherJson ? JSON.parse(props.weatherJson) : null
const fireWDeg   = fWeather?.deg   ?? wDeg
const fireWSpeed = fWeather?.speed ?? wSpeed
const fireSDeg   = (fireWDeg + 180) % 360
const fireSDirLabel = degToCompass(fireSDeg)
const fireWKmh   = Math.round(fireWSpeed * 3.6)
const fireA2  = computeFireSpreadArea(fireWSpeed, 2)
const fireA6  = computeFireSpreadArea(fireWSpeed, 6)
const fireA12 = computeFireSpreadArea(fireWSpeed, 12)
```

Pasar estos valores (en lugar de los globales) a `popupData` y a `setSelectedFire`.  
También pasar `weather: fWeather ?? undefined` a `setSelectedFire`.

### 3. `mapbox-panel.tsx` — "Draw expansion" useEffect

Reemplazar:
```ts
const windDeg     = sentinelUpdate?.weather?.deg   ?? 315
const windSpeedMs = sentinelUpdate?.weather?.speed ?? 6.7
```
Por:
```ts
const windDeg     = selectedFire?.weather?.deg   ?? sentinelUpdate?.weather?.deg   ?? 315
const windSpeedMs = selectedFire?.weather?.speed ?? sentinelUpdate?.weather?.speed ?? 6.7
```

### 4. `mapbox-panel.tsx` — Helper `directionToDeg`

Agregar función pura que convierte un string de dirección a grados meteorológicos:

```ts
function directionToDeg(dir: string): number | null {
  const map: Record<string, number> = {
    'N': 0, 'NORTE': 0,
    'NNE': 22.5, 'NNO': 337.5, 'NNO': 337.5,
    'NE': 45, 'NORESTE': 45,
    'ENE': 67.5,
    'E': 90, 'ESTE': 90,
    'ESE': 112.5,
    'SE': 135, 'SURESTE': 135,
    'SSE': 157.5,
    'S': 180, 'SUR': 180,
    'SSO': 202.5,
    'SO': 225, 'SUROESTE': 225, 'SW': 225,
    'OSO': 247.5, 'WSW': 247.5,
    'O': 270, 'OESTE': 270, 'W': 270,
    'ONO': 292.5, 'WNW': 292.5,
    'NO': 315, 'NOROESTE': 315, 'NW': 315,
    'NNO': 337.5, 'NNW': 337.5,
  }
  return map[dir.toUpperCase().trim()] ?? null
}
```

### 5. `mapbox-panel.tsx` — Per-fire expansions useEffect

Reemplazar el viento global por datos del `PerFireExpansion`:

```ts
const features = expansions.map(pf => {
  const pfWindDeg   = directionToDeg(pf.direccion) ?? (sentinelUpdate?.weather?.deg ?? 315)
  const pfWindSpeed = (pf.velocidad_kmh / 3.6)
  const frpFactor   = 1 + (pf.frp / 500) * 0.3
  return makeFireSpreadPolygon(pf.lat, pf.lon, pfWindDeg, pfWindSpeed * frpFactor, hours)
})
```

---

## Flujo de datos

```
Backend → FireData.weather.deg/speed (por foco)
        → PerFireExpansion.velocidad_kmh + .direccion (por foco)

Frontend (click handler):
  fWeather = JSON.parse(props.weatherJson)  // clima real del foco
  → popup y setSelectedFire usan fireWDeg/fireWSpeed/fireSDirLabel

Frontend (draw expansion):
  selectedFire.weather?.deg  →  windDeg para la elipse del foco seleccionado

Frontend (per-fire ellipses):
  directionToDeg(pf.direccion) + pf.velocidad_kmh/3.6  →  windDeg/windSpeedMs por foco
```

---

## Comportamiento esperado

- Cada foco seleccionado muestra su elipse en la dirección real del viento local
- Las elipses de fondo (per-fire) apuntan en la dirección que reportó el agente para ese foco
- El popup muestra la dirección y velocidad del viento local al foco
- Si no hay datos por foco (campo `weather` ausente), se usa el viento global como fallback
