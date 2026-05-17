# Fire Expansion — Regional Context Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken quadratic fire expansion formula with two LLM agents per fire (A_context for regional calibration + A2 per-fire for expansion polygons), running in parallel for the top 50 fires, and wire the frontend to consume backend results instead of recalculating locally.

**Architecture:** `runAContext` infers regional fire behavior from coordinates (region, vegetation, terrain, calibration factors). `runA2PerFire` uses that context to produce realistic expansion values. Both run sequentially per fire, all 50 fires in parallel via `Promise.allSettled`. The frontend drops `computeFireSpreadArea` and looks up `perFireExpansions` from the socket update.

**Tech Stack:** TypeScript, OpenRouter (mistral-large), vitest, Next.js, Socket.io

**Branch:** `feature/fire-expansion-regional-agents`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/shared/types/index.ts` | Modify | Add `RegionalContext`; add `regional_context` to `PerFireExpansion` |
| `backend/packages/agent-fire/package.json` | Modify | Add vitest devDependency |
| `backend/packages/agent-fire/src/analyze.ts` | Modify | Add `runAContext`, `runA2PerFire`, `analyzePerFire`; update `analyzeFireExpansion`; remove `computePerFireExpansions` |
| `backend/packages/agent-fire/src/analyze.test.ts` | Create | Unit tests for pure helper functions |
| `frontend/components/dashboard/mapbox-panel.tsx` | Modify | Remove `computeFireSpreadArea`; replace fire-click logic with `perFireExpansions` lookup |

---

## Task 1: Add `RegionalContext` type and update `PerFireExpansion`

**Files:**
- Modify: `backend/shared/types/index.ts`

- [ ] **Step 1: Add `RegionalContext` interface after the `PerFireExpansion` block**

Open `backend/shared/types/index.ts`. After line 122 (closing `}` of `PerFireExpansion`), insert:

```ts
export interface RegionalContext {
  region_name: string
  country: string
  vegetation_type: string
  terrain_type: string
  spread_multiplier: number   // 0.5–2.0 relative to base rate
  max_ros_kmh: number         // absolute ceiling for rate of spread in this region
  reference_fires: string[]   // real historical fires used as calibration anchors
  context_summary: string     // brief narrative fed to A2
}
```

- [ ] **Step 2: Add `regional_context` field to `PerFireExpansion`**

In `backend/shared/types/index.ts`, update `PerFireExpansion`:

```ts
export interface PerFireExpansion {
  lat: number
  lon: number
  frp: number
  expansion_2h_km2: number
  expansion_6h_km2: number
  expansion_12h_km2: number
  velocidad_kmh: number
  direccion: string
  regional_context: RegionalContext
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npm run build 2>&1 | head -30
```

Expected: errors only about `computePerFireExpansions` returning the old type (will be fixed in Task 4). No errors in `shared/types`.

- [ ] **Step 4: Commit**

```bash
git add backend/shared/types/index.ts
git commit -m "feat(types): add RegionalContext, extend PerFireExpansion"
```

---

## Task 2: Add vitest to agent-fire and write tests for pure helpers

**Files:**
- Modify: `backend/packages/agent-fire/package.json`
- Create: `backend/packages/agent-fire/src/analyze.test.ts`

- [ ] **Step 1: Add vitest to agent-fire package.json**

Replace the `scripts` and `devDependencies` sections in `backend/packages/agent-fire/package.json`:

```json
{
  "name": "@sentinel/agent-fire",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@sentinel/types": "*",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.0",
    "tsx": "^4.7.2",
    "typescript": "^5.4.5",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 2: Install vitest**

```bash
cd backend && npm install
```

Expected: installs vitest in agent-fire, no errors.

- [ ] **Step 3: Export pure helpers from analyze.ts**

In `backend/packages/agent-fire/src/analyze.ts`, add `export` to the two pure functions at the top:

```ts
export function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function centroid(fires: { lat: number; lon: number }[]): { lat: number; lon: number } {
  const lat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
  const lon = fires.reduce((s, f) => s + f.lon, 0) / fires.length
  return { lat: parseFloat(lat.toFixed(4)), lon: parseFloat(lon.toFixed(4)) }
}
```

- [ ] **Step 4: Write the failing tests**

Create `backend/packages/agent-fire/src/analyze.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { degreesToCardinal, centroid } from './analyze'

describe('degreesToCardinal', () => {
  it('returns N for 0°', () => {
    expect(degreesToCardinal(0)).toBe('N')
  })

  it('returns E for 90°', () => {
    expect(degreesToCardinal(90)).toBe('E')
  })

  it('returns S for 180°', () => {
    expect(degreesToCardinal(180)).toBe('S')
  })

  it('returns W for 270°', () => {
    expect(degreesToCardinal(270)).toBe('W')
  })

  it('returns NE for 45°', () => {
    expect(degreesToCardinal(45)).toBe('NE')
  })

  it('returns SW for 225°', () => {
    expect(degreesToCardinal(225)).toBe('SW')
  })
})

describe('centroid', () => {
  it('returns the average lat/lon of a single fire', () => {
    const result = centroid([{ lat: -38.5, lon: -71.2 }])
    expect(result.lat).toBe(-38.5)
    expect(result.lon).toBe(-71.2)
  })

  it('averages lat/lon across multiple fires', () => {
    const result = centroid([
      { lat: -38.0, lon: -71.0 },
      { lat: -40.0, lon: -73.0 },
    ])
    expect(result.lat).toBe(-39.0)
    expect(result.lon).toBe(-72.0)
  })

  it('rounds to 4 decimal places', () => {
    const result = centroid([
      { lat: -38.12345678, lon: -71.98765432 },
      { lat: -38.12345678, lon: -71.98765432 },
    ])
    expect(result.lat.toString().split('.')[1]?.length).toBeLessThanOrEqual(4)
  })
})
```

- [ ] **Step 5: Run tests — confirm they fail (function not exported yet)**

```bash
cd backend/packages/agent-fire && npx vitest run
```

Expected: FAIL — `degreesToCardinal is not a function` or similar (not exported yet).

- [ ] **Step 6: Add exports (Step 3 above) and run again**

```bash
cd backend/packages/agent-fire && npx vitest run
```

Expected: all 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/packages/agent-fire/package.json backend/packages/agent-fire/src/analyze.test.ts backend/packages/agent-fire/src/analyze.ts
git commit -m "test(agent-fire): add vitest, export and test pure helpers"
```

---

## Task 3: Implement `runAContext`

**Files:**
- Modify: `backend/packages/agent-fire/src/analyze.ts`

- [ ] **Step 1: Update imports at the top of analyze.ts**

Replace the existing import line:

```ts
import type { FireData, WeatherData, FireAnalysis, RiskAssessment, ExpansionData, GeoJSONFeature, PerFireExpansion } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'
```

With:

```ts
import type { FireData, WeatherData, FireAnalysis, RiskAssessment, ExpansionData, GeoJSONFeature, PerFireExpansion, RegionalContext } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'
```

- [ ] **Step 2: Add `runAContext` function after `toClimateData`**

Insert this block in `backend/packages/agent-fire/src/analyze.ts` after the `toClimateData` function (around line 45):

```ts
// A_context: Regional fire behavior inference from coordinates
async function runAContext(fire: FireData): Promise<RegionalContext> {
  const system = `Eres un experto en comportamiento de incendios forestales en América Latina.
Recibes las coordenadas exactas de un foco de incendio y debes inferir el contexto regional de comportamiento del fuego.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "region_name": "nombre descriptivo de la región geográfica",
  "country": "país donde se localiza el foco",
  "vegetation_type": "tipo de vegetación predominante en la zona",
  "terrain_type": "tipo de terreno (montañoso, planicie, costal, etc.)",
  "spread_multiplier": número entre 0.5 y 2.0 que escala la tasa base de propagación relativa a un incendio típico,
  "max_ros_kmh": número máximo realista de tasa de propagación en km/h para esta región y vegetación,
  "reference_fires": ["array de 1-3 incendios reales históricos de la zona en formato 'Nombre Año: X ha en Y horas con vientos de Z km/h'"],
  "context_summary": "resumen breve del comportamiento típico del fuego en esta región para calibrar predicciones"
}
CRITERIOS DE CALIBRACIÓN:
- Estepa patagónica / pastizales secos: spread_multiplier 1.4-2.0, max_ros_kmh 15-20
- Bosque templado húmedo (Araucanía, Valdivia): spread_multiplier 0.6-0.8, max_ros_kmh 5-8
- Bosque mediterráneo / matorral (Chile central): spread_multiplier 1.0-1.3, max_ros_kmh 8-12
- Amazonia / selva tropical: spread_multiplier 0.4-0.6, max_ros_kmh 2-5
- Cerrado brasileño / sabana: spread_multiplier 1.2-1.6, max_ros_kmh 10-15
- Chaco: spread_multiplier 1.1-1.5, max_ros_kmh 8-14`

  const user = `Foco de incendio en lat ${fire.lat}, lon ${fire.lon} (FRP: ${fire.frp} MW).
Infiere el contexto regional y devuelve el JSON de calibración.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON<RegionalContext>(raw, 'A_context')
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new errors from `runAContext`.

- [ ] **Step 4: Commit**

```bash
git add backend/packages/agent-fire/src/analyze.ts
git commit -m "feat(agent-fire): add runAContext — regional fire behavior inference"
```

---

## Task 4: Implement `runA2PerFire`

**Files:**
- Modify: `backend/packages/agent-fire/src/analyze.ts`

- [ ] **Step 1: Define the A2 per-fire output type (inline, no shared type needed)**

Add this type alias at the top of `analyze.ts`, after the imports:

```ts
type PerFireExpansionFields = Pick<PerFireExpansion, 'expansion_2h_km2' | 'expansion_6h_km2' | 'expansion_12h_km2' | 'velocidad_kmh' | 'direccion'>
```

- [ ] **Step 2: Add `runA2PerFire` function after `runAContext`**

```ts
// A2 per-fire: expansion predictor calibrated with regional context
async function runA2PerFire(
  fire: FireData,
  weather: WeatherData,
  ctx: RegionalContext,
): Promise<PerFireExpansionFields> {
  const windKmh = Math.round(weather.speed * 3.6)
  const windDir = degreesToCardinal((weather.deg + 180) % 360)

  const system = `Eres un experto en modelado de propagación de incendios forestales en América Latina.
Recibes datos de un foco específico y un contexto regional que DEBES usar como restricción absoluta.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "expansion_2h_km2": número (área estimada en km² a las 2 horas),
  "expansion_6h_km2": número (área estimada en km² a las 6 horas),
  "expansion_12h_km2": número (área estimada en km² a las 12 horas),
  "velocidad_kmh": número (tasa de propagación en km/h),
  "direccion": "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
}
RESTRICCIONES ABSOLUTAS (no negociables):
1. velocidad_kmh NUNCA puede superar max_ros_kmh del contexto regional
2. expansion_12h_km2 NUNCA puede superar 3 × (max_ros_kmh × 12)² × π / 4
3. Los valores deben ser coherentes con reference_fires del contexto regional
4. La progresión debe ser realista: expansion_6h < expansion_12h, expansion_2h < expansion_6h
5. Aplicar spread_multiplier del contexto regional sobre la tasa base calculada por el viento`

  const user = `FOCO: lat ${fire.lat}, lon ${fire.lon}, FRP ${fire.frp} MW
CLIMA: viento ${windKmh} km/h dirección ${windDir}, humedad ${weather.humidity}%
CONTEXTO REGIONAL:
${JSON.stringify(ctx, null, 2)}
Calcula la expansión del incendio respetando las restricciones absolutas del contexto regional.`

  const raw = await callOpenRouter(MODELS.large, system, user)
  return parseJSON<PerFireExpansionFields>(raw, 'A2PerFire')
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new errors from `runA2PerFire`.

- [ ] **Step 4: Commit**

```bash
git add backend/packages/agent-fire/src/analyze.ts
git commit -m "feat(agent-fire): add runA2PerFire — per-fire expansion with regional constraints"
```

---

## Task 5: Add `analyzePerFire`, update `analyzeFireExpansion`, remove `computePerFireExpansions`

**Files:**
- Modify: `backend/packages/agent-fire/src/analyze.ts`

- [ ] **Step 1: Add `analyzePerFire` orchestrator after `runA2PerFire`**

```ts
async function analyzePerFire(fire: FireData, weather: WeatherData): Promise<PerFireExpansion> {
  const ctx = await runAContext(fire)
  const exp = await runA2PerFire(fire, weather, ctx)
  return {
    lat: fire.lat,
    lon: fire.lon,
    frp: fire.frp,
    ...exp,
    regional_context: ctx,
  }
}
```

- [ ] **Step 2: Remove `computePerFireExpansions`**

Delete the entire `computePerFireExpansions` function (lines 112–144 in the original file — the block starting with `// Mathematical fire spread model` and ending with the closing `}`).

- [ ] **Step 3: Update `analyzeFireExpansion` to use top-50 parallel**

Replace the current `analyzeFireExpansion` function body with:

```ts
export async function analyzeFireExpansion(fires: FireData[], weather: WeatherData): Promise<FireAnalysis> {
  if (fires.length === 0) return EMPTY

  const nasaData = toNasaData(fires)
  const climateData = toClimateData(weather)
  const center = centroid(fires)

  // Top 50 fires by FRP — per-fire agents in parallel
  const top50 = [...fires].sort((a, b) => b.frp - a.frp).slice(0, 50)
  const [a1Result, perFireResults] = await Promise.all([
    runA1(nasaData, climateData),
    Promise.allSettled(top50.map(f => analyzePerFire(f, weather))),
  ])

  const perFireExpansions = perFireResults
    .filter((r): r is PromiseFulfilledResult<PerFireExpansion> => r.status === 'fulfilled')
    .map(r => r.value)

  try {
    const a2 = await runA2(a1Result, climateData, center)
    return {
      polygon: expansionToGeoJSON(a2),
      riskAssessment: a1Result,
      expansion: a2,
      perFireExpansions,
    }
  } catch {
    return {
      ...EMPTY,
      riskAssessment: a1Result,
      perFireExpansions,
    }
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd backend && npm run build 2>&1 | grep -E "error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd backend/packages/agent-fire && npx vitest run
```

Expected: all 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/packages/agent-fire/src/analyze.ts
git commit -m "feat(agent-fire): wire analyzePerFire — top-50 parallel LLM expansion, remove math formula"
```

---

## Task 6: Update frontend — remove local recalc, use `perFireExpansions` lookup

**Files:**
- Modify: `frontend/components/dashboard/mapbox-panel.tsx`

- [ ] **Step 1: Delete `computeFireSpreadArea` function**

Remove the entire function from `mapbox-panel.tsx` (lines 86–95):

```ts
// DELETE THIS ENTIRE FUNCTION:
function computeFireSpreadArea(windSpeedMs: number, hours: number) {
  const windKmh = windSpeedMs * 3.6
  const ros_f = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_b = 0.3
  const ros_l = Math.sqrt(ros_f * ros_b)
  const a = (ros_f * hours + ros_b * hours) / 2
  const b = Math.max(ros_l * hours, 0.3)
  const km2 = Math.PI * a * b
  return { km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) }
}
```

- [ ] **Step 2: Replace fire click expansion logic**

In the `openFire` function (around line 237), replace:

```ts
const fireWDeg   = weather?.deg   ?? 0
const fireWSpeed = weather?.speed ?? 0
const fireSDeg   = (fireWDeg + 180) % 360
const fireSDirLabel = degToCompass(fireSDeg)
const fireWKmh   = Math.round(fireWSpeed * 3.6)
const fireA2  = computeFireSpreadArea(fireWSpeed, 2)
const fireA6  = computeFireSpreadArea(fireWSpeed, 6)
const fireA12 = computeFireSpreadArea(fireWSpeed, 12)
```

With:

```ts
const fireWDeg   = weather?.deg   ?? 0
const fireWSpeed = weather?.speed ?? 0
const fireSDeg   = (fireWDeg + 180) % 360
const fireSDirLabel = degToCompass(fireSDeg)
const fireWKmh   = Math.round(fireWSpeed * 3.6)

const perFire = sentinelUpdate?.perFireExpansions
  ?.find(e => e.lat === lat && e.lon === lon)
const toArea = (km2: number) => ({ km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) })
const fireA2  = perFire ? toArea(perFire.expansion_2h_km2)  : undefined
const fireA6  = perFire ? toArea(perFire.expansion_6h_km2)  : undefined
const fireA12 = perFire ? toArea(perFire.expansion_12h_km2) : undefined
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Verify widget handles `undefined` gracefully**

In `TacticalExpansionWidget` (`frontend/components/dashboard/tactical-expansion-widget.tsx`), confirm line ~74 reads:

```ts
<span ...>{ar ? fmtKm2(ar.km2) : '—'}</span>
```

If it already does (it should — check the file), no change needed. Fires outside top 50 or with failed LLM calls will show `—`.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/mapbox-panel.tsx
git commit -m "feat(frontend): use perFireExpansions from backend, remove local computeFireSpreadArea"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** `RegionalContext` type ✓ | `runAContext` ✓ | `runA2PerFire` ✓ | `analyzePerFire` ✓ | top-50 parallel ✓ | remove `computePerFireExpansions` ✓ | frontend lookup ✓ | fallback `—` for missing fires ✓ | global A1/A2 unchanged ✓
- [x] **No placeholders:** All steps have exact code, commands, and expected output
- [x] **Type consistency:** `RegionalContext` defined in Task 1, imported in Task 3; `PerFireExpansionFields` defined and used within Task 4; `PerFireExpansion` (with `regional_context`) assembled in `analyzePerFire` in Task 5
- [x] **`centroid` signature:** Updated to `{ lat: number; lon: number }[]` in Task 2 Step 3 to allow passing `FireData[]` (which has those fields)
