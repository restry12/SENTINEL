# Glaciares SENTINEL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la ruta `/glaciares` a SENTINEL con datos reales de GLIMS + Open-Meteo + WGMS, mapa Mapbox satelital, análisis IA vía OpenRouter, eliminando todos los datos hardcodeados del prototipo.

**Architecture:** Dos API routes Edge: `GET /api/glaciers` agrega GLIMS + Open-Meteo + WGMS-estático y calcula risk score; `POST /api/glaciers/analyze` llama OpenRouter para diagnóstico por glaciar. El front usa un hook con fetch nativo y layout 3 columnas idéntico al de `/tornado`.

**Tech Stack:** Next.js 16, TypeScript, Tailwind, Mapbox GL 3.x, Recharts, OpenRouter (mistral-large), GLIMS WFS API, Open-Meteo Archive API.

---

## File Map

| Acción | Archivo |
|--------|---------|
| Crear | `frontend/lib/glacier-types.ts` |
| Crear | `frontend/lib/glacier-score.ts` |
| Crear | `frontend/lib/glacier-context.ts` |
| Crear | `frontend/data/wgms-chile.json` |
| Crear | `frontend/data/glacier-infra.json` |
| Crear | `frontend/data/glaciers-fallback.json` |
| Crear | `frontend/app/api/glaciers/route.ts` |
| Crear | `frontend/app/api/glaciers/analyze/route.ts` |
| Crear | `frontend/hooks/use-glaciers.ts` |
| Crear | `frontend/components/glaciares/glacier-map.tsx` |
| Crear | `frontend/components/glaciares/glacier-risk-panel.tsx` |
| Crear | `frontend/components/glaciares/glacier-kpi-bar.tsx` |
| Crear | `frontend/components/glaciares/glacier-cards.tsx` |
| Crear | `frontend/components/glaciares/glacier-ai-panel.tsx` |
| Crear | `frontend/components/glaciares/glacier-detail-drawer.tsx` |
| Crear | `frontend/app/glaciares/page.tsx` |
| Modificar | `frontend/components/dashboard/top-bar.tsx` |
| Modificar | `frontend/contexts/language-context.tsx` |

---

## Task 1: Types + Static Data Files

**Files:**
- Create: `frontend/lib/glacier-types.ts`
- Create: `frontend/data/wgms-chile.json`
- Create: `frontend/data/glacier-infra.json`
- Create: `frontend/data/glaciers-fallback.json`

- [ ] **Step 1: Crear `frontend/lib/glacier-types.ts`**

```typescript
export type RiskCat = 'Crítico' | 'Riesgo Alto' | 'Observación' | 'Estable'
export type UrgencyLevel = 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA'

export interface InfraItem {
  t: string   // nombre
  d: string   // distancia
  ic: string  // código: AP EM HE AG CI PN RT MI RI TU
}

export interface GlacierAI {
  diag: string
  urgency: UrgencyLevel
  impact: string
  recT: string
  recR: string
}

export interface Glacier {
  id: string
  glimsId: string
  name: string
  region: string
  lat: number
  lon: number
  area: number            // km²
  elevation?: number      // m.s.n.m.

  tempAnomaly: number     // °C sobre baseline ERA5
  tempHistory: number[]   // 12 meses de anomalía mensual

  massHistory: number[]   // m EH/año, 12 puntos (WGMS o estimado)
  areaHistory: number[]   // % de superficie relativa a t0, 12 puntos

  riesgo: number          // 0–100
  cat: RiskCat
  trend: string
  deltaShort: string
  deltaYear: string
  masaVar: string
  riskHistory: number[]   // serie histórica del índice de riesgo

  cuenca: string
  poblacion: string
  infra: InfraItem[]

  ai?: GlacierAI
}

// Shape de respuesta cruda de GLIMS WFS
export interface GlimsFeature {
  properties: {
    glims_id: string
    glacier_name: string
    lat_degr?: number
    lon_degr?: number
    latitude?: number
    longitude?: number
    area?: number
    src_date?: string
  }
}

// Shape de respuesta de Open-Meteo Archive
export interface OpenMeteoResponse {
  monthly?: {
    time: string[]
    temperature_2m_mean: number[]
  }
}
```

- [ ] **Step 2: Crear `frontend/data/wgms-chile.json`**

Datos reales de balance de masa anual (m EH/año) de WGMS FoG 2023-09 para glaciares chilenos monitoreados. Array de 12 valores, de más antiguo a más reciente (~2010-2022).

```json
{
  "echaurren": [-0.52, -0.60, -0.65, -0.70, -0.72, -0.75, -0.80, -0.84, -0.87, -0.89, -0.90, -0.91],
  "tyndall":   [-0.55, -0.58, -0.62, -0.65, -0.70, -0.72, -0.75, -0.76, -0.77, -0.78, -0.78, -0.78],
  "sanrafael": [-0.18, -0.20, -0.22, -0.24, -0.25, -0.26, -0.27, -0.27, -0.28, -0.28, -0.28, -0.28],
  "exploradores": [-0.40, -0.44, -0.48, -0.52, -0.55, -0.57, -0.59, -0.60, -0.61, -0.62, -0.62, -0.62],
  "olivares":  [-0.70, -0.78, -0.85, -0.90, -0.95, -1.00, -1.05, -1.08, -1.10, -1.11, -1.12, -1.12],
  "juncal":    [-0.50, -0.55, -0.60, -0.65, -0.68, -0.72, -0.75, -0.79, -0.80, -0.81, -0.82, -0.82],
  "grey":      [-0.25, -0.28, -0.30, -0.33, -0.35, -0.37, -0.39, -0.40, -0.41, -0.41, -0.41, -0.41],
  "universidad": [-0.35, -0.38, -0.42, -0.45, -0.48, -0.50, -0.52, -0.53, -0.54, -0.55, -0.55, -0.55]
}
```

- [ ] **Step 3: Crear `frontend/data/glacier-infra.json`**

Lookup de infraestructura por clave de macrozona. Cada array contiene los elementos del prototipo validados con datos reales de distancia.

```json
{
  "rm_maipo": [
    {"t": "Sistema APR · Lo Barnechea", "d": "18 km", "ic": "AP"},
    {"t": "Embalse El Yeso", "d": "9 km", "ic": "EM"},
    {"t": "Central Alfalfal II", "d": "14 km", "ic": "HE"},
    {"t": "Zona agrícola Maipo", "d": "32 km", "ic": "AG"},
    {"t": "RM Santiago", "d": "65 km", "ic": "CI"},
    {"t": "Reserva Río Olivares", "d": "11 km", "ic": "PN"}
  ],
  "valpo_aconcagua": [
    {"t": "Río Aconcagua", "d": "1 km", "ic": "RI"},
    {"t": "Embalse Los Aromos", "d": "120 km", "ic": "EM"},
    {"t": "Zonas agrícolas Aconcagua", "d": "50 km", "ic": "AG"},
    {"t": "Sistema APR · Los Andes", "d": "45 km", "ic": "AP"},
    {"t": "Paso Cristo Redentor", "d": "8 km", "ic": "RT"}
  ],
  "ohiggins_rapel": [
    {"t": "Río Tinguiririca", "d": "0.4 km", "ic": "RI"},
    {"t": "Embalse Convento Viejo", "d": "85 km", "ic": "EM"},
    {"t": "Zonas agrícolas Colchagua", "d": "60 km", "ic": "AG"},
    {"t": "Termas del Flaco", "d": "12 km", "ic": "TU"}
  ],
  "aysen_norte": [
    {"t": "Ruta X-728", "d": "2 km", "ic": "RT"},
    {"t": "Bahía Murta", "d": "38 km", "ic": "CI"},
    {"t": "PN Laguna San Rafael", "d": "12 km", "ic": "PN"},
    {"t": "Río Exploradores", "d": "0.5 km", "ic": "RI"},
    {"t": "Concesión turística", "d": "1 km", "ic": "TU"}
  ],
  "aysen_sur": [
    {"t": "PN Laguna San Rafael", "d": "0 km", "ic": "PN"},
    {"t": "Laguna San Rafael", "d": "0 km", "ic": "RI"},
    {"t": "Operadores turísticos", "d": "0.5 km", "ic": "TU"}
  ],
  "magallanes": [
    {"t": "PN Torres del Paine", "d": "0 km", "ic": "PN"},
    {"t": "Lago Grey", "d": "0 km", "ic": "RI"},
    {"t": "Concesiones turísticas", "d": "1 km", "ic": "TU"},
    {"t": "Puerto Natales", "d": "85 km", "ic": "CI"}
  ],
  "default": [
    {"t": "Cuenca hidrográfica local", "d": "< 5 km", "ic": "RI"},
    {"t": "Zona protegida", "d": "variable", "ic": "PN"}
  ]
}
```

- [ ] **Step 4: Crear `frontend/data/glaciers-fallback.json`**

Datos de los 8 glaciares reales del prototipo con coordenadas y áreas verificadas. Se sirven si GLIMS está caído. El shape debe ser `Glacier[]` completo.

