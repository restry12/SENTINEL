import type { FireData, WeatherData, GeoJSONFeature } from '@sentinel/types'

function expansionRadius(frp: number, windSpeed: number): number {
  const base = Math.sqrt(frp) * 100
  const windFactor = 1 + windSpeed * 0.1
  return base * windFactor
}

function circlePolygon(lat: number, lon: number, radiusM: number): [number, number][] {
  const points: [number, number][] = []
  const earthRadius = 6371000
  const deltaLat = (radiusM / earthRadius) * (180 / Math.PI)
  const deltaLon = deltaLat / Math.cos((lat * Math.PI) / 180)

  for (let i = 0; i <= 16; i++) {
    const angle = (i * 360) / 16
    const rad = (angle * Math.PI) / 180
    points.push([lon + deltaLon * Math.cos(rad), lat + deltaLat * Math.sin(rad)])
  }
  return points
}

export function analyzeFireExpansion(
  fires: FireData[],
  weather: WeatherData
): GeoJSONFeature {
  if (fires.length === 0) {
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [] as number[][][] },
      properties: { fireCount: 0, riskZone: false },
    }
  }

  const mainFire = fires.reduce((max, f) => (f.frp > max.frp ? f : max), fires[0])
  const radius = expansionRadius(mainFire.frp, weather.speed)
  const coordinates = circlePolygon(mainFire.lat, mainFire.lon, radius)

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coordinates] as number[][][] },
    properties: {
      fireCount: fires.length,
      mainFrp: mainFire.frp,
      expansionRadiusM: Math.round(radius),
      windSpeed: weather.speed,
      windDeg: weather.deg,
      riskZone: true,
    },
  }
}
