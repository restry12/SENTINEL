# Glacier Melt Risk Predictor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new glacier monitoring module in SENTINEL with real-time risk prediction, historical mass loss data, and AI-generated analysis.

**Architecture:** A new backend package `agent-glacier` following the existing agent pattern, a pre-processed JSON data layer for Copernicus historical data, and a Mapbox-powered frontend route `/glaciares`.

**Tech Stack:** Node.js, Express, TypeScript, Next.js, Mapbox GL JS, Open-Meteo API, OpenRouter (Mistral).

---

### Task 1: Shared Types & Backend Scaffolding

**Files:**
- Modify: `Backend/shared/types/index.ts`
- Create: `Backend/packages/agent-glacier/package.json`
- Create: `Backend/packages/agent-glacier/tsconfig.json`

- [ ] **Step 1: Update shared types**
Add `GlacierData`, `GlacierAnalysis`, and related types to the shared types package.

```typescript
// Backend/shared/types/index.ts
export interface GlacierInfo {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  altitude?: number;
  area_km2?: number;
}

export interface GlacierClimateData {
  temp_avg: number;
  temp_max: number;
  precipitation_mm: number;
  snowfall_cm: number;
  days_above_zero: number;
  thermal_anomaly: number;
}

export interface GlacierMassData {
  year: number;
  mass_change_mmwe: number;
}

export interface GlacierAnalysis {
  glacierInfo: GlacierInfo;
  climateData: GlacierClimateData;
  massHistory: GlacierMassData[];
  riskIndex: number;
  riskCategory: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  prediction: {
    trend: string;
    estimated_years_to_critical: number | null;
  };
  llmAnalysis: {
    summary: string;
    riskExplanation: string;
    prediction: string;
    urgentActions: string[];
    monitoringRecommendations: string[];
    publicAlert: string;
  };
}
```

- [ ] **Step 2: Create agent-glacier package.json**
Use a structure similar to `agent-fire`.

```json
{
  "name": "@sentinel/agent-glacier",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev src/index.ts"
  },
  "dependencies": {
    "@sentinel/types": "*",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.2"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**
Extend the base config.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Commit**
`git add . ; git commit -m "feat(glacier): initial scaffolding and types"`

---

### Task 2: Data Pre-processing & Initial Catalog

**Files:**
- Create: `Backend/packages/agent-glacier/data/glaciers-catalog.json`
- Create: `Backend/packages/agent-glacier/data/copernicus-processed.json`

- [ ] **Step 1: Create initial catalog**
Include the 10 glaciares requested with real coordinates.

```json
[
  { "id": "glaciar-grey", "name": "Glaciar Grey", "country": "Chile", "region": "Magallanes", "lat": -51.05, "lon": -73.15, "altitude": 200, "area_km2": 270 },
  { "id": "perito-moreno", "name": "Perito Moreno", "country": "Argentina", "region": "Santa Cruz", "lat": -50.48, "lon": -73.05, "altitude": 180, "area_km2": 250 }
]
```

- [ ] **Step 2: Mock/Process Copernicus data**
Create a JSON with historical mass change data for the catalog.

```json
{
  "glaciar-grey": [
    { "year": 2020, "mass_change_mmwe": -800 },
    { "year": 2021, "mass_change_mmwe": -950 },
    { "year": 2022, "mass_change_mmwe": -1100 }
  ]
}
```

- [ ] **Step 3: Commit**
`git add . ; git commit -m "data(glacier): initial catalog and historical data"`

---

### Task 3: Risk Calculator & OpenRouter Integration

**Files:**
- Create: `Backend/packages/agent-glacier/src/risk-calculator.ts`
- Create: `Backend/packages/agent-glacier/src/openrouter.ts`

- [ ] **Step 1: Implement Risk Calculator**
Logic based on thermal anomalies, mass trend, and days above 0°C.

```typescript
export function calculateGlacierRisk(climate: any, history: any[]) {
  let score = 0;
  // Factor Térmico (40%)
  score += Math.min(climate.days_above_zero * 2, 40);
  // Factor de Masa (40%)
  const lastChange = history[history.length - 1]?.mass_change_mmwe || 0;
  if (lastChange < -1000) score += 40;
  else if (lastChange < -500) score += 20;
  // ... rest of logic
  return Math.min(score, 100);
}
```

- [ ] **Step 2: OpenRouter Wrapper**
Standard implementation for calling Mistral.

- [ ] **Step 3: Commit**
`git add . ; git commit -m "feat(glacier): risk logic and llm wrapper"`

---

### Task 4: Backend Endpoints Implementation

**Files:**
- Create: `Backend/packages/agent-glacier/src/analyze.ts`
- Create: `Backend/packages/agent-glacier/src/index.ts`

- [ ] **Step 1: Implement analyze function**
Orchestrate catalog lookup, Open-Meteo fetch, risk calculation, and LLM analysis.

- [ ] **Step 2: Setup Express server**
Implement `GET /glaciers`, `GET /glaciers/risk-grid`, and `POST /analyze`.

- [ ] **Step 3: Commit**
`git add . ; git commit -m "feat(glacier): backend endpoints complete"`

---

### Task 5: Frontend Route & Basic Layout

**Files:**
- Create: `frontend/app/glaciares/page.tsx`
- Create: `frontend/components/glaciares/glacier-left-panel.tsx`

- [ ] **Step 1: Create /glaciares page**
Setup the AuthGuard and the main layout with Left, Map, and Right sections.

- [ ] **Step 2: Implement Left Panel**
Catalog list with search and basic stats.

- [ ] **Step 3: Commit**
`git add . ; git commit -m "feat(glacier): frontend route and left panel"`

---

### Task 6: Mapbox Integration (Heatmap & Markers)

**Files:**
- Create: `frontend/components/glaciares/glacier-map.tsx`

- [ ] **Step 1: Setup Mapbox component**
Add the heatmap layer for `risk-grid` and marker layer for individual glaciers.

- [ ] **Step 2: Handle selection**
Fly to glacier on selection and trigger analysis.

- [ ] **Step 3: Commit**
`git add . ; git commit -m "feat(glacier): interactive glacier map"`

---

### Task 7: Details Panel & IA Report

**Files:**
- Create: `frontend/components/glaciares/glacier-right-panel.tsx`
- Create: `frontend/components/glaciares/risk-indicator.tsx`

- [ ] **Step 1: Implement Details Panel**
Show climate indicators, historical mass chart (using Recharts or similar), and the AI analysis cards.

- [ ] **Step 2: Implement Risk Indicator**
Visual gauge (0-100) with color coding (Blue -> Red).

- [ ] **Step 3: Commit**
`git add . ; git commit -m "feat(glacier): details panel and ai report"`

---

### Task 8: Verification & Cleanup

- [ ] **Step 1: End-to-end test**
Verify that selecting a glacier triggers the backend analysis and updates the UI.

- [ ] **Step 2: Environment variables**
Ensure `OPENROUTER_API_KEY` and `MAPBOX_ACCESS_TOKEN` are documented.

- [ ] **Step 3: Final Commit**
`git add . ; git commit -m "feat(glacier): final integration and polish"`
