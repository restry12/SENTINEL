import type { RiskCategory, RiskFactors, RegionDetail } from '@sentinel/types'
import { CHILE_REGIONS, regionBbox } from './regions'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

type Prioridad = RegionDetail['prioridad']

interface OverpassCountElement {
  tags?: { total?: string; nodes?: string; ways?: string; relations?: string }
}

function priorityFromScore(score: number): Prioridad {
  if (score >= 80) return 'critica'
  if (score >= 60) return 'alta'
  if (score >= 40) return 'media'
  return 'baja'
}

// Counts sensible facilities (hospital/school/kindergarten/fire_station/police)
// inside a bbox via a single Overpass `out count` query. Degrades to 0.
async function fetchInfrastructureCount(bbox: {
  latMin: number; latMax: number; lonMin: number; lonMax: number
}): Promise<number> {
  const query = `[out:json][timeout:25];(nwr["amenity"~"^(hospital|school|kindergarten|fire_station|police)$"](${bbox.latMin},${bbox.lonMin},${bbox.latMax},${bbox.lonMax}););out count;`
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { elements?: OverpassCountElement[] }
    const el = data.elements?.[0]
    if (!el?.tags) return 0
    const raw = el.tags.total ?? el.tags.nodes ?? el.tags.ways ?? el.tags.relations
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

interface RegionLLMOutput {
  explicacion: string
  recomendaciones: string[]
  prioridad: Prioridad
}

async function runRegionLLM(input: {
  nombre: string
  score: number
  category: RiskCategory
  factors: RiskFactors
  infraestructura_total: number
}): Promise<RegionLLMOutput> {
  const system = `Eres un experto en gestión de emergencias por incendios forestales en Chile.
Recibes el riesgo agregado de una región administrativa y la cantidad de infraestructura crítica que contiene.
Responde SOLO con JSON válido, sin markdown ni texto adicional, con esta estructura exacta:
{
  "explicacion": "por qué esta región tiene este nivel de riesgo, 2-3 frases",
  "recomendaciones": ["accion 1", "accion 2", "accion 3"],
  "prioridad": "baja" | "media" | "alta" | "critica"
}`
  const user = `Región: ${input.nombre}
Score de riesgo: ${input.score}/100 (categoría: ${input.category})
Factores: FWI ${input.factors.fwi}, Historial ${input.factors.historial}, Terreno ${input.factors.terreno}
Infraestructura sensible (hospitales, escuelas, jardines, bomberos, comisarías): ${input.infraestructura_total}

Genera el análisis de intervención para esta región.`
  const raw = await callOpenRouter(MODELS.large, system, user)
  const parsed = parseJSON<Partial<RegionLLMOutput>>(raw, 'Agent 6 (region-detail)')
  return {
    explicacion: typeof parsed.explicacion === 'string' ? parsed.explicacion : '',
    recomendaciones: Array.isArray(parsed.recomendaciones)
      ? parsed.recomendaciones.filter((x): x is string => typeof x === 'string')
      : [],
    prioridad: ['baja', 'media', 'alta', 'critica'].includes(parsed.prioridad as string)
      ? (parsed.prioridad as Prioridad)
      : priorityFromScore(input.score),
  }
}

export async function buildRegionDetail(input: {
  region_id: number
  nombre: string
  score: number
  category: RiskCategory
  factors: RiskFactors
}): Promise<RegionDetail> {
  const region = CHILE_REGIONS.find(r => r.id === input.region_id)

  let infraestructura_total = 0
  if (region) {
    infraestructura_total = await fetchInfrastructureCount(regionBbox(region.geometry))
  }

  const resumen_infraestructura = infraestructura_total > 0
    ? `~${infraestructura_total} instalaciones sensibles (hospitales, escuelas, jardines, bomberos y comisarías) en la región.`
    : 'Sin datos de infraestructura sensible para la región.'

  let explicacion = ''
  let recomendaciones: string[] = []
  let prioridad = priorityFromScore(input.score)
  try {
    const llm = await runRegionLLM({
      nombre: input.nombre,
      score: input.score,
      category: input.category,
      factors: input.factors,
      infraestructura_total,
    })
    explicacion = llm.explicacion
    recomendaciones = llm.recomendaciones
    prioridad = llm.prioridad
  } catch {
    // LLM degraded — keep score-based priority and empty text
  }

  return {
    region_id: input.region_id,
    nombre: input.nombre,
    infraestructura_total,
    resumen_infraestructura,
    explicacion,
    recomendaciones,
    prioridad,
  }
}
