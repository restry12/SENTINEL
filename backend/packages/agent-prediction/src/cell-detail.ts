import type { CellInfrastructure, CellSocialImpact } from '@sentinel/types'

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

const TYPE_WEIGHT: Record<CellInfrastructure['type'], number> = {
  hospital: 30,
  kindergarten: 25,
  school: 20,
  police: 12,
  fire_station: 8,
}

const TYPE_LABEL: Record<CellInfrastructure['type'], string> = {
  hospital: 'hospital(es)',
  kindergarten: 'jardín(es) infantil(es)',
  school: 'escuela(s)',
  police: 'comisaría(s)',
  fire_station: 'cuartel(es) de bomberos',
}

export function socialImpact(infra: CellInfrastructure[]): CellSocialImpact {
  const raw = infra.reduce((s, i) => s + TYPE_WEIGHT[i.type], 0)
  const score = Math.min(100, raw)
  const counts = new Map<CellInfrastructure['type'], number>()
  for (const i of infra) counts.set(i.type, (counts.get(i.type) ?? 0) + 1)
  const parts = [...counts.entries()].map(([t, n]) => `${n} ${TYPE_LABEL[t]}`)
  const resumen = parts.length > 0
    ? `Infraestructura sensible en la celda: ${parts.join(', ')}.`
    : 'Sin infraestructura sensible registrada en la celda.'
  return { score, resumen }
}

import type { FireRiskCell, CellDetail } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

const AMENITY_TYPE: Record<string, CellInfrastructure['type']> = {
  hospital: 'hospital',
  school: 'school',
  kindergarten: 'kindergarten',
  fire_station: 'fire_station',
  police: 'police',
}

interface OverpassNode {
  lat: number
  lon: number
  tags?: Record<string, string>
}

export async function fetchInfrastructure(cell: FireRiskCell): Promise<CellInfrastructure[]> {
  const latMin = cell.lat
  const latMax = cell.lat + cell.size
  const lonMin = cell.lon
  const lonMax = cell.lon + cell.size
  const centerLat = cell.lat + cell.size / 2
  const centerLon = cell.lon + cell.size / 2
  const query = `[out:json][timeout:25];
(
  node["amenity"~"hospital|school|kindergarten|fire_station|police"](${latMin},${lonMin},${latMax},${lonMax});
);
out body;`
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { elements?: OverpassNode[] }
    return (data.elements ?? [])
      .filter(n => n.tags?.name && n.tags?.amenity && AMENITY_TYPE[n.tags.amenity])
      .map(n => ({
        name: n.tags!.name,
        type: AMENITY_TYPE[n.tags!.amenity],
        lat: n.lat,
        lon: n.lon,
        distance_km: Math.round(haversineKm(centerLat, centerLon, n.lat, n.lon) * 10) / 10,
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
  } catch {
    return []
  }
}

function priorityFromScore(score: number): CellDetail['prioridad'] {
  if (score >= 80) return 'critica'
  if (score >= 60) return 'alta'
  if (score >= 40) return 'media'
  return 'baja'
}

interface CellLLMOutput {
  explicacion: string
  recomendaciones: string[]
  prioridad: CellDetail['prioridad']
}

async function runCellLLM(
  cell: FireRiskCell,
  infra: CellInfrastructure[],
  impact: CellSocialImpact,
): Promise<CellLLMOutput> {
  const system = `Eres un experto en gestión de emergencias por incendios forestales en Chile.
Recibes el riesgo de una celda geográfica y la infraestructura crítica que contiene.
Responde SOLO con JSON válido, sin markdown ni texto adicional, con esta estructura exacta:
{
  "explicacion": "por qué esta celda tiene este nivel de riesgo, 2-3 frases",
  "recomendaciones": ["accion 1", "accion 2", "accion 3"],
  "prioridad": "baja" | "media" | "alta" | "critica"
}`
  const user = `Celda ${cell.id} — zona: ${cell.zona}
Score de riesgo: ${cell.score}/100 (categoría: ${cell.category})
Factores: FWI ${cell.factors.fwi}, Historial ${cell.factors.historial}, Terreno ${cell.factors.terreno}
Impacto social: ${impact.score}/100 — ${impact.resumen}
Infraestructura: ${infra.length > 0
    ? infra.map(i => `${i.type} "${i.name}" a ${i.distance_km} km`).join('; ')
    : 'ninguna registrada'}

Genera el análisis de intervención para esta celda.`
  const raw = await callOpenRouter(MODELS.large, system, user)
  const parsed = parseJSON<Partial<CellLLMOutput>>(raw, 'Agent 6 (cell-detail)')
  return {
    explicacion: typeof parsed.explicacion === 'string' ? parsed.explicacion : '',
    recomendaciones: Array.isArray(parsed.recomendaciones)
      ? parsed.recomendaciones.filter((x): x is string => typeof x === 'string')
      : [],
    prioridad: ['baja', 'media', 'alta', 'critica'].includes(parsed.prioridad as string)
      ? (parsed.prioridad as CellDetail['prioridad'])
      : priorityFromScore(cell.score),
  }
}

export async function buildCellDetail(cell: FireRiskCell): Promise<CellDetail> {
  const infrastructure = await fetchInfrastructure(cell)
  const impact = socialImpact(infrastructure)

  let explicacion = ''
  let recomendaciones: string[] = []
  let prioridad = priorityFromScore(cell.score)
  try {
    const llm = await runCellLLM(cell, infrastructure, impact)
    explicacion = llm.explicacion
    recomendaciones = llm.recomendaciones
    prioridad = llm.prioridad
  } catch {
    // LLM degraded — keep score-based priority and empty text
  }

  return {
    cell_id: cell.id,
    infrastructure,
    social_impact: impact,
    explicacion,
    recomendaciones,
    prioridad,
  }
}
