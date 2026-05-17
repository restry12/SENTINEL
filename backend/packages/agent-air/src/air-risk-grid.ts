import type { FireData, WeatherData, AirRiskCell, AirRiskGridResult } from '@sentinel/types'
import { loadStations, haversineKm, type AirStation } from './stations'
import { computeVoronoiGrid, type VoronoiCell } from './voronoi'

function aqiToRiskLevel(aqi: number): AirRiskCell['risk_level'] {
  if (aqi <= 50) return 'LOW'
  if (aqi <= 100) return 'MODERATE'
  if (aqi <= 150) return 'HIGH'
  if (aqi <= 300) return 'CRITICAL'
  return 'EMERGENCY'
}

function mainPollutant(pm25: number, ozone: number, no2: number, co: number): string {
  const max = Math.max(pm25, ozone, no2, co)
  if (max === pm25) return 'PM2.5'
  if (max === ozone) return 'O3'
  if (max === no2) return 'NO2'
  return 'CO'
}

function degToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

function angleDiff(deg1: number, deg2: number): number {
  const diff = Math.abs(deg1 - deg2) % 360
  const d = diff > 180 ? 360 - diff : diff
  return d * Math.PI / 180
}

function computeSmokeContribution(
  cellLat: number,
  cellLon: number,
  fires: FireData[],
  weather: WeatherData,
  hours: number
): { smokePm25: number; nearestFireKm: number | null; smokeDir: string | null } {
  if (fires.length === 0) return { smokePm25: 0, nearestFireKm: null, smokeDir: null }

  const windSpeedKmh = weather.speed * 3.6
  const smokeTravelDeg = (weather.deg + 180) % 360
  const maxReach = Math.max(windSpeedKmh * Math.max(hours, 0.5), 10)

  let totalSmoke = 0
  let nearestFireKm: number | null = null

  for (const fire of fires) {
    const dist = haversineKm(cellLat, cellLon, fire.lat, fire.lon)

    if (nearestFireKm === null || dist < nearestFireKm) {
      nearestFireKm = dist
    }

    if (dist > maxReach) continue

    const fireToCell = Math.atan2(cellLon - fire.lon, cellLat - fire.lat) * 180 / Math.PI
    const fireToCellDeg = (fireToCell + 360) % 360
    const angDiff2 = angleDiff(smokeTravelDeg, fireToCellDeg)

    const sigma = Math.PI / 4
    const angularFactor = Math.exp(-(angDiff2 ** 2) / (2 * sigma ** 2))
    const distanceFactor = 1 / (1 + (dist / (maxReach * 0.4)) ** 2)
    const emission = (fire.frp / 100) * 30

    totalSmoke += emission * angularFactor * distanceFactor
  }

  const smokeDir = nearestFireKm !== null ? degToCardinal(smokeTravelDeg) : null
  return { smokePm25: Math.round(totalSmoke), nearestFireKm: nearestFireKm ? Math.round(nearestFireKm) : null, smokeDir }
}

function computeTrend(baseline: number, smokeContrib: number, hours: number): AirRiskCell['trend'] {
  if (hours === 0) return 'stable'
  const ratio = smokeContrib / Math.max(baseline, 1)
  if (ratio > 0.3) return 'worsening'
  if (ratio < -0.1) return 'improving'
  return 'stable'
}

function computeConfidence(hours: number, stationsNearby: number): number {
  let conf = 95
  conf -= hours * 3
  conf += stationsNearby > 3 ? 5 : 0
  return Math.max(30, Math.min(100, Math.round(conf)))
}

function computeGridForTime(
  cells: VoronoiCell[],
  stations: AirStation[],
  fires: FireData[],
  weather: WeatherData,
  hours: number
): AirRiskCell[] {
  return cells.map(cell => {
    const station = stations[cell.stationIndex]

    const { smokePm25, nearestFireKm, smokeDir } = computeSmokeContribution(
      cell.lat, cell.lon, fires, weather, hours
    )

    const adjustedPm25 = Math.min(station.pm25 + smokePm25, 500)
    const adjustedAqi = Math.max(adjustedPm25, station.ozone, station.no2, station.co)

    return {
      id: cell.id,
      lat: cell.lat,
      lon: cell.lon,
      polygon: cell.polygon,
      pm25: adjustedPm25,
      aqi: adjustedAqi,
      ozone: station.ozone,
      no2: station.no2,
      co: station.co,
      risk_level: aqiToRiskLevel(adjustedAqi),
      main_pollutant: mainPollutant(adjustedPm25, station.ozone, station.no2, station.co),
      confidence: computeConfidence(hours, 5),
      trend: computeTrend(station.pm25, smokePm25, hours),
      nearest_fire_km: nearestFireKm,
      smoke_direction: smokeDir,
    }
  })
}

export function getAirRiskGrid(fires: FireData[], weather: WeatherData): AirRiskGridResult {
  const stations = loadStations()
  const cells = computeVoronoiGrid(stations)

  return {
    now: computeGridForTime(cells, stations, fires, weather, 0),
    plus2h: computeGridForTime(cells, stations, fires, weather, 2),
    plus6h: computeGridForTime(cells, stations, fires, weather, 6),
    plus12h: computeGridForTime(cells, stations, fires, weather, 12),
    metadata: {
      stations_used: stations.length,
      coverage_area_km2: 510_000_000,
      generated_at: new Date().toISOString(),
    },
  }
}
