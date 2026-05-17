# SENTINEL Glaciares — Spec de Diseño
_2026-05-17_

## Objetivo

Agregar la vista **Glaciares** a SENTINEL como una ruta nueva (`/glaciares`), reemplazando todos los datos hardcodeados del prototipo `SENTINELGLACIARES` por datos reales provenientes de GLIMS, Open-Meteo ERA5 y WGMS. El análisis de IA se genera bajo demanda vía OpenRouter (mismo proveedor que `/api/chat`).

---

## Arquitectura

### Rutas nuevas

| Ruta | Descripción |
|------|-------------|
| `frontend/app/glaciares/page.tsx` | Página principal, layout 3 columnas |
| `frontend/app/api/glaciers/route.ts` | GET — GLIMS + Open-Meteo + WGMS + risk score. Edge runtime, `revalidate: 3600` |
| `frontend/app/api/glaciers/analyze/route.ts` | POST — OpenRouter streaming, diagnóstico IA por glaciar |

### Componentes nuevos (`frontend/components/glaciares/`)

| Componente | Responsabilidad |
|-----------|-----------------|
| `glacier-risk-panel.tsx` | Panel izquierdo: gauge SVG, badge categoría, variables de cálculo |
| `glacier-map.tsx` | Mapbox satelital con marcadores reales por coordenada |
| `glacier-kpi-bar.tsx` | Barra superior de KPIs nacionales con mini-sparks |
| `glacier-cards.tsx` | Fila scrollable de cards, una por glaciar |
| `glacier-ai-panel.tsx` | Panel derecho: análisis IA streaming + plan de acción |
| `glacier-detail-drawer.tsx` | Drawer con 3 charts históricos + infraestructura cercana |

### Hook

`frontend/hooks/use-glaciers.ts` — SWR fetch de `/api/glaciers`, gestiona glaciar seleccionado y dispara fetch de análisis IA.

---

## Fuentes de Datos Reales

### 1. GLIMS (Global Land Ice Measurements from Space)
- **Endpoint:** `GET https://www.glims.org/api/glacier.json?bbox=-76,-56,-66,-17`
- **Campos usados:** `glims_id`, `glacier_name`, `latitude`, `longitude`, `area` (km²)
- **Filtro:** área ≥ 0.1 km², se toman los 30+ glaciares con mayor área de Chile
- **Caché:** 24h en la respuesta del API route SENTINEL

### 2. Open-Meteo (temperatura + anomalía ERA5)
- **Endpoint:** `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m&models=era5`
- **Sin API key requerida**
- **Anomalía:** temperatura actual vs. promedio ERA5 1981-2010 del mismo punto
- **`tempHistory`:** últimas 12 lecturas mensuales desde `historical-forecast` API

### 3. WGMS (World Glacier Monitoring Service)
- No tiene REST API pública. Se integra como **dataset estático** bundleado en el proyecto.
- Archivo: `frontend/data/wgms-chile.json` con series de balance de masa para ~12 glaciares chilenos con medición histórica (Echaurren Norte, Balmaceda, Tyndall, San Rafael, Exploradores, Olivares Alfa, Juncal, Martial Este, y otros).
- Para glaciares sin datos WGMS, `massHistory` se estima a partir de la temperatura ERA5.
- Fuente: DOI-WGMS-FoG-2023-09 (descarga pública en wgms.ch)

---

## Tipo de Datos

```typescript
type RiskCat = 'Crítico' | 'Riesgo Alto' | 'Observación' | 'Estable'

interface Glacier {
  id: string              // glims_id normalizado
  glimsId: string         // ID original GLIMS
  name: string            // glacier_name de GLIMS
  region: string          // derivado de lat/lon (rangos por macrozona)
  lat: number
  lon: number
  area: number            // km², desde GLIMS
  elevation?: number      // m.s.n.m., desde GLIMS si disponible

  // Open-Meteo
  tempAnomaly: number     // °C sobre baseline ERA5
  tempHistory: number[]   // 12 meses, anomalía mensual

  // WGMS o estimado
  massHistory: number[]   // balance de masa anual (m EH/año), 10-13 puntos
  areaHistory: number[]   // evolución de superficie (%), 10-13 puntos

  // Calculado
  riesgo: number          // 0–100
  cat: RiskCat
  trend: string           // "Retroceso acelerado" | "Retroceso lento" | "Estable"
  deltaShort: string      // p.ej. "−23%"
  deltaYear: string       // p.ej. "−0.7%/año"
  masaVar: string         // p.ej. "−0.62 m EH/año"
  riskHistory: number[]   // serie histórica del índice de riesgo calculado

  // Contexto (estático por cuenca/región)
  cuenca: string
  poblacion: string
  infra: InfraItem[]      // lookup geográfico por región/cuenca

  // IA (null hasta selección)
  ai?: GlacierAI
}

interface GlacierAI {
  diag: string
  urgency: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA'
  impact: string
  recT: string    // recomendación técnica
  recR: string    // recomendación territorial
}

interface InfraItem {
  t: string   // nombre
  d: string   // distancia
  ic: string  // código icono
}
```

---

## Risk Score (calculado en `/api/glaciers`)

