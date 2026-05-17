# Fire Risk Grid Intelligence — Agente 6

Fecha: 2026-05-17
Branch: `valentinmain`
Estado: diseño aprobado

## Objetivo

Reemplazar el resultado actual del Agente 6 (`PredictionResult` + heatmap) por una
grilla de riesgo de incendio sobre todo Chile continental: celdas coloreadas por
categoría, score explicable, y un panel de detalle premium por celda con
infraestructura real y recomendaciones de IA.

## Alcance

- Todo en la branch `valentinmain`.
- NO se toca: mapa base, capa de focos, otros agentes (fire/weather/air/routes/report).
- Ningún consumidor del frontend usa `top_zones` / `analisis_6h|24h|72h` / `confianza`
  (solo `prediction.grid`), por lo que quitar el LLM de `/analyze` no causa regresión.

## Limitación honesta declarada

El FWI (clima) del grid usa **un único punto** de clima — el del orquestador — para
todas las celdas. La variación espacial real proviene del **historial de incendios**
y la **zona de vegetación**. La grilla expone `weather_point` para hacer explícita
esta limitación.

---

## 1. Cobertura y grilla

- bbox continental Chile: lat −56 → −17.5, lon −76 → −66, celdas de 0.25° (~28 km).
- La caja completa son ~6160 celdas; gran parte cae sobre el Pacífico y Argentina.
- **Recorte a tierra por bandas de latitud:** tabla estática `ZONAS_CHILE` con doble
  función — define el rango de longitud continental por banda (recorta océano y
  Argentina) y aporta el score de Terreno. Resultado: ~2.500 celdas de tierra.

### Tabla `ZONAS_CHILE`

| Banda | latMin | latMax | lonMin | lonMax | terreno (0-1) |
|---|---|---|---|---|---|
| Norte Grande (desierto Atacama)       | −26.0 | −17.5 | −70.5 | −67.0 | 0.05 |
| Norte Chico (semiárido)               | −32.0 | −26.0 | −71.7 | −69.5 | 0.25 |
| Zona Central (mediterránea)           | −36.0 | −32.0 | −72.5 | −69.8 | 0.75 |
| Centro-Sur (forestal)                 | −39.0 | −36.0 | −73.7 | −70.8 | 1.00 |
| Araucanía / Los Lagos (bosque templado) | −44.0 | −39.0 | −74.3 | −71.0 | 0.90 |
| Aysén (bosque patagónico húmedo)      | −49.0 | −44.0 | −75.7 | −71.5 | 0.50 |
| Magallanes (estepa fría)              | −56.0 | −49.0 | −75.5 | −66.0 | 0.30 |

Los rangos de longitud son aproximaciones del Chile continental; no requieren
precisión cartográfica para la demo. El score de terreno refleja propensión real a
incendios: máxima en el centro-sur mediterráneo/forestal, mínima en el desierto.

### Generación de celdas

Para cada banda, recorrer lat de `latMin` a `latMax` y lon de `lonMin` a `lonMax`
en pasos de 0.25°. Cada celda:

- `id`: índice **global** (no por banda) para que sea único y estable.
  - columna = `round((lon − (−76)) / 0.25)` → letra(s) A..Z, AA..
  - fila = `round((lat − (−56)) / 0.25)`
  - `id = "<letra>-<fila>"`, ej. `M-17`.
- `lat`, `lon`: esquina suroeste de la celda.
- `size`: 0.25 (grados).
- `score`, `category`, `factors`, `zona`.

El polígono de la celda se construye en el frontend a partir de `lat`/`lon`/`size`.

---

## 2. Modelo de score

`score = round( 0.40 · FWI + 0.35 · Historial + 0.25 · Terreno )`

Cada factor se almacena en escala **0-100**.

### FWI (clima) — 0-100

Del punto único de clima (`WeatherData` del último análisis):

- `drought = (100 − humidity) / 100`
- `wind = min(speed / 20, 1)`
- `temp = clamp((tempC − 15) / 25, 0, 1)` — `tempC` vía `toTempCelsius`
- `fwi01 = min(0.5·drought + 0.3·wind + 0.2·temp, 1)`
- `factors.fwi = round(fwi01 · 100)`