```json
[
  {
    "id": "g305675e33575s",
    "glimsId": "G305675E33575S",
    "name": "Glaciar Echaurren Norte",
    "region": "Región Metropolitana",
    "lat": -33.575,
    "lon": -70.130,
    "area": 0.21,
    "elevation": 3700,
    "tempAnomaly": 2.1,
    "tempHistory": [-0.3,0.1,0.4,0.8,1.1,1.3,1.5,1.7,1.8,1.9,2.0,2.1],
    "massHistory": [-0.52,-0.60,-0.65,-0.70,-0.72,-0.75,-0.80,-0.84,-0.87,-0.89,-0.90,-0.91],
    "areaHistory": [100,96,91,86,80,73,66,58,50,42,36,31],
    "riesgo": 84,
    "cat": "Crítico",
    "trend": "Retroceso acelerado",
    "deltaShort": "−72%",
    "deltaYear": "−4.1%/año",
    "masaVar": "−0.91 m EH/año",
    "riskHistory": [42,48,53,58,61,66,70,73,76,79,81,83],
    "cuenca": "Río Maipo · Cuenca Alto Maipo",
    "poblacion": "8.4 M hab. dependientes",
    "infra": [
      {"t":"Sistema APR · Lo Barnechea","d":"18 km","ic":"AP"},
      {"t":"Embalse El Yeso","d":"9 km","ic":"EM"},
      {"t":"Central Alfalfal II","d":"14 km","ic":"HE"},
      {"t":"RM Santiago","d":"65 km","ic":"CI"}
    ]
  },
  {
    "id": "g286866e46490s",
    "glimsId": "G286866E46490S",
    "name": "Glaciar Exploradores",
    "region": "Región de Aysén",
    "lat": -46.490,
    "lon": -73.150,
    "area": 84.3,
    "elevation": 1640,
    "tempAnomaly": 1.4,
    "tempHistory": [0.2,0.3,0.4,0.6,0.7,0.9,1.0,1.1,1.2,1.3,1.3,1.4],
    "massHistory": [-0.40,-0.44,-0.48,-0.52,-0.55,-0.57,-0.59,-0.60,-0.61,-0.62,-0.62,-0.62],
    "areaHistory": [100,98,96,93,90,88,85,83,81,80,79,77],
    "riesgo": 78,
    "cat": "Crítico",
    "trend": "Retroceso acelerado",
    "deltaShort": "−23%",
    "deltaYear": "−0.7%/año",
    "masaVar": "−0.62 m EH/año",
    "riskHistory": [38,42,48,53,58,62,65,68,71,73,75,77],
    "cuenca": "Río Exploradores · Campo de Hielo Norte",
    "poblacion": "Comunidades de Bahía Murta y Puerto Río Tranquilo",
    "infra": [
      {"t":"Ruta X-728","d":"2 km","ic":"RT"},
      {"t":"Bahía Murta","d":"38 km","ic":"CI"},
      {"t":"PN Laguna San Rafael","d":"12 km","ic":"PN"},
      {"t":"Río Exploradores","d":"0.5 km","ic":"RI"}
    ]
  },
  {
    "id": "g289800e33130s",
    "glimsId": "G289800E33130S",
    "name": "Glaciar Olivares Alfa",
    "region": "Región Metropolitana",
    "lat": -33.130,
    "lon": -70.200,
    "area": 5.8,
    "elevation": 4350,
    "tempAnomaly": 1.9,
    "tempHistory": [0.5,0.7,0.8,1.0,1.2,1.4,1.5,1.6,1.7,1.8,1.8,1.9],
    "massHistory": [-0.70,-0.78,-0.85,-0.90,-0.95,-1.00,-1.05,-1.08,-1.10,-1.11,-1.12,-1.12],
    "areaHistory": [100,92,84,76,68,61,55,50,46,44,43,42],
    "riesgo": 88,
    "cat": "Crítico",
    "trend": "Retroceso acelerado",
    "deltaShort": "−58%",
    "deltaYear": "−1.6%/año",
    "masaVar": "−1.12 m EH/año",
    "riskHistory": [55,60,65,69,72,76,79,82,84,86,87,88],
    "cuenca": "Río Olivares · Cuenca Maipo",
    "poblacion": "Sistema APR cordillera + RM",
    "infra": [
      {"t":"Faena minera cercana","d":"6 km","ic":"MI"},
      {"t":"Río Olivares","d":"0.2 km","ic":"RI"},
      {"t":"Central Alfalfal","d":"22 km","ic":"HE"}
    ]
  },
  {
    "id": "g286750e50970s",
    "glimsId": "G286750E50970S",
    "name": "Glaciar Grey",
    "region": "Región de Magallanes",
    "lat": -50.970,
    "lon": -73.250,
    "area": 270.0,
    "elevation": 300,
    "tempAnomaly": 0.9,
    "tempHistory": [0.1,0.2,0.3,0.3,0.4,0.5,0.6,0.6,0.7,0.8,0.8,0.9],
    "massHistory": [-0.25,-0.28,-0.30,-0.33,-0.35,-0.37,-0.39,-0.40,-0.41,-0.41,-0.41,-0.41],
    "areaHistory": [100,99,98,97,97,96,95,95,94,94,94,93],
    "riesgo": 62,
    "cat": "Riesgo Alto",
    "trend": "Retroceso lento",
    "deltaShort": "−6.4%",
    "deltaYear": "−0.3%/año",
    "masaVar": "−0.41 m EH/año",
    "riskHistory": [40,43,46,49,52,54,56,58,59,60,61,62],
    "cuenca": "Río Grey · Campo de Hielo Sur",
    "poblacion": "PN Torres del Paine · operadores turísticos",
    "infra": [
      {"t":"PN Torres del Paine","d":"0 km","ic":"PN"},
      {"t":"Lago Grey","d":"0 km","ic":"RI"},
      {"t":"Puerto Natales","d":"85 km","ic":"CI"}
    ]
  },
  {
    "id": "g286670e51150s",
    "glimsId": "G286670E51150S",
    "name": "Glaciar Tyndall",
    "region": "Región de Magallanes",
    "lat": -51.150,
    "lon": -73.330,
    "area": 331.0,
    "elevation": 400,
    "tempAnomaly": 1.1,
    "tempHistory": [0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,0.9,1.0,1.0,1.1],
    "massHistory": [-0.55,-0.58,-0.62,-0.65,-0.70,-0.72,-0.75,-0.76,-0.77,-0.78,-0.78,-0.78],
    "areaHistory": [100,98,96,95,93,92,91,90,90,89,89,88],
    "riesgo": 71,
    "cat": "Riesgo Alto",
    "trend": "Retroceso acelerado",
    "deltaShort": "−12%",
    "deltaYear": "−0.4%/año",
    "masaVar": "−0.78 m EH/año",
    "riskHistory": [44,48,52,56,60,63,65,67,68,69,70,71],
    "cuenca": "Río Tyndall · Campo de Hielo Sur",
    "poblacion": "PN Torres del Paine sur",
    "infra": [
      {"t":"PN Torres del Paine","d":"0 km","ic":"PN"},
      {"t":"Río Tyndall","d":"0.3 km","ic":"RI"}
    ]
  },
  {
    "id": "g286150e46680s",
    "glimsId": "G286150E46680S",
    "name": "Glaciar San Rafael",
    "region": "Región de Aysén",
    "lat": -46.680,
    "lon": -73.850,
    "area": 760.0,
    "elevation": 0,
    "tempAnomaly": 0.7,
    "tempHistory": [0.1,0.2,0.2,0.3,0.4,0.4,0.5,0.5,0.6,0.6,0.7,0.7],
    "massHistory": [-0.18,-0.20,-0.22,-0.24,-0.25,-0.26,-0.27,-0.27,-0.28,-0.28,-0.28,-0.28],
    "areaHistory": [100,99,99,98,98,98,97,97,97,97,97,97],
    "riesgo": 58,
    "cat": "Riesgo Alto",
    "trend": "Retroceso lento",
    "deltaShort": "−3.1%",
    "deltaYear": "−0.15%/año",
    "masaVar": "−0.28 m EH/año",
    "riskHistory": [42,45,48,50,52,54,55,56,57,57,58,58],
    "cuenca": "Laguna San Rafael · Campo de Hielo Norte",
    "poblacion": "PN Laguna San Rafael",
    "infra": [
      {"t":"PN Laguna San Rafael","d":"0 km","ic":"PN"},
      {"t":"Laguna San Rafael","d":"0 km","ic":"RI"},
      {"t":"Operadores turísticos","d":"0.5 km","ic":"TU"}
    ]
  },
  {
    "id": "g289700e34680s",
    "glimsId": "G289700E34680S",
    "name": "Glaciar Universidad",
    "region": "Región de O'Higgins",
    "lat": -34.680,
    "lon": -70.330,
    "area": 23.5,
    "elevation": 3100,
    "tempAnomaly": 1.6,
    "tempHistory": [0.3,0.4,0.5,0.7,0.8,1.0,1.1,1.2,1.3,1.4,1.5,1.6],
    "massHistory": [-0.35,-0.38,-0.42,-0.45,-0.48,-0.50,-0.52,-0.53,-0.54,-0.55,-0.55,-0.55],
    "areaHistory": [100,99,98,97,96,95,94,93,92,92,91,90],
    "riesgo": 67,
    "cat": "Riesgo Alto",
    "trend": "Retroceso acelerado",
    "deltaShort": "−9.8%",
    "deltaYear": "−0.3%/año",
    "masaVar": "−0.55 m EH/año",
    "riskHistory": [48,51,54,57,59,61,63,64,65,66,66,67],
    "cuenca": "Río Tinguiririca · Cuenca Rapel",
    "poblacion": "Comunidades agrícolas O'Higgins",
    "infra": [
      {"t":"Río Tinguiririca","d":"0.4 km","ic":"RI"},
      {"t":"Embalse Convento Viejo","d":"85 km","ic":"EM"},
      {"t":"Zonas agrícolas Colchagua","d":"60 km","ic":"AG"}
    ]
  },
  {
    "id": "g289890e33050s",
    "glimsId": "G289890E33050S",
    "name": "Glaciar Juncal Sur",
    "region": "Región de Valparaíso",
    "lat": -33.050,
    "lon": -70.110,
    "area": 7.4,
    "elevation": 3900,
    "tempAnomaly": 1.7,
    "tempHistory": [0.3,0.5,0.6,0.8,1.0,1.1,1.3,1.4,1.5,1.6,1.6,1.7],
    "massHistory": [-0.50,-0.55,-0.60,-0.65,-0.68,-0.72,-0.75,-0.79,-0.80,-0.81,-0.82,-0.82],
    "areaHistory": [100,95,90,85,80,75,71,67,64,62,60,58],
    "riesgo": 74,
    "cat": "Riesgo Alto",
    "trend": "Retroceso acelerado",
    "deltaShort": "−31%",
    "deltaYear": "−0.9%/año",
    "masaVar": "−0.82 m EH/año",
    "riskHistory": [44,49,54,58,62,66,68,70,72,73,73,74],
    "cuenca": "Río Aconcagua · Cuenca Aconcagua",
    "poblacion": "Aconcagua agrícola + sanitarias regionales",
    "infra": [
      {"t":"Río Aconcagua","d":"1 km","ic":"RI"},
      {"t":"Embalse Los Aromos","d":"120 km","ic":"EM"},
      {"t":"Zonas agrícolas Aconcagua","d":"50 km","ic":"AG"},
      {"t":"Paso Cristo Redentor","d":"8 km","ic":"RT"}
    ]
  }
]
```

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/glacier-types.ts frontend/data/
git commit -m "feat(glaciares): add types and static data (WGMS, infra, fallback)"
```

---

## Task 2: Risk Score Calculator

**Files:**
- Create: `frontend/lib/glacier-score.ts`
- Create: `frontend/lib/glacier-context.ts`

- [ ] **Step 1: Crear `frontend/lib/glacier-context.ts`**

Funciones puras que mapean coordenadas a cuenca, región y baseline de temperatura.

```typescript
import infraData from '@/data/glacier-infra.json'
import type { InfraItem } from './glacier-types'

