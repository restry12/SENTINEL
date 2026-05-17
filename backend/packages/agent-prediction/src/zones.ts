export const GRID_LAT_MIN = -56
export const GRID_LON_MIN = -76
export const CELL_DEG = 0.25

export interface ZoneBand {
  name: string
  latMin: number
  latMax: number
  lonMin: number
  lonMax: number
  terrain: number   // 0-1 vegetation/fire-proneness proxy
}

// Latitude bands of continental Chile. lonMin/lonMax clip ocean + Argentina;
// terrain is the vegetation proxy (max in the Mediterranean/forestal centre-south).
export const ZONAS_CHILE: ZoneBand[] = [
  { name: 'Norte Grande (desierto Atacama)',         latMin: -26.0, latMax: -17.5, lonMin: -70.5, lonMax: -67.0, terrain: 0.05 },
  { name: 'Norte Chico (semiárido)',                 latMin: -32.0, latMax: -26.0, lonMin: -71.7, lonMax: -69.5, terrain: 0.25 },
  { name: 'Zona Central (mediterránea)',             latMin: -36.0, latMax: -32.0, lonMin: -72.5, lonMax: -69.8, terrain: 0.75 },
  { name: 'Centro-Sur (forestal)',                   latMin: -39.0, latMax: -36.0, lonMin: -73.7, lonMax: -70.8, terrain: 1.00 },
  { name: 'Araucanía / Los Lagos (bosque templado)', latMin: -44.0, latMax: -39.0, lonMin: -74.3, lonMax: -71.0, terrain: 0.90 },
  { name: 'Aysén (bosque patagónico húmedo)',        latMin: -49.0, latMax: -44.0, lonMin: -75.7, lonMax: -71.5, terrain: 0.50 },
  { name: 'Magallanes (estepa fría)',                latMin: -56.0, latMax: -49.0, lonMin: -75.5, lonMax: -66.0, terrain: 0.30 },
]

// 0->A, 25->Z, 26->AA ... handles up to 51 columns (grid has ~40).
export function columnLabel(col: number): string {
  if (col < 26) return String.fromCharCode(65 + col)
  return 'A' + String.fromCharCode(65 + (col - 26))
}

// Stable global cell id from the cell's SW corner.
export function cellId(lat: number, lon: number): string {
  const col = Math.round((lon - GRID_LON_MIN) / CELL_DEG)
  const row = Math.round((lat - GRID_LAT_MIN) / CELL_DEG)
  return `${columnLabel(col)}-${row}`
}

export function terrainFor(lat: number): number {
  for (const z of ZONAS_CHILE) {
    if (lat >= z.latMin && lat < z.latMax) return z.terrain
  }
  return 0
}

export function zoneNameFor(lat: number): string {
  for (const z of ZONAS_CHILE) {
    if (lat >= z.latMin && lat < z.latMax) return z.name
  }
  return 'Fuera de zona'
}

export interface RawCell {
  lat: number       // SW corner
  lon: number       // SW corner
  zone: ZoneBand
}

// Every land cell, clipped to continental Chile by latitude band.
export function iterateCells(): RawCell[] {
  const cells: RawCell[] = []
  for (const z of ZONAS_CHILE) {
    for (let lat = z.latMin; lat < z.latMax - 1e-9; lat += CELL_DEG) {
      for (let lon = z.lonMin; lon < z.lonMax - 1e-9; lon += CELL_DEG) {
        cells.push({
          lat: Math.round(lat * 100) / 100,
          lon: Math.round(lon * 100) / 100,
          zone: z,
        })
      }
    }
  }
  return cells
}