Igual para todas las celdas (limitación declarada).

### Historial — 0-100

Fuentes: tabla `fire_hotspot_history` de Supabase (últimos 30 días) + focos FIRMS
en vivo (`firms` del `AgentRequest`).

**Kernel de proximidad:** cada foco aporta peso a su celda y a celdas vecinas con
caída por distancia, no solo snap exacto:

- Para cada foco, ubicar su celda; sumar peso `1.0` a esa celda.
- Sumar peso decreciente a celdas dentro de un radio de 2 celdas:
  `peso = max(0, 1 − dist_celdas / 3)` donde `dist_celdas` es la distancia en
  unidades de celda (Chebyshev o euclídea sobre índices de grilla).
- Acumular pesos por celda; normalizar dividiendo por el máximo acumulado.
- `factors.historial = round(normalizado · 100)`.

Si no hay datos de historial ni focos, `factors.historial = 0` para todas.

### Terreno — 0-100

`factors.terreno = round(terreno_banda · 100)` según `ZONAS_CHILE`.

### Categorías

| Categoría | Rango score | Color |
|---|---|---|
| `bajo`    | 0–39   | verde   |
| `medio`   | 40–59  | amarillo |
| `alto`    | 60–79  | naranjo |
| `critico` | 80–100 | rojo    |

---

## 3. Backend — agent-prediction (Agente 6)

Servicio Express existente (`packages/agent-prediction`, puerto local 3006).

### `POST /analyze`

- Body: `AgentRequest` (`weather`, `firms`).
- Rápido: sin LLM, sin Overpass.
- Construye la grilla recortada, calcula los 3 factores y el score por celda.
- Respuesta: `AgentResponse<FireRiskGrid>`.

### `POST /cell-detail` (nuevo)

- Body: `{ cell: FireRiskCell }`.
- Calcula el bbox de la celda (`lat`/`lon`/`size`).
- Consulta Overpass API (`https://overpass-api.de/api/interpreter`, sin API key):

  ```
  [out:json][timeout:25];
  (
    node["amenity"~"hospital|school|kindergarten|fire_station|police"](latMin,lonMin,latMax,lonMax);
  );
  out body;
  ```

- Mapea cada nodo a `CellInfrastructure` (descarta nodos sin `name`), calcula la
  distancia al centro de la celda, ordena por distancia.
- Calcula `social_impact` a partir de los conteos ponderados por tipo
  (hospital y jardín infantil = alta vulnerabilidad).
- Llama a Mistral (`callOpenRouter`, `MODELS.large`) con el score, los factores, la
  zona y la lista de infraestructura → `explicacion`, `recomendaciones[]`, `prioridad`.
- Respuesta: `AgentResponse<CellDetail>`.
- Degradación: si Overpass falla → `infrastructure: []`; si Mistral falla → devolver
  el detalle con `explicacion`/`recomendaciones` vacíos pero infraestructura y
  `social_impact` calculados.

## 3b. Backend — packages/backend

- **Orquestador (`orchestrator.ts`):** quitar la llamada a agent-prediction de
  `runAnalysis`; quitar `prediction` del `SentinelUpdate`. Conservar
  `appendFireHistory(fires)` (alimenta el factor Historial).
- **`GET /api/risk-grid` (nuevo):** lee el último `SentinelUpdate` en RAM
  (`last-update` service) para obtener `weather` y `fires`; llama a
  agent-prediction `/analyze`; devuelve `FireRiskGrid`. Si no hay último update,
  usa weather por defecto y `fires: []`. Rate-limited (igual que `/api/trigger`).
- **`POST /api/cell-detail` (nuevo):** reenvía el body a agent-prediction
  `/cell-detail`; devuelve `CellDetail`. Rate-limited.
- Ambos endpoints usan `AGENT_PREDICTION_URL`. El frontend no pasa clima — el
  backend lo toma del último update que ya tiene en RAM.

---

## 4. Frontend

### Next.js API routes (proxy server-side)

- `app/api/risk-grid/route.ts` — `GET` → `${BACKEND_URL}/api/risk-grid`.
- `app/api/cell-detail/route.ts` — `POST` → `${BACKEND_URL}/api/cell-detail`.

