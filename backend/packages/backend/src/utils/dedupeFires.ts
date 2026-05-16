import type { FireData } from '@sentinel/types'

// NASA FIRMS reporta el mismo incendio en múltiples pasadas de satélite
// (filas distintas, coordenada casi idéntica). Agrupamos por coordenada
// redondeada a 2 decimales (~1.1 km) y conservamos la detección de mayor FRP.
export function dedupeFires(fires: FireData[]): FireData[] {
  const byCell = new Map<string, FireData>()
  for (const fire of fires) {
    const key = `${fire.lat.toFixed(2)},${fire.lon.toFixed(2)}`
    const existing = byCell.get(key)
    if (!existing || fire.frp > existing.frp) byCell.set(key, fire)
  }
  return [...byCell.values()].sort((a, b) => b.frp - a.frp)
}
