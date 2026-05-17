import type { RegionGeometry } from '@sentinel/types'
import regionesData from './data/chile-regiones.json'

// codregion → 0-1 vegetation / fire-proneness proxy.
export const TERRAIN_BY_REGION: Record<number, number> = {
  15: 0.05,  // Arica y Parinacota
  1: 0.05,   // Tarapacá
  2: 0.05,   // Antofagasta
  3: 0.10,   // Atacama
  4: 0.30,   // Coquimbo
  5: 0.75,   // Valparaíso
  13: 0.75,  // Metropolitana
  6: 0.85,   // O'Higgins
  7: 0.95,   // Maule
  16: 1.00,  // Ñuble
  8: 1.00,   // Biobío
  9: 0.95,   // La Araucanía
  14: 0.85,  // Los Ríos
  10: 0.70,  // Los Lagos
  11: 0.45,  // Aysén
  12: 0.30,  // Magallanes
}

export interface ChileRegion {
  id: number
  nombre: string
  geometry: RegionGeometry
}

interface RegionFeature {
  type: string
  geometry: { type: string; coordinates: unknown }
  properties: { codregion: number; Region: string; [k: string]: unknown }
}

// Built once from the bundled GeoJSON FeatureCollection (16 features).
export const CHILE_REGIONS: ChileRegion[] = (
  (regionesData as { features: RegionFeature[] }).features
).map(f => ({
  id: f.properties.codregion,
  nombre: f.properties.Region,
  geometry: {
    type: f.geometry.type as RegionGeometry['type'],
    coordinates: f.geometry.coordinates as RegionGeometry['coordinates'],
  },
}))

// Ray-casting point-in-polygon over a single ring. ring is [[lon,lat],...].
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// True when the point is inside the region's outer ring (Polygon) or inside
// any polygon's outer ring (MultiPolygon). Holes are ignored (corner case).
export function pointInRegion(lon: number, lat: number, geometry: RegionGeometry): boolean {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][]
    if (rings.length === 0) return false
    return pointInRing(lon, lat, rings[0])
  }
  const polys = geometry.coordinates as number[][][][]
  for (const poly of polys) {
    if (poly.length > 0 && pointInRing(lon, lat, poly[0])) return true
  }
  return false
}

// Min/max lat/lon over every coordinate of the geometry.
export function regionBbox(geometry: RegionGeometry): {
  latMin: number; latMax: number; lonMin: number; lonMax: number
} {
  let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity
  const visit = (pt: number[]) => {
    const [lon, lat] = pt
    if (lon < lonMin) lonMin = lon
    if (lon > lonMax) lonMax = lon
    if (lat < latMin) latMin = lat
    if (lat > latMax) latMax = lat
  }
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates as number[][][]) {
      for (const pt of ring) visit(pt)
    }
  } else {
    for (const poly of geometry.coordinates as number[][][][]) {
      for (const ring of poly) {
        for (const pt of ring) visit(pt)
      }
    }
  }
  return { latMin, latMax, lonMin, lonMax }
}