Mismo patrón que `app/api/auth/*` y `app/api/last`.

### `mapbox-panel.tsx`

- Eliminar el `useEffect` del heatmap (`prediction-heatmap` / `prediction-grid`).
- Nueva capa de grilla: al activar el toggle, `fetch('/api/risk-grid')` una vez;
  guardar el `FireRiskGrid` en estado; construir un `FeatureCollection` de
  polígonos (uno por celda, desde `lat`/`lon`/`size`) con `category` en
  `properties`.
- Capa `fill` coloreada por `category` (verde/amarillo/naranjo/rojo) +
  capa `line` sutil para los bordes. No toca el mapa base ni los focos.
- `click` sobre la capa de grilla → `POST /api/cell-detail` con la celda →
  abre `fire-risk-cell-panel.tsx`.

### `map-panel.tsx`

- El botón "Predicción A6" pasa a ser el toggle **"Fire Risk Grid"**.
- Mantiene el estado `showGrid`; agrega estado para el `FireRiskGrid` cargado y la
  celda seleccionada / detalle.

### `fire-risk-cell-panel.tsx` (nuevo)

Panel flotante premium, estilo consistente con `fire-detail-overlay.tsx`
(dark, glassmorphism, `bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/20
rounded-lg`). Contenido:

- Anillo de score (0-100) coloreado por categoría.
- Desglose de factores: barras FWI / Historial / Terreno (0-100).
- Infraestructura cercana con distancias (lista de `CellInfrastructure`).
- Recomendaciones de IA (lista) y `explicacion`.
- Badge de prioridad de intervención.
- Estado de carga mientras responde Mistral (~2-4 s).
- Botón de cierre.

---

## 5. Tipos

En `backend/shared/types/index.ts` se reemplazan `PredictionCell` y
`PredictionResult` por los tipos siguientes (espejados en
`frontend/hooks/use-socket.ts`):

```ts
export type RiskCategory = 'bajo' | 'medio' | 'alto' | 'critico'

export interface RiskFactors {
  fwi: number        // 0-100
  historial: number  // 0-100
  terreno: number    // 0-100
}

export interface FireRiskCell {
  id: string                 // ej. "M-17"
  lat: number                // esquina SW
  lon: number
  size: number               // grados (0.25)
  score: number              // 0-100
  category: RiskCategory
  factors: RiskFactors
  zona: string               // nombre de banda de vegetación
}

export interface FireRiskGrid {
  cells: FireRiskCell[]
  generated_at: string
  weather_point: { lat: number; lon: number }   // limitación: clima de un solo punto
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number }
}

export interface CellInfrastructure {
  name: string
  type: 'hospital' | 'school' | 'kindergarten' | 'fire_station' | 'police'
  lat: number
  lon: number
  distance_km: number
}

export interface CellSocialImpact {
  score: number              // 0-100
  poblacion_estimada?: number
  resumen: string
}

export interface CellDetail {
  cell_id: string
  infrastructure: CellInfrastructure[]
  social_impact: CellSocialImpact
  explicacion: string                                    // Mistral
  recomendaciones: string[]                              // Mistral
  prioridad: 'baja' | 'media' | 'alta' | 'critica'       // Mistral
}
```

- Quitar `PredictionResult` de `SentinelUpdate` y de `AgentResponse` usages en el
  orquestador.
- El endpoint `/cell-detail` usa su propio body (`{ cell: FireRiskCell }`), no el
  `AgentRequest` estándar.

---

## Riesgos y degradación

- **Overpass** puede ser lento o estar saturado, y la cobertura en zonas remotas de
  Chile es escasa → tratar respuesta vacía o error como `infrastructure: []`.
- **Mistral** puede fallar → devolver `CellDetail` con `explicacion`/
  `recomendaciones` vacíos, sin romper el panel.
- **Sin último update** en el backend → el grid se calcula con clima por defecto y
  sin focos en vivo (solo historial de Supabase).
- El cold start de Render (~30-60 s) aplica también a agent-prediction en la
  primera llamada de `/api/risk-grid`; el frontend debe mostrar estado de carga.
