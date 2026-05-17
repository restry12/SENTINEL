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
