import { Delaunay } from 'd3-delaunay'
import type { AirStation } from './stations'

export interface VoronoiCell {
  id: string
  lat: number
  lon: number
  polygon: number[][][]
  stationIndex: number
}

let _gridCache: VoronoiCell[] | null = null

export function computeVoronoiGrid(stations: AirStation[]): VoronoiCell[] {
  if (_gridCache) return _gridCache

  const points: [number, number][] = stations.map(s => [s.lon, s.lat])
  const bounds: [number, number, number, number] = [-180, -90, 180, 90]

  const delaunay = Delaunay.from(points)
  const voronoi = delaunay.voronoi(bounds)

  const cells: VoronoiCell[] = []

  for (let i = 0; i < stations.length; i++) {
    const cellPolygon = voronoi.cellPolygon(i)
    if (!cellPolygon || cellPolygon.length < 4) continue

    // Skip huge cells (ocean/desert with sparse data)
    const area = polygonArea(cellPolygon)
    if (area > 100) continue

    const coords: number[][] = cellPolygon.map(([x, y]) => [
      Math.round(x * 10000) / 10000,
      Math.round(y * 10000) / 10000
    ])

    cells.push({
      id: stations[i].city,
      lat: stations[i].lat,
      lon: stations[i].lon,
      polygon: [coords],
      stationIndex: i,
    })
  }

  _gridCache = cells
  console.log(`[voronoi] generated ${cells.length} terrain-adaptive cells`)
  return cells
}

function polygonArea(ring: ArrayLike<[number, number]> & { length: number }): number {
  let area = 0
  const n = ring.length
  for (let i = 0; i < n - 1; i++) {
    area += ring[i][0] * ring[i + 1][1]
    area -= ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(area) / 2
}

export function clearVoronoiCache(): void {
  _gridCache = null
}