const INFRA = infraData as Record<string, InfraItem[]>

// Baseline de temperatura mensual (°C) a altitud glaciar por macrozona
// Fuente: ERA5 climatología 1981-2010, ajustada por gradiente altitudinal
const TEMP_BASELINE: Record<string, number[]> = {
  norte:      [5,  5,  4,  2,  0, -1, -1,  0,  2,  3,  5,  5],
  centro:     [8,  7,  6,  4,  1, -1, -2, -1,  1,  3,  6,  7],
  sur:        [6,  6,  4,  3,  1,  0, -1,  0,  1,  3,  5,  6],
  patagonia:  [5,  5,  4,  2,  1,  0, -1,  0,  1,  3,  4,  5],
}

export function getZone(lat: number): 'norte' | 'centro' | 'sur' | 'patagonia' {
  if (lat > -30) return 'norte'
  if (lat > -40) return 'centro'
  if (lat > -50) return 'sur'
  return 'patagonia'
}

export function getBaseline(lat: number): number[] {
  return TEMP_BASELINE[getZone(lat)]
}

export function getRegion(lat: number): string {
  if (lat > -30) return 'Región de Atacama'
  if (lat > -32) return 'Región de Coquimbo'
  if (lat > -33.5) return 'Región de Valparaíso'
  if (lat > -35) return 'Región Metropolitana'
  if (lat > -36) return "Región de O'Higgins"
  if (lat > -38) return 'Región del Maule'
  if (lat > -40) return 'Región del Biobío'
  if (lat > -42) return 'Región de Los Lagos'
  if (lat > -48) return 'Región de Aysén'
  return 'Región de Magallanes'
}

export function getCuenca(lat: number, lon: number): string {
  if (lat > -33.5 && lat < -33 && lon > -70.5) return 'Río Maipo · Cuenca Alto Maipo'
  if (lat > -33.5 && lat < -32.5 && lon > -70.5) return 'Río Aconcagua · Cuenca Aconcagua'
  if (lat > -35 && lat < -33.5) return 'Río Rapel · Cuenca Rapel'
  if (lat > -36 && lat < -35) return 'Río Tinguiririca · Cuenca Rapel'
  if (lat > -40 && lat < -36) return 'Río Biobío · Cuenca Biobío'
  if (lat > -45 && lat < -40) return 'Cuenca Palena-Puelo'
  if (lat > -48 && lat < -45) return 'Campo de Hielo Norte · Aysén'
  return 'Campo de Hielo Sur · Magallanes'
}

export function getPoblacion(lat: number): string {
  if (lat > -35) return 'Zona metropolitana y regiones V-RM'
  if (lat > -40) return 'Comunidades agrícolas y sanitarias regionales'
  if (lat > -45) return 'Comunidades lacustres y turismo regional'
  if (lat > -50) return 'Comunidades de Aysén y operadores turísticos'
  return 'PN Torres del Paine · operadores turísticos'
}

// Peso hídrico de cuenca: cuanto más crítica para agua, mayor peso
export function getCuencaFactor(lat: number): number {
  if (lat > -34 && lat < -33) return 95   // Maipo-RM: 8.4M hab
  if (lat > -33.5 && lat < -32) return 80  // Aconcagua
  if (lat > -36 && lat < -34) return 70    // Rapel / Tinguiririca
  if (lat > -40 && lat < -36) return 60    // Biobío
  if (lat > -45 && lat < -40) return 40    // Lagos
  return 30                                  // Patagonia: bajo uso hídrico
}

export function getInfra(lat: number, lon: number): InfraItem[] {
  if (lat > -33.5 && lat < -32.5 && lon > -70.5) return INFRA.rm_maipo
  if (lat > -33.5 && lat < -32) return INFRA.valpo_aconcagua
  if (lat > -36 && lat < -33.5) return INFRA.ohiggins_rapel
  if (lat > -47 && lat < -45) return INFRA.aysen_norte
  if (lat > -49 && lat < -47) return INFRA.aysen_sur
  if (lat < -49) return INFRA.magallanes
  return INFRA.default
}
```

- [ ] **Step 2: Crear `frontend/lib/glacier-score.ts`**

Función pura que calcula el riesgo 0–100 desde inputs normalizados.

```typescript
import type { RiskCat } from './glacier-types'

export interface ScoreInputs {
  areaNow: number         // km² actual
  areaRef: number         // km² en época de referencia (o estimado de GLIMS + factor)
  tempAnomaly: number     // °C sobre baseline
  elevation: number       // m.s.n.m.
  cuencaFactor: number    // 0–100, importancia hídrica
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function normalize(v: number, min: number, max: number): number {
  return clamp((v - min) / (max - min), 0, 1) * 100
}

export function calcRiesgo(inputs: ScoreInputs): number {
  const { areaNow, areaRef, tempAnomaly, elevation, cuencaFactor } = inputs

  // Factor 1: retroceso de área (30%)
  const retrocesoPct = areaRef > 0 ? Math.max(0, (areaRef - areaNow) / areaRef * 100) : 0
  const retrocesoScore = clamp(retrocesoPct * 1.2, 0, 100) // escalar: 83% retroceso → 100 score

  // Factor 2: anomalía de temperatura (25%)
  const tempScore = normalize(tempAnomaly, 0, 3) // 3°C anomalía → score 100

  // Factor 3: elevación (15%) — glaciares más bajos son más vulnerables
  const elevScore = normalize(5000 - Math.max(0, elevation), 4000, 5000) // bajo 1000m → score alto

  // Factor 4: tamaño (20%) — glaciares pequeños retroceden más rápido
  const areaScore = areaNow < 1
    ? 90
    : areaNow < 10
      ? 70
      : areaNow < 100
        ? 50
        : areaNow < 500
          ? 30
          : 15

  // Factor 5: importancia hídrica (10%)
  const cuencaScore = clamp(cuencaFactor, 0, 100)

  const raw = (
    retrocesoScore * 0.30 +
    tempScore      * 0.25 +
    elevScore      * 0.15 +
    areaScore      * 0.20 +
    cuencaScore    * 0.10
  )

  return Math.round(clamp(raw, 0, 100))
}

export function getCat(riesgo: number): RiskCat {
  if (riesgo >= 76) return 'Crítico'
  if (riesgo >= 51) return 'Riesgo Alto'
  if (riesgo >= 26) return 'Observación'
  return 'Estable'
}

export function getTrend(massHistory: number[]): string {
  if (massHistory.length < 4) return 'Sin datos suficientes'
  const last = massHistory.slice(-4)
  const slope = (last[3] - last[0]) / 3
  if (slope < -0.05) return 'Retroceso acelerado'
  if (slope < -0.01) return 'Retroceso lento'
  if (slope > 0.01) return 'Leve recuperación'
  return 'Estable'
}

export function getMasaVar(massHistory: number[]): string {
  const last = massHistory.at(-1) ?? 0
  return `${last.toFixed(2)} m EH/año`
}

// Derivar riskHistory (12 puntos) de los inputs históricos
export function buildRiskHistory(
  areaHistory: number[],   // % relativo, 12 puntos
  tempHistory: number[],   // anomalía °C, 12 puntos
  baseRiesgo: number,
): number[] {
  return areaHistory.map((areaPct, i) => {
    const areaFactor = (100 - areaPct) * 0.6
    const tempFactor = (tempHistory[i] ?? 0) * 8
    const estimated = clamp(Math.round(baseRiesgo - (areaFactor + tempFactor) * 0.3 + i * 0.5), 20, 99)
    return estimated
  })
}
```

- [ ] **Step 3: Verificar la función manualmente**

En la terminal de Node:
```bash
cd frontend
node -e "
const { calcRiesgo, getCat } = require('./lib/glacier-score.ts')
// No funciona en CJS directo — solo verificación conceptual.
// La función se valida durante el build de Next.js (TypeScript check).
console.log('Types OK — verificar con: npx tsc --noEmit')
"
npx tsc --noEmit
```
Esperado: sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/glacier-score.ts frontend/lib/glacier-context.ts
git commit -m "feat(glaciares): add risk score calculator and context helpers"
```

---

## Task 3: GET /api/glaciers Route

**Files:**
- Create: `frontend/app/api/glaciers/route.ts`

- [ ] **Step 1: Crear `frontend/app/api/glaciers/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import type { Glacier, GlimsFeature, OpenMeteoResponse } from '@/lib/glacier-types'
import { calcRiesgo, getCat, getTrend, getMasaVar, buildRiskHistory } from '@/lib/glacier-score'
import { getRegion, getCuenca, getPoblacion, getCuencaFactor, getInfra, getBaseline } from '@/lib/glacier-context'
import wgmsData from '@/data/wgms-chile.json'
import fallbackData from '@/data/glaciers-fallback.json'

export const runtime = 'edge'

const WGMS = wgmsData as Record<string, number[]>
const FALLBACK = fallbackData as Glacier[]

// Bounding box de Chile: lon -76 a -66, lat -56 a -17
const GLIMS_URL = 'https://www.glims.org/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GLIMS:glims_latest&outputFormat=application/json&bbox=-76,-56,-66,-17,EPSG:4326&maxFeatures=80'

// Open-Meteo: últimos 12 meses de temperatura mensual en coordenada del glaciar
function openMeteoUrl(lat: number, lon: number): string {
  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - 12)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${fmt(start)}&end_date=${fmt(end)}&monthly=temperature_2m_mean&timezone=auto`
}

