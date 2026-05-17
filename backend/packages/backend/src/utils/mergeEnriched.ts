import type { FireData } from '@sentinel/types'

// Mismo redondeo que dedupeFires (2 decimales) para que el match sea
// consistente con cómo se agruparon los focos.
function cellKey(f: FireData): string {
  return `${f.lat.toFixed(2)},${f.lon.toFixed(2)}`
}

// Superpone los focos enriquecidos sobre la lista completa: cada foco de `full`
// cuyo cell coincide con uno enriquecido se reemplaza por el enriquecido; el
// resto queda crudo. Si `full` está vacío (runId perdido) devuelve `enriched`.
export function mergeEnriched(full: FireData[], enriched: FireData[]): FireData[] {
  if (full.length === 0) return enriched
  const byCell = new Map<string, FireData>()
  for (const e of enriched) byCell.set(cellKey(e), e)
  return full.map(f => byCell.get(cellKey(f)) ?? f)
}
