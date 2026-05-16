import type { FireData, RouteData } from '@sentinel/types'

const EVACUATION_DESTINATIONS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Temuco Centro', lat: -38.7359, lon: -72.5904 },
  { name: 'Angol', lat: -37.7972, lon: -72.7085 },
  { name: 'Victoria', lat: -38.2333, lon: -72.3333 },
]

// polygon param removed — fire perimeter is not used in route calculation (origin is fire centroid)
export async function calculateEvacuationRoutes(fires: FireData[]): Promise<RouteData[]> {
  if (fires.length === 0) return []

  const apiKey = process.env.OPENROUTE_API_KEY
  if (!apiKey) return []

  const avgLat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
  const avgLon = fires.reduce((s, f) => s + f.lon, 0) / fires.length

  const routes: RouteData[] = []

  for (const dest of EVACUATION_DESTINATIONS) {
    try {
      const route = await fetchOrsRoute(apiKey, avgLon, avgLat, dest.lon, dest.lat)
      if (route) routes.push({ ...route, id: dest.name })
    } catch (err) {
      console.warn(`[agent-routes] route to ${dest.name} failed:`, err)
    }
  }

  return routes
}

async function fetchOrsRoute(
  apiKey: string,
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): Promise<Omit<RouteData, 'id'> | null> {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [[fromLon, fromLat], [toLon, toLat]],
    }),
  })

  if (!res.ok) {
    console.warn(`[agent-routes] ORS returned ${res.status} for route to [${toLon},${toLat}]`)
    return null
  }

  const json = await res.json() as {
    routes: Array<{
      geometry: { coordinates: [number, number][] }
      summary: { distance: number; duration: number }
    }>
  }

  const route = json.routes[0]
  if (!route) return null

  return {
    geometry: { type: 'LineString', coordinates: route.geometry.coordinates },
    distance: route.summary.distance,
    duration: route.summary.duration,
  }
}
