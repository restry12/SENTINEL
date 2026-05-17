import { readFileSync } from 'fs'
import { resolve } from 'path'

export interface AirStation {
  city: string
  country: string
  lat: number
  lon: number
  aqi: number
  pm25: number
  ozone: number
  no2: number
  co: number
  category: string
}

let _cache: AirStation[] | null = null

export function loadStations(): AirStation[] {
  if (_cache) return _cache
  const filePath = resolve(__dirname, '../../../data/air-quality-stations.json')
  const raw = readFileSync(filePath, 'utf-8')
  _cache = JSON.parse(raw) as AirStation[]
  console.log(`[stations] loaded ${_cache.length} air quality stations`)
  return _cache
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function nearestStations(lat: number, lon: number, n: number, stations: AirStation[]): Array<AirStation & { dist: number }> {
  return stations
    .map(s => ({ ...s, dist: haversineKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
}