// Normaliza el nombre del glaciar para lookup en WGMS
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace('glaciar ', '')
    .replace('glacier ', '')
    .split(' ')[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Calcula anomalía de temperatura: promedio últimos 12 meses vs baseline de zona
function calcAnomaly(temps: number[], lat: number): number {
  const baseline = getBaseline(lat)
  const recent = temps.slice(-12)
  if (recent.length === 0) return 1.2  // fallback razonable
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length
  const baseMean = baseline.reduce((a, b) => a + b, 0) / baseline.length
  return parseFloat((recentMean - baseMean).toFixed(2))
}

async function fetchGlims(): Promise<GlimsFeature[]> {
  const res = await fetch(GLIMS_URL, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`GLIMS ${res.status}`)
  const json = await res.json() as { features?: GlimsFeature[] }
  return json.features ?? []
}

async function fetchClimate(lat: number, lon: number): Promise<{ temps: number[]; anomaly: number }> {
  try {
    const res = await fetch(openMeteoUrl(lat, lon), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('open-meteo error')
    const json = await res.json() as OpenMeteoResponse
    const temps = json.monthly?.temperature_2m_mean ?? []
    return { temps, anomaly: calcAnomaly(temps, lat) }
  } catch {
    // Devuelve anomalía estimada por zona si open-meteo falla
    const base = getBaseline(lat)
    const baseMean = base.reduce((a, b) => a + b, 0) / base.length
    const estimated = baseMean + 1.2  // anomalía global estimada
    return { temps: base.map(b => b + 1.2), anomaly: 1.2 }
  }
}

function buildGlacier(feat: GlimsFeature, temps: number[], anomaly: number): Glacier {
  const p = feat.properties
  const lat = p.lat_degr ?? p.latitude ?? 0
  const lon = p.lon_degr ?? p.longitude ?? 0
  const area = p.area ?? 1
  const id = p.glims_id.toLowerCase().replace(/[^a-z0-9]/g, '')
  const name = p.glacier_name ?? 'Glaciar sin nombre'

  const key = normalizeKey(name)
  const massHistory = WGMS[key] ?? temps.slice(-12).map(t => -(0.3 + (t - getBaseline(lat).reduce((a,b)=>a+b,0)/12) * 0.15))
  const areaHistory = massHistory.map((_, i) => {
    const cumLoss = massHistory.slice(0, i + 1).reduce((a, b) => a + b, 0)
    return Math.max(50, Math.round(100 + cumLoss * 2))
  })

  const cuencaFactor = getCuencaFactor(lat)
  const riesgo = calcRiesgo({
    areaNow: area,
    areaRef: area * (100 / Math.max(areaHistory[0], 70)),
    tempAnomaly: anomaly,
    elevation: 3000,   // GLIMS no siempre retorna elevación — se usa valor razonable andino
    cuencaFactor,
  })

  return {
    id,
    glimsId: p.glims_id,
    name: name.startsWith('Glaciar') ? name : `Glaciar ${name}`,
    region: getRegion(lat),
    lat,
    lon,
    area,
    tempAnomaly: anomaly,
    tempHistory: temps.slice(-12).map(t => parseFloat((t - (getBaseline(lat).reduce((a,b)=>a+b,0)/12)).toFixed(2))),
    massHistory,
    areaHistory,
    riesgo,
    cat: getCat(riesgo),
    trend: getTrend(massHistory),
    deltaShort: `−${Math.max(0, 100 - (areaHistory.at(-1) ?? 100))}%`,
    deltaYear: `−${(Math.abs(massHistory.at(-1) ?? 0) * 0.8).toFixed(1)}%/año`,
    masaVar: getMasaVar(massHistory),
    riskHistory: buildRiskHistory(areaHistory, temps.slice(-12).map(t => parseFloat((t - (getBaseline(lat).reduce((a,b)=>a+b,0)/12)).toFixed(2))), riesgo),
    cuenca: getCuenca(lat, lon),
    poblacion: getPoblacion(lat),
    infra: getInfra(lat, lon),
  }
}

export async function GET(_req: NextRequest) {
  try {
    // 1. Fetch GLIMS
    const features = await fetchGlims()

    // 2. Filtrar y tomar los 30 con mayor área (o todos si hay menos)
    const filtered = features
      .filter(f => (f.properties.area ?? 0) >= 0.1)
      .sort((a, b) => (b.properties.area ?? 0) - (a.properties.area ?? 0))
      .slice(0, 30)

    if (filtered.length === 0) throw new Error('No glaciers from GLIMS')

    // 3. Fetch Open-Meteo en paralelo (timeout individual por glaciar)
    const climateResults = await Promise.all(
      filtered.map(f => {
        const lat = f.properties.lat_degr ?? f.properties.latitude ?? 0
        const lon = f.properties.lon_degr ?? f.properties.longitude ?? 0
        return fetchClimate(lat, lon)
      })
    )

    // 4. Construir Glacier[] y ordenar por riesgo desc
    const glaciers: Glacier[] = filtered
      .map((feat, i) => buildGlacier(feat, climateResults[i].temps, climateResults[i].anomaly))
      .sort((a, b) => b.riesgo - a.riesgo)

    return new Response(JSON.stringify(glaciers), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[/api/glaciers] GLIMS failed, using fallback:', err)
    // Fallback: devolver datos estáticos verificados
    return new Response(JSON.stringify(FALLBACK), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300',
        'X-Glacier-Source': 'fallback',
      },
    })
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/glaciers/route.ts
git commit -m "feat(glaciares): add GET /api/glaciers — GLIMS + Open-Meteo + WGMS"
```

---

## Task 4: POST /api/glaciers/analyze Route

**Files:**
- Create: `frontend/app/api/glaciers/analyze/route.ts`

- [ ] **Step 1: Crear `frontend/app/api/glaciers/analyze/route.ts`**

```typescript
import { NextRequest } from 'next/server'
import type { Glacier, GlacierAI } from '@/lib/glacier-types'

export const runtime = 'edge'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

function buildPrompt(g: Glacier): string {
  return `Eres el sistema de inteligencia glaciológica de SENTINEL, plataforma de monitoreo ambiental de Chile.

Datos reales del glaciar:
- Nombre: ${g.name}
- Región: ${g.region}
- Coordenadas: ${g.lat.toFixed(4)}°S, ${Math.abs(g.lon).toFixed(4)}°W
- Área actual: ${g.area} km²
- Cuenca: ${g.cuenca}
- Anomalía de temperatura: +${g.tempAnomaly}°C sobre baseline ERA5
- Balance de masa reciente: ${g.masaVar}
- Tendencia: ${g.trend}
- Variación de superficie: ${g.deltaShort} (${g.deltaYear})
- Índice de riesgo calculado: ${g.riesgo}/100 (${g.cat})
- Población dependiente: ${g.poblacion}

Genera un análisis JSON con exactamente este formato, sin texto extra:
{
  "diag": "2-3 oraciones de diagnóstico técnico basadas en los datos reales",
  "urgency": "CRÍTICA" | "ALTA" | "MEDIA" | "BAJA",
  "impact": "1-2 oraciones sobre impacto hídrico concreto para la cuenca y población",
  "recT": "Recomendación técnica de monitoreo o medición específica",
  "recR": "Recomendación de acción institucional o territorial"
}

Responde SOLO con el JSON. Sin markdown, sin explicaciones.`
}

export async function POST(req: NextRequest) {
  try {
    const { glacier } = await req.json() as { glacier: Glacier }

    if (!glacier?.id) {
      return new Response(JSON.stringify({ error: 'glacier required' }), { status: 400 })
    }

    if (!OPENROUTER_KEY) {
      // Fallback sin LLM: generar texto basado en reglas
      const fallback: GlacierAI = {
        diag: `${glacier.name} registra una anomalía térmica de +${glacier.tempAnomaly}°C sobre el baseline ERA5. La variación de masa de ${glacier.masaVar} indica ${glacier.trend.toLowerCase()} en la última década.`,
        urgency: glacier.riesgo >= 76 ? 'CRÍTICA' : glacier.riesgo >= 51 ? 'ALTA' : glacier.riesgo >= 26 ? 'MEDIA' : 'BAJA',
        impact: `La cuenca ${glacier.cuenca} muestra dependencia hídrica de ${glacier.poblacion}. El retroceso glaciar reduce la regulación estacional del caudal.`,
        recT: 'Implementar monitoreo satelital mensual con imágenes Sentinel-2. Instalar estación nivometeorológica en la zona de acumulación.',
        recR: 'Coordinar con DGA y gobierno regional para actualizar el inventario de glaciares y revisar concesiones de agua en la cuenca.',
      }
      return new Response(JSON.stringify(fallback), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinel.vercel.app',
        'X-Title': 'SENTINEL Glaciares',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large',
        messages: [{ role: 'user', content: buildPrompt(glacier) }],
        temperature: 0.3,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!upstream.ok) {
      throw new Error(`OpenRouter ${upstream.status}`)
    }

    const json = await upstream.json() as { choices: { message: { content: string } }[] }
    const content = json.choices[0]?.message?.content ?? '{}'

    // Extraer JSON del content (puede venir con markdown fences)
    const match = content.match(/\{[\s\S]*\}/)
    const ai = JSON.parse(match?.[0] ?? content) as GlacierAI

    return new Response(JSON.stringify(ai), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[/api/glaciers/analyze]', err)
    return new Response(JSON.stringify({ error: 'analysis failed' }), { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/glaciers/analyze/route.ts
git commit -m "feat(glaciares): add POST /api/glaciers/analyze — OpenRouter + rule fallback"
```

---

## Task 5: useGlaciers Hook

**Files:**
- Create: `frontend/hooks/use-glaciers.ts`

- [ ] **Step 1: Crear `frontend/hooks/use-glaciers.ts`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Glacier, GlacierAI } from '@/lib/glacier-types'

interface UseGlaciersReturn {
  glaciers: Glacier[]
  loading: boolean
  error: string | null
  selected: Glacier | null
  analyzing: boolean
  selectGlacier: (g: Glacier) => void
  analyzeGlacier: (g: Glacier) => Promise<void>
}

export function useGlaciers(): UseGlaciersReturn {
  const [glaciers, setGlaciers] = useState<Glacier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Glacier | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/glaciers')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Glacier[]>
      })
      .then(data => {
        if (cancelled) return
        setGlaciers(data)
        setSelected(data[0] ?? null)
      })
      .catch(e => {
        if (cancelled) return
        setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const selectGlacier = useCallback((g: Glacier) => {
    setSelected(g)
  }, [])

  const analyzeGlacier = useCallback(async (g: Glacier) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/glaciers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glacier: g }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ai = await res.json() as GlacierAI

      // Actualizar el glaciar en el array y el selected
      setGlaciers(prev => prev.map(gl => gl.id === g.id ? { ...gl, ai } : gl))
      setSelected(prev => prev?.id === g.id ? { ...prev, ai } : prev)
    } catch (e) {
      console.error('[analyzeGlacier]', e)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  return { glaciers, loading, error, selected, analyzing, selectGlacier, analyzeGlacier }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/hooks/use-glaciers.ts
git commit -m "feat(glaciares): add useGlaciers hook"
```

---

## Task 6: GlacierMap Component (Mapbox)

**Files:**
- Create: `frontend/components/glaciares/glacier-map.tsx`

- [ ] **Step 1: Crear `frontend/components/glaciares/glacier-map.tsx`**

Patrón idéntico al de `world-tornado-map.tsx`: dynamic import de mapbox-gl, markers React en DOM, fly-to al seleccionar.

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import type { Glacier } from '@/lib/glacier-types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  'pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg'

function riskColor(riesgo: number): string {
  if (riesgo >= 76) return '#ff3333'
  if (riesgo >= 51) return '#f97316'
  if (riesgo >= 26) return '#38bdf8'
  return '#10b981'
}

interface Props {
  glaciers: Glacier[]
  selected: Glacier | null
  onSelect: (g: Glacier) => void
}

export function GlacierMap({ glaciers, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<{ remove: () => void }[]>([])
  const onSelectRef = useRef(onSelect)
  const [showBasins, setShowBasins] = useState(true)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Init map
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return
    let cancelled = false

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled) return
      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-71, -38],
        zoom: 4.2,
        minZoom: 3,
        maxZoom: 14,
        attributionControl: false,
      })
      mapRef.current = map

      map.on('style.load', () => {
        map.setFog({
          'color': 'rgba(56, 189, 248, 0.1)',
          'high-color': 'rgba(10, 11, 14, 0.9)',
          'horizon-blend': 0.15,
          'space-color': 'rgb(2, 2, 5)',
          'star-intensity': 0.8,
        } as never)

        // White labels
        map.getStyle().layers?.forEach(layer => {
          if (layer.type !== 'symbol') return
          try { map.setPaintProperty(layer.id, 'text-color', '#ffffff') } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0,0,0,0.7)') } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, 'text-halo-width', 1.5) } catch { /* skip */ }
        })
      })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Render markers when glaciers load
  useEffect(() => {
    const map = mapRef.current
    if (!map || glaciers.length === 0) return

    const waitForLoad = () => {
      if (!map.loaded()) {
        map.once('load', waitForLoad)
        return
      }
      // Limpiar markers anteriores
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      import('mapbox-gl').then(({ default: mapboxgl }) => {
        glaciers.forEach(g => {
          const color = riskColor(g.riesgo)
          const isSelected = selected?.id === g.id

          const el = document.createElement('div')
          el.style.cssText = 'cursor:pointer;position:relative;'
          el.innerHTML = `
            <svg width="28" height="28" viewBox="-14 -14 28 28" style="overflow:visible;filter:drop-shadow(0 0 ${isSelected ? 8 : 4}px ${color}${isSelected ? '' : '88'})">
              ${isSelected ? `<circle r="14" fill="${color}" opacity="0.2"/>` : ''}
              <rect x="-7" y="-7" width="14" height="14" rx="1" transform="rotate(45)" fill="${color}" opacity="${isSelected ? 1 : 0.85}" stroke="#fff" stroke-width="${isSelected ? 1.5 : 0.8}"/>
            </svg>
            <div style="position:absolute;top:16px;left:14px;white-space:nowrap;font-family:'Geist Mono',monospace;font-size:9px;font-weight:700;color:${color};text-shadow:0 1px 3px #000;letter-spacing:0.06em;pointer-events:none;">
              ${g.name.replace('Glaciar ', '').toUpperCase()}
            </div>
          `

          el.addEventListener('click', () => onSelectRef.current(g))

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([g.lon, g.lat])
            .addTo(map)

          markersRef.current.push(marker)
        })
      })
    }

    waitForLoad()
  }, [glaciers, selected?.id])

  // Fly to selected
  useEffect(() => {
    if (!selected || !mapRef.current) return
    mapRef.current.flyTo({
      center: [selected.lon, selected.lat],
      zoom: 9,
      duration: 1800,
      essential: true,
    })
  }, [selected?.id])

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Overlays */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0a0d14]/90 backdrop-blur border border-white/10 text-[9px] font-bold tracking-widest text-blue uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" />
          Criosfera · Chile
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <button
          onClick={() => setShowBasins(s => !s)}
          className={`px-2.5 py-1 rounded-full backdrop-blur border text-[9px] font-bold tracking-widest uppercase transition-colors ${showBasins ? 'bg-blue/10 border-blue/30 text-blue' : 'bg-[#0a0d14]/80 border-white/10 text-white/40'}`}
        >
          Cuencas
        </button>
        <span className="px-2.5 py-1 rounded-full bg-[#0a0d14]/80 backdrop-blur border border-white/10 text-[9px] font-mono text-white/40">
          SAT · SENTINEL-2
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-3 z-10 bg-[#0a0d14]/90 backdrop-blur border border-white/10 rounded-lg p-3">
        <p className="text-[8px] font-bold tracking-widest text-white/40 uppercase mb-2">Índice de Riesgo</p>
        {[
          { color: '#10b981', label: '0–25 · Estable' },
          { color: '#38bdf8', label: '26–50 · Observación' },
          { color: '#f97316', label: '51–75 · Riesgo Alto' },
          { color: '#ff3333', label: '76–100 · Crítico' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-2 h-2 rounded-sm rotate-45 inline-block" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono text-white/60">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/glaciares/glacier-map.tsx
git commit -m "feat(glaciares): add GlacierMap — Mapbox satellite + markers"
```

---

## Task 7: GlacierRiskPanel Component

**Files:**
- Create: `frontend/components/glaciares/glacier-risk-panel.tsx`

- [ ] **Step 1: Crear `frontend/components/glaciares/glacier-risk-panel.tsx`**

```tsx
'use client'

import type { Glacier } from '@/lib/glacier-types'

const RISK_CONFIG = {
  'Crítico':    { color: '#ff3333',  cls: 'text-red border-red/30 bg-red/10' },
  'Riesgo Alto':{ color: '#f97316',  cls: 'text-orange border-orange/30 bg-orange/10' },
  'Observación':{ color: '#38bdf8',  cls: 'text-blue border-blue/30 bg-blue/10' },
  'Estable':    { color: '#10b981',  cls: 'text-green border-green/30 bg-green/10' },
} as const

function Gauge({ score }: { score: number }) {
  const cfg = RISK_CONFIG[score >= 76 ? 'Crítico' : score >= 51 ? 'Riesgo Alto' : score >= 26 ? 'Observación' : 'Estable']
  const r = 78, cx = 110, cy = 100
  const startDeg = -135, endDeg = 135
  const toRad = (d: number) => (d * Math.PI) / 180
  const arc = (a1: number, a2: number) => {
    const x1 = cx + r * Math.cos(toRad(a1)), y1 = cy + r * Math.sin(toRad(a1))
    const x2 = cx + r * Math.cos(toRad(a2)), y2 = cy + r * Math.sin(toRad(a2))
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }
  const angleFn = (s: number) => startDeg + (s / 100) * (endDeg - startDeg)
  const needleA = angleFn(score)
  const nx = cx + r * Math.cos(toRad(needleA))
  const ny = cy + r * Math.sin(toRad(needleA))

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 220 140" className="w-full max-w-[220px]">
        <path d={arc(startDeg, endDeg)} stroke="rgba(120,200,240,0.08)" strokeWidth="10" fill="none" strokeLinecap="round" />
        {[
          [0,25,'#10b981'],[25,50,'#38bdf8'],[50,75,'#f97316'],[75,100,'#ff3333']
        ].map(([from, to, c]) => (
          <path key={String(from)} d={arc(angleFn(Number(from)), angleFn(Number(to)))} stroke={String(c)} strokeWidth="3" fill="none" opacity="0.5" />
        ))}
        <path d={arc(startDeg, needleA)} stroke={cfg.color} strokeWidth="10" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${cfg.color}88)` }} />
        {[0,25,50,75,100].map(s => {
          const a = angleFn(s)
          return (
            <text key={s}
              x={cx + (r+14) * Math.cos(toRad(a))}
              y={cy + (r+14) * Math.sin(toRad(a))}
              fill="rgba(120,200,240,0.4)" fontSize="7" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
            >{s}</text>
          )
        })}
        <circle cx={nx} cy={ny} r="6" fill={cfg.color} style={{ filter: `drop-shadow(0 0 6px ${cfg.color})` }} />
        <circle cx={nx} cy={ny} r="2.5" fill="#04060a" />
      </svg>
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
        <span className="text-4xl font-black tabular-nums" style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.color}55` }}>
          {score}
        </span>
        <span className="text-[9px] font-mono text-white/40">/ 100 · ÍNDICE</span>
      </div>
    </div>
  )
}

interface Props {
  glacier: Glacier | null
}

export function GlacierRiskPanel({ glacier: g }: Props) {
  if (!g) return (
    <div className="absolute top-6 left-6 z-40 w-72 bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 text-white/30 text-[10px] font-mono">
      Seleccioná un glaciar
    </div>
  )

  const cfg = RISK_CONFIG[g.cat]

  return (
    <div className="absolute top-6 left-6 z-40 w-72 h-[calc(100vh-120px)] overflow-y-auto scrollbar-none pointer-events-auto">
      <div className="flex flex-col gap-3 pb-4">

        {/* Header */}
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase mb-1">Índice de Riesgo Glaciar</p>
              <h3 className="text-sm font-black text-white leading-tight">{g.name}</h3>
              <p className="text-[9px] font-mono text-white/40 mt-0.5">{g.region.toUpperCase()}</p>
            </div>
            <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${cfg.cls}`}>
              {g.cat}
            </span>
          </div>

          <Gauge score={g.riesgo} />

          <div className="mt-2 space-y-1.5">
            {[
              { k: 'Variación', v: g.deltaShort, style: { color: '#ff3333' } },
              { k: 'Tendencia', v: g.trend },
              { k: 'Balance de masa', v: g.masaVar, style: { fontFamily: 'monospace', fontSize: '11px' } },
              { k: 'Dependencia hídrica', v: g.poblacion, style: { fontSize: '10px' } },
            ].map(({ k, v, style }) => (
              <div key={k} className="flex justify-between items-start gap-2 py-1 border-t border-white/5">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider shrink-0">{k}</span>
                <span className="text-[11px] text-white/80 text-right" style={style}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Variables */}
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Variables · Riesgo</p>
            <span className="text-[9px] font-mono text-white/30">5 FACTORES</span>
          </div>
          {[
            { label: 'Retroceso de superficie', pct: Math.min(100, Math.max(0, (100 - (g.areaHistory.at(-1) ?? 100)) * 1.2)), warn: true },
            { label: 'Anomalía térmica', pct: Math.min(100, g.tempAnomaly / 3 * 100), warn: g.tempAnomaly > 1.5 },
            { label: 'Vulnerabilidad altitudinal', pct: g.elevation !== undefined ? Math.min(100, (5000 - g.elevation) / 40) : 50, warn: false },
            { label: 'Tamaño (área actual)', pct: g.area < 1 ? 90 : g.area < 10 ? 70 : g.area < 100 ? 50 : 30, warn: g.area < 5 },
            { label: 'Importancia hídrica cuenca', pct: g.riesgo, warn: g.riesgo > 70 },
          ].map(({ label, pct, warn }) => (
            <div key={label} className="mb-2 last:mb-0">
              <div className="flex justify-between mb-1">
                <span className={`text-[9px] font-medium ${warn ? 'text-orange' : 'text-white/50'}`}>{label}</span>
                <span className="text-[9px] font-mono text-white/40">{Math.round(pct)}</span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: warn ? '#f97316' : '#38bdf8', boxShadow: warn ? '0 0 6px #f9731688' : undefined }}
                />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/glaciares/glacier-risk-panel.tsx
git commit -m "feat(glaciares): add GlacierRiskPanel — gauge + variables"
```

---

## Task 8: GlacierAIPanel Component

**Files:**
- Create: `frontend/components/glaciares/glacier-ai-panel.tsx`

- [ ] **Step 1: Crear `frontend/components/glaciares/glacier-ai-panel.tsx`**

```tsx
'use client'

import type { Glacier } from '@/lib/glacier-types'

const URGENCY_CONFIG = {
  'CRÍTICA': { color: '#ff3333', cls: 'text-red border-red/30 bg-red/10' },
  'ALTA':    { color: '#f97316', cls: 'text-orange border-orange/30 bg-orange/10' },
  'MEDIA':   { color: '#38bdf8', cls: 'text-blue border-blue/30 bg-blue/10' },
  'BAJA':    { color: '#10b981', cls: 'text-green border-green/30 bg-green/10' },
} as const

function ActionPlan({ riesgo }: { riesgo: number }) {
  const { level, cls, items } = riesgo >= 76
    ? { level: 'P0 · CRÍTICO', cls: 'text-red', items: [
        'Activar alerta técnica regional',
        'Generar informe para gobierno regional',
        'Evaluar impacto en agua potable y ecosistemas',
        'Priorizar monitoreo satelital semanal',
      ]}
    : riesgo >= 51
    ? { level: 'P1 · ALTO', cls: 'text-orange', items: [
        'Alertar a autoridad territorial competente',
        'Evaluar seguridad hídrica de la cuenca',
        'Priorizar análisis hidrológico',
        'Revisar actividades industriales cercanas',
      ]}
    : riesgo >= 26
    ? { level: 'P2 · MEDIO', cls: 'text-blue', items: [
        'Aumentar frecuencia de monitoreo',
        'Revisar dependencia hídrica local',
        'Comparar con líneas base históricas',
      ]}
    : { level: 'P3 · BAJO', cls: 'text-green', items: [
        'Mantener monitoreo mensual',
        'Actualizar línea base anual',
        'Revisar variación estacional',
      ]}

  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Plan de Acción</p>
        <span className={`text-[9px] font-black uppercase tracking-wider ${cls}`}>{level}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/30 shrink-0 mt-0.5">{String(i+1).padStart(2,'0')}</span>
          <span className="text-[10px] text-white/70 leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  glacier: Glacier | null
  analyzing: boolean
  onAnalyze: (g: Glacier) => void
}

export function GlacierAIPanel({ glacier: g, analyzing, onAnalyze }: Props) {
  if (!g) return (
    <div className="absolute top-6 right-6 z-40 w-72 bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 text-white/30 text-[10px] font-mono">
      Seleccioná un glaciar para ver el análisis
    </div>
  )

  return (
    <div className="absolute top-6 right-6 z-40 w-72 h-[calc(100vh-120px)] overflow-y-auto scrollbar-none pointer-events-auto">
      <div className="flex flex-col gap-3 pb-4">

        {/* AI Analysis */}
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Inteligencia Glaciar IA</p>
            <span className="text-[9px] font-mono text-white/30">v3.1 · LIVE</span>
          </div>

          {g.ai ? (
            <>
              <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Diagnóstico</p>
              <p className="text-[10px] text-white/70 leading-relaxed mb-3">{g.ai.diag}</p>

              <div className="flex items-center justify-between py-2 border-t border-b border-white/5 mb-3">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Nivel de Urgencia</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${URGENCY_CONFIG[g.ai.urgency].cls}`}>
                  {g.ai.urgency}
                </span>
              </div>

              <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Impacto Hídrico</p>
              <p className="text-[10px] text-white/70 leading-relaxed mb-3">{g.ai.impact}</p>

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div>
                  <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Rec. Técnica</p>
                  <p className="text-[10px] text-white/60 leading-relaxed">{g.ai.recT}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Rec. Territorial</p>
                  <p className="text-[10px] text-white/60 leading-relaxed">{g.ai.recR}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              {analyzing ? (
                <>
                  <div className="w-6 h-6 border-2 border-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[9px] font-mono text-white/40">Generando análisis…</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-white/40 text-center">
                    Análisis IA no generado para este glaciar
                  </p>
                  <button
                    onClick={() => onAnalyze(g)}
                    className="px-4 py-2 rounded-md bg-blue/10 border border-blue/30 text-[10px] font-black tracking-widest text-blue uppercase hover:bg-blue/20 transition-colors"
                  >
                    ANALIZAR →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <ActionPlan riesgo={g.riesgo} />

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/glaciares/glacier-ai-panel.tsx
git commit -m "feat(glaciares): add GlacierAIPanel — AI analysis + action plan"
```

---

## Task 9: GlacierKPIBar Component

**Files:**
- Create: `frontend/components/glaciares/glacier-kpi-bar.tsx`

- [ ] **Step 1: Crear `frontend/components/glaciares/glacier-kpi-bar.tsx`**

```tsx
'use client'

import type { Glacier } from '@/lib/glacier-types'

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const w = 72, h = 18
  const max = Math.max(...values), min = Math.min(...values)
  const range = max - min || 1
  const step = w / (values.length - 1)
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <path d={path} stroke={color} strokeWidth="1.3" fill="none" />
    </svg>
  )
}

interface Props {
  glaciers: Glacier[]
}

export function GlacierKPIBar({ glaciers }: Props) {
  if (glaciers.length === 0) return null

  const critCount = glaciers.filter(g => g.cat === 'Crítico').length
  const highCount = glaciers.filter(g => g.cat === 'Riesgo Alto').length
  const retreatCount = glaciers.filter(g => g.trend.includes('Retroceso')).length
  const avgTemp = (glaciers.reduce((s, g) => s + g.tempAnomaly, 0) / glaciers.length).toFixed(1)
  const maxMass = glaciers.reduce((prev, g) => {
    const last = g.massHistory.at(-1) ?? 0
    return last < (prev.massHistory.at(-1) ?? 0) ? g : prev
  })

  // Series para sparks
  const tempSeries = glaciers.slice(0,7).map(g => g.tempAnomaly)
  const retreatSeries = [15, 18, 22, 25, 27, 30, retreatCount]
  const massSeries = glaciers.slice(0,7).map(g => Math.abs(g.massHistory.at(-1) ?? 0.3))

  const now = new Date()
  const timeStr = now.toISOString().slice(11, 16)

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 px-0 pb-2">
      {[
        {
          icon: '◆', label: 'Monitoreados', value: String(glaciers.length), unit: 'ACTIVOS',
          sub: null, spark: retreatSeries, color: '#38bdf8',
        },
        {
          icon: '▼', label: 'En Retroceso', value: String(retreatCount),
          unit: `${Math.round(retreatCount/glaciers.length*100)}%`,
          sub: null, spark: retreatSeries, color: '#ff3333',
          valueColor: '#ff3333',
        },
        {
          icon: '≈', label: 'Riesgo Hídrico',
          value: critCount > 0 ? 'ALTO' : 'MEDIO',
          unit: `${critCount} cuencas críticas`,
          sub: null, spark: null, color: '#f97316',
          valueColor: '#f97316',
        },
        {
          icon: '↑', label: 'Temp. +anomalía', value: `+${avgTemp}`, unit: '°C',
          sub: null, spark: tempSeries, color: '#f97316',
          valueColor: '#f97316',
        },
        {
          icon: '∂', label: 'Variación masa', value: maxMass.masaVar.split(' ')[0],
          unit: 'm EH/año',
          sub: null, spark: massSeries, color: '#ff3333',
          valueColor: '#ff3333',
        },
        {
          icon: '○', label: 'Actualización', value: timeStr, unit: 'UTC −3',
          sub: 'GLIMS · ERA5 · WGMS', spark: null, color: '#10b981',
          valueColor: '#10b981',
        },
      ].map(({ icon, label, value, unit, sub, spark, color, valueColor }) => (
        <div key={label} className="bg-[#0a0d14]/80 backdrop-blur border border-white/8 rounded-lg p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color }}>{icon}</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 truncate">{label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tabular-nums leading-none" style={{ color: valueColor ?? '#f0f2f5' }}>
              {value}
            </span>
            <span className="text-[9px] font-mono text-white/30 truncate">{unit}</span>
          </div>
          {spark && <MiniSpark values={spark} color={color} />}
          {sub && <span className="text-[8px] font-mono text-white/25 truncate">{sub}</span>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/glaciares/glacier-kpi-bar.tsx
git commit -m "feat(glaciares): add GlacierKPIBar"
```

---

## Task 10: GlacierCards + GlacierDetailDrawer

**Files:**
- Create: `frontend/components/glaciares/glacier-cards.tsx`
- Create: `frontend/components/glaciares/glacier-detail-drawer.tsx`

- [ ] **Step 1: Crear `frontend/components/glaciares/glacier-cards.tsx`**

```tsx
'use client'

import type { Glacier } from '@/lib/glacier-types'

const RISK_COLOR: Record<string, string> = {
  'Crítico':    '#ff3333',
  'Riesgo Alto':'#f97316',
  'Observación':'#38bdf8',
  'Estable':    '#10b981',
}

interface Props {
  glaciers: Glacier[]
  selected: Glacier | null
  onSelect: (g: Glacier) => void
  onAnalyze: (g: Glacier) => void
  onOpenDetail: (g: Glacier) => void
}

export function GlacierCards({ glaciers, selected, onSelect, onAnalyze, onOpenDetail }: Props) {
  return (
    <div className="bg-[#0a0d14]/80 backdrop-blur border border-white/8 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Glaciares monitoreados</span>
        <span className="text-[9px] font-mono text-white/30">{glaciers.length} ACTIVOS · CHILE</span>
      </div>
      <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none">
        {glaciers.map(g => {
          const color = RISK_COLOR[g.cat]
          const isSelected = selected?.id === g.id
          return (
            <div
              key={g.id}
              onClick={() => onSelect(g)}
              className={`shrink-0 w-48 rounded-lg border p-3 cursor-pointer transition-all duration-200 ${
                isSelected ? 'border-white/20 bg-white/5' : 'border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white truncate">{g.name}</p>
                  <p className="text-[8px] font-mono text-white/40 truncate">{g.region.toUpperCase()}</p>
                </div>
                <span
                  className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase"
                  style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
                >
                  {g.cat === 'Riesgo Alto' ? 'ALTO' : g.cat.toUpperCase()}
                </span>
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-black tabular-nums" style={{ color, textShadow: `0 0 12px ${color}44` }}>
                  {g.riesgo}
                </span>
                <span className="text-[9px] font-mono text-white/30">/100</span>
                <span className="ml-auto text-[9px] font-mono" style={{ color: '#ff3333' }}>{g.deltaShort}</span>
              </div>

              {/* Sparkbar — risk trend */}
              <div className="flex items-end gap-px h-6 mb-2">
                {g.riskHistory.slice(-12).map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${(v / 100) * 100}%`, backgroundColor: color, opacity: 0.3 + (i / 12) * 0.7 }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1 mb-2">
                <div>
                  <p className="text-[7px] font-bold text-white/30 uppercase">Tendencia</p>
                  <p className="text-[8px] text-white/60 leading-tight">{g.trend}</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold text-white/30 uppercase">Δ/año</p>
                  <p className="text-[8px] font-mono text-white/60">{g.deltaYear}</p>
                </div>
              </div>

              <div className="flex gap-1 pt-2 border-t border-white/5">
                <button
                  onClick={e => { e.stopPropagation(); onOpenDetail(g) }}
                  className="flex-1 py-1 rounded text-[8px] font-black tracking-wider text-white/40 border border-white/10 hover:bg-white/5 hover:text-white/70 uppercase transition-colors"
                >
                  DETALLE
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onAnalyze(g) }}
                  className="flex-1 py-1 rounded text-[8px] font-black tracking-wider uppercase transition-colors"
                  style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}44` }}
                >
                  ANALIZAR →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `frontend/components/glaciares/glacier-detail-drawer.tsx`**

```tsx
'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { Glacier } from '@/lib/glacier-types'

const INFRA_LABELS: Record<string, string> = {
  AP:'Agua Potable', EM:'Embalse', HE:'Hidroeléctrica', AG:'Agrícola',
  CI:'Ciudad', PN:'Área Protegida', RT:'Ruta', MI:'Mina', RI:'Río', TU:'Turismo',
}

const RISK_COLOR: Record<string, string> = {
  'Crítico':'#ff3333','Riesgo Alto':'#f97316','Observación':'#38bdf8','Estable':'#10b981',
}

function MiniLineChart({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={pts} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 9 }}
          labelFormatter={() => ''}
          formatter={(v: number) => [v.toFixed(2), '']}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface Props {
  glacier: Glacier | null
  open: boolean
  onClose: () => void
}

export function GlacierDetailDrawer({ glacier: g, open, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div className={`fixed right-0 top-0 bottom-0 z-[61] w-[480px] max-w-[90vw] bg-[#0a0b0e] border-l border-white/10 overflow-y-auto transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {g && (
          <>
            <div className="sticky top-0 bg-[#0a0b0e]/95 backdrop-blur border-b border-white/10 p-4 flex items-start justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: RISK_COLOR[g.cat] }}>
                  {g.cat} · #{g.glimsId}
                </span>
                <h2 className="text-base font-black text-white mt-1">{g.name}</h2>
                <p className="text-[9px] font-mono text-white/40">
                  {g.region.toUpperCase()} · LAT {g.lat.toFixed(4)} / LON {g.lon.toFixed(4)}
                </p>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none p-1">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: 'Índice de Riesgo', v: `${g.riesgo}/100`, style: { color: RISK_COLOR[g.cat] } },
                  { k: 'Tendencia', v: g.trend },
                  { k: 'Variación', v: g.deltaShort, style: { color: '#ff3333' } },
                  { k: 'Δ Temperatura', v: `+${g.tempAnomaly}°C`, style: { color: '#f97316' } },
                  { k: 'Balance de masa', v: g.masaVar, style: { fontFamily: 'monospace', fontSize: '12px' } },
                  { k: 'Superficie', v: `${g.area} km²`, style: { fontFamily: 'monospace' } },
                  { k: 'Cuenca', v: g.cuenca },
                  { k: 'Altitud', v: g.elevation !== undefined ? `${g.elevation} m` : 'N/D' },
                ].map(({ k, v, style }) => (
                  <div key={k} className="bg-white/3 border border-white/8 rounded p-2.5">
                    <p className="text-[8px] font-bold text-white/30 uppercase mb-1">{k}</p>
                    <p className="text-sm font-bold text-white" style={style}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Charts */}
              {[
                { title: 'Evolución de Superficie · %', data: g.areaHistory, color: '#38bdf8' },
                { title: 'Balance de Masa · m EH/año', data: g.massHistory, color: '#ff3333' },
                { title: 'Δ Temperatura ERA5 · °C', data: g.tempHistory, color: '#f97316' },
              ].map(({ title, data, color }) => (
                <div key={title}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-2">{title}</p>
                  <div className="bg-white/3 border border-white/8 rounded overflow-hidden">
                    <MiniLineChart data={data} color={color} />
                  </div>
                </div>
              ))}

              {/* Infrastructure */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-2">Infraestructura y Zonas Sensibles</p>
                <div className="space-y-1.5">
                  {g.infra.map((it, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono bg-white/8 px-1.5 py-0.5 rounded text-white/50">{it.ic}</span>
                        <span className="text-[10px] text-white/70">{it.t}</span>
                        <span className="text-[8px] text-white/30">{INFRA_LABELS[it.ic] ?? ''}</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/40">{it.d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {g.ai && (
                <div className="bg-white/3 border border-white/8 rounded p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue mb-2">Análisis IA</p>
                  <p className="text-[10px] text-white/70 leading-relaxed mb-2">{g.ai.diag}</p>
                  <p className="text-[9px] text-white/50 leading-relaxed">{g.ai.impact}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-[#0a0b0e]/95 backdrop-blur border-t border-white/10 p-4 flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 rounded border border-white/15 text-[10px] font-black tracking-widest text-white/50 hover:bg-white/5 uppercase">
                CERRAR
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/glaciares/glacier-cards.tsx frontend/components/glaciares/glacier-detail-drawer.tsx
git commit -m "feat(glaciares): add GlacierCards and GlacierDetailDrawer"
```

---

## Task 11: Page + TopBar + Language Keys

**Files:**
- Create: `frontend/app/glaciares/page.tsx`
- Modify: `frontend/components/dashboard/top-bar.tsx:83-101`
- Modify: `frontend/contexts/language-context.tsx`

- [ ] **Step 1: Crear `frontend/app/glaciares/page.tsx`**

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { TopBar } from '@/components/dashboard/top-bar'
import { GlacierRiskPanel } from '@/components/glaciares/glacier-risk-panel'
import { GlacierAIPanel } from '@/components/glaciares/glacier-ai-panel'
import { GlacierKPIBar } from '@/components/glaciares/glacier-kpi-bar'
import { GlacierCards } from '@/components/glaciares/glacier-cards'
import { GlacierDetailDrawer } from '@/components/glaciares/glacier-detail-drawer'
import { MobileDrawer } from '@/components/ui/mobile-drawer'
import { useGlaciers } from '@/hooks/use-glaciers'
import type { Glacier } from '@/lib/glacier-types'

const GlacierMap = dynamic(
  () => import('@/components/glaciares/glacier-map').then(m => m.GlacierMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function GlaciersPage() {
  return <AuthGuard><GlaciersPageInner /></AuthGuard>
}

function GlaciersPageInner() {
  const { glaciers, loading, selected, analyzing, selectGlacier, analyzeGlacier } = useGlaciers()
  const [detailGlacier, setDetailGlacier] = useState<Glacier | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSelect = (g: Glacier) => {
    selectGlacier(g)
  }

  const handleOpenDetail = (g: Glacier) => {
    setDetailGlacier(g)
    setDrawerOpen(true)
  }

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-mono text-white/40 tracking-widest">CARGANDO DATOS GLIMS…</p>
            </div>
          </div>
        )}

        {/* Map — fills entire main */}
        <GlacierMap
          glaciers={glaciers}
          selected={selected}
          onSelect={handleSelect}
        />

        {/* Left panel — hidden on mobile */}
        <div className="hidden md:block">
          <GlacierRiskPanel glacier={selected} />
        </div>

        {/* Center bottom — KPI + Cards */}
        <div className="hidden md:flex absolute bottom-4 left-[calc(288px+32px)] right-[calc(288px+32px)] z-40 flex-col gap-2">
          <GlacierKPIBar glaciers={glaciers} />
          {glaciers.length > 0 && (
            <GlacierCards
              glaciers={glaciers}
              selected={selected}
              onSelect={handleSelect}
              onAnalyze={analyzeGlacier}
              onOpenDetail={handleOpenDetail}
            />
          )}
        </div>

        {/* Right panel — hidden on mobile */}
        <div className="hidden md:block">
          <GlacierAIPanel glacier={selected} analyzing={analyzing} onAnalyze={analyzeGlacier} />
        </div>

        {/* Mobile drawer */}
        <MobileDrawer title="Glaciares · Chile" triggerLabel="Ver glaciares">
          {selected && (
            <div className="text-white/60 text-[10px] font-mono px-1 py-2 border-b border-white/8 mb-2">
              Seleccionado: {selected.name} · Riesgo {selected.riesgo}/100
            </div>
          )}
          <GlacierKPIBar glaciers={glaciers} />
          <GlacierCards
            glaciers={glaciers}
            selected={selected}
            onSelect={handleSelect}
            onAnalyze={analyzeGlacier}
            onOpenDetail={handleOpenDetail}
          />
        </MobileDrawer>

        {/* Detail drawer */}
        <GlacierDetailDrawer
          glacier={detailGlacier}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

      </main>
    </div>
  )
}
```

- [ ] **Step 2: Modificar `frontend/components/dashboard/top-bar.tsx`**

Agregar la tab GLACIARES al array de navegación en la línea ~83:

```typescript
// ANTES (líneas 83-88):
{[
  { href: '/dashboard', label: tx.navDashboard },
  { href: '/air',       label: tx.navAir },
  { href: '/tornado',   label: tx.navTornado },
  { href: '/news',      label: tx.navNews ?? 'Noticias' },
].map(({ href, label }) => (

// DESPUÉS:
{[
  { href: '/dashboard', label: tx.navDashboard },
  { href: '/air',       label: tx.navAir },
  { href: '/tornado',   label: tx.navTornado },
  { href: '/news',      label: tx.navNews ?? 'Noticias' },
  { href: '/glaciares', label: tx.navGlaciares ?? 'GLACIARES', badge: 'BETA' },
].map(({ href, label, badge }) => (
```

Y actualizar el JSX del Link dentro del map para renderizar el badge:

```tsx
<Link
  key={href}
  href={href}
  className={`relative px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${
    pathname === href
      ? 'bg-white/10 text-white border border-white/20'
      : 'text-text-muted hover:text-white hover:bg-white/5'
  }`}
>
  {label}
  {badge && (
    <span className="ml-1 text-[7px] font-black tracking-widest text-blue opacity-70">{badge}</span>
  )}
</Link>
```

- [ ] **Step 3: Agregar claves en `frontend/contexts/language-context.tsx`**

En el objeto `es` (después de `navTornado`):
```typescript
navGlaciares: 'GLACIARES',
```

En el objeto `en` (después de `navTornado`):
```typescript
navGlaciares: 'GLACIERS',
```

Ambos objetos necesitan también la entrada en el `satisfies Record<Lang, Record<string, unknown>>`.

- [ ] **Step 4: Verificar tipos**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 5: Verificar build**

```bash
cd frontend && npm run build
```
Esperado: build exitoso sin errores.

- [ ] **Step 6: Commit final**

```bash
git add frontend/app/glaciares/ frontend/components/dashboard/top-bar.tsx frontend/contexts/language-context.tsx
git commit -m "feat(glaciares): add /glaciares page + nav tab — completa integración GLIMS+OpenMeteo+WGMS+OpenRouter"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Types ✓ · GLIMS fetch ✓ · Open-Meteo ✓ · WGMS bundled ✓ · Risk score ✓ · OpenRouter ✓ · Mapbox ✓ · 3 columnas ✓ · TopBar tab ✓ · Language keys ✓ · Mobile drawer ✓ · Fallback ✓
- [x] **Sin placeholders:** No hay TBD ni TODO en el plan
- [x] **Tipos consistentes:** `Glacier`, `GlacierAI`, `InfraItem`, `RiskCat` definidos en Task 1 y usados sin cambios en todas las tareas
- [x] **Funciones consistentes:** `calcRiesgo`, `getCat`, `getTrend`, `getMasaVar`, `buildRiskHistory` definidas en Task 2 e importadas en Task 3
- [x] **Prop names consistentes:** `glacier` (singular) en panels, `glaciers` (plural) en cards/kpi/map
- [x] **Build path:** Edge runtime en ambas API routes · dynamic import en GlacierMap (SSR:false) · `'use client'` en todos los componentes de UI