```
riesgo = clamp(round(
  retroceso_area_pct   * 0.30  // delta área histórico GLIMS multi-época
  + temp_anomaly_norm  * 0.25  // anomalía Open-Meteo, normalizada 0–100
  + elevation_factor   * 0.15  // a menor altitud → más vulnerable
  + area_factor        * 0.20  // glaciares pequeños retroceden más rápido
  + cuenca_factor      * 0.10  // peso estático por importancia hídrica de la cuenca
), 0, 100)
```

Umbrales de categoría: ≥76 Crítico | ≥51 Riesgo Alto | ≥26 Observación | <26 Estable

---

## API Route: `GET /api/glaciers`

- **Runtime:** Edge
- **Caché:** `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`
- **Flujo:**
  1. Fetch GLIMS bbox Chile → array de glaciares crudos
  2. Fetch Open-Meteo en paralelo para los top 30 (Promise.all, timeout 8s)
  3. Lookup WGMS desde archivo `wgms-chile.json` en memoria
  4. Calcular risk score + derivar campos de texto
  5. Ordenar por `riesgo` desc, devolver `Glacier[]`
- **Fallback:** si GLIMS falla, servir datos de un fallback file `glaciers-fallback.json` con los 8 glaciares del prototipo pero con coordenadas y áreas reales

---

## API Route: `POST /api/glaciers/analyze`

- **Runtime:** Edge
- **Body:** `{ glacier: Glacier }`
- **Flujo:** construye prompt con datos del glaciar, llama OpenRouter con `mistralai/mistral-large` (mismo modelo que `/api/chat`), retorna stream de texto
- **Prompt:** en español, pide objeto JSON `{ diag, urgency, impact, recT, recR }` a partir de los datos reales
- **Parsing:** el front parsea el JSON del stream cuando está completo (no streaming line-by-line ya que el output es JSON estructurado)

---

## Página `/glaciares`

Layout 3 columnas idéntico al de `/tornado`:
- `h-screen w-screen flex flex-col`
- `<TopBar />` (se agrega la tab "GLACIARES" con badge BETA)
- `<main>` flex-row con 3 columnas responsivas (en móvil: solo mapa + bottom sheet)

**Columna izquierda (320px):** `GlacierRiskPanel` con glaciar seleccionado
**Columna centro:** `GlacierKPIBar` + `GlacierMap` + `GlacierCards`  
**Columna derecha (320px):** `GlacierAIPanel`

Mobile: solo mapa visible, `GlacierDetailDrawer` como bottom sheet al seleccionar.

---

## TopBar

Se agrega la tab GLACIARES en `top-bar.tsx`:
```typescript
{ href: '/glaciares', label: 'GLACIARES', badge: 'BETA' }
```
Y las claves de traducción en `language-context.tsx`:
- `es.navGlaciares: 'GLACIARES'`
- `en.navGlaciares: 'GLACIERS'`

---

## Datos Estáticos Bundleados

### `frontend/data/wgms-chile.json`
Series anuales de balance de masa (m EH/año) para los glaciares chilenos con medición WGMS. Estructura:
```json
{ "ECH": [-0.4, -0.5, ..., -0.91], "TYN": [...], ... }
```

### `frontend/data/glacier-infra.json`
Lookup de infraestructura sensible por cuenca/región (estático). Mapeo: `cuenca_id → InfraItem[]`.

### `frontend/data/glaciers-fallback.json`
Copia de los 8 glaciares del prototipo con datos corregidos a valores reales conocidos (área real, coordenadas reales, temp real). Se usa solo si GLIMS está caído.

---

## Mapa Mapbox

- **Style:** `mapbox://styles/mapbox/satellite-streets-v12`
- **Initial viewport:** `{ lat: -37, lon: -71, zoom: 4 }` (Chile completo)
- **Marcadores:** componentes React sobre Mapbox con diamante SVG coloreado por riesgo
- **Al seleccionar:** zoom animado a `{ lat, lon, zoom: 9 }`, fly-to
- **Layer opcional:** cuencas hidrográficas como GeoJSON line layer (cyan, opacity 0.4)
- **Control de capas:** toggle "Cuencas" en overlay top-right

---

## Contexto / Cuencas (Lookup Estático)

Los campos `cuenca`, `poblacion`, `infra` son estáticos en `glacier-infra.json`, indexados por macrozona geográfica (latitud):
- RM / Valpo → Cuenca Maipo, Aconcagua, dependencia hídrica metropolitana
- O'Higgins → Tinguiririca, Rapel
- Biobío/Araucanía → Biobío
- Los Lagos → Petrohué
- Aysén → Campo de Hielo Norte, Cochrane
- Magallanes → Campo de Hielo Sur, Torres del Paine

---

## Testing

- Test unitario del risk score calculator (función pura)
- Test de integración del API route con mocks de GLIMS + Open-Meteo
- Type-safety total: no `any`, no campos opcionales sin fallback

---

## Out of Scope

- Login/auth para la página (usa `AuthGuard` existente)
- Notificaciones push por cambios de riesgo
- Descarga de informes PDF
- Comparación entre glaciares
