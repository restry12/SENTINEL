import type { FireData, RouteData, NaturalRoutes, RoutesResult } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
        - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
}

const EVACUATION_DESTINATIONS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Temuco Centro', lat: -38.7359, lon: -72.5904 },
  { name: 'Angol', lat: -37.7972, lon: -72.7085 },
  { name: 'Victoria', lat: -38.2333, lon: -72.3333 },
]

// Build a buffered bounding-box polygon around fire hotspots for ORS avoid_polygons
function buildAvoidPolygon(fires: FireData[]): object | undefined {
  if (fires.length === 0) return undefined
  const BUFFER_DEG = 0.15 // ~15 km buffer
  const lats = fires.map(f => f.lat)
  const lons = fires.map(f => f.lon)
  const minLat = Math.min(...lats) - BUFFER_DEG
  const maxLat = Math.max(...lats) + BUFFER_DEG
  const minLon = Math.min(...lons) - BUFFER_DEG
  const maxLon = Math.max(...lons) + BUFFER_DEG
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  }
}

async function fetchOrsRoute(
  apiKey: string,
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
  avoidPolygon?: object
): Promise<Omit<RouteData, 'id'> | null> {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car'
  const body: Record<string, unknown> = {
    coordinates: [[fromLon, fromLat], [toLon, toLat]],
  }
  if (avoidPolygon) body.options = { avoid_polygons: avoidPolygon }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

// A5: Safe Routes — natural language over ORS data
async function runA5(fires: FireData[], orsRoutes: RouteData[]): Promise<NaturalRoutes> {
  const fireArea = {
    hotspots: fires.slice(0, 10).map(f => ({ lat: f.lat, lon: f.lon, frp: f.frp })),
  }

  const roadNetwork = {
    rutas_principales: orsRoutes.map(r => r.id),
    ciudades_cercanas: EVACUATION_DESTINATIONS.map(d => d.name),
    distancias_km: orsRoutes.map(r => ({
      destino: r.id,
      distancia_km: Math.round(r.distance / 1000),
      duracion_min: Math.round(r.duration / 60),
    })),
  }

  const system = `Eres un experto en evacuaciones de emergencia y gestión de rutas seguras para incendios forestales.
Recibes datos de focos de incendio y red vial con tiempos reales calculados por OpenRouteService.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "rutas": [
    {
      "nombre": "nombre de la ruta",
      "origen": "punto de partida",
      "destino": "punto seguro de llegada",
      "distancia_km": número,
      "tiempo_estimado_min": número,
      "instrucciones": "descripción en lenguaje natural, clara y accionable",
      "estado": "LIBRE" | "CONGESTIONADA" | "BLOQUEADA",
      "prioridad": 1 | 2 | 3
    }
  ],
  "punto_encuentro_principal": "ubicación del punto de encuentro",
  "mensaje_alerta": "mensaje claro y urgente para la población en español"
}`

  const user = `Focos de incendio activos:\n${JSON.stringify(fireArea, null, 2)}\n\nRed vial disponible (datos ORS reales):\n${JSON.stringify(roadNetwork, null, 2)}\n\nGenera rutas de evacuación seguras con instrucciones en lenguaje natural.`

  const raw = await callOpenRouter(MODELS.small, system, user)
  return parseJSON<NaturalRoutes>(raw, 'Agent 5 (Routes)')
}

export async function calculateEvacuationRoutes(fires: FireData[]): Promise<RoutesResult> {
  if (fires.length === 0) return { routes: [], naturalRoutes: null }

  const apiKey = process.env.OPENROUTE_API_KEY
  const avgLat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
  const avgLon = fires.reduce((s, f) => s + f.lon, 0) / fires.length

  // ORS routes (geometry for map display, avoiding fire zone)
  const avoidPolygon = buildAvoidPolygon(fires)
  const bearingMap = new Map<string, number>()
  const routes: RouteData[] = []
  if (apiKey) {
    for (const dest of EVACUATION_DESTINATIONS) {
      try {
        const route = await fetchOrsRoute(apiKey, avgLon, avgLat, dest.lon, dest.lat, avoidPolygon)
        if (route) {
          routes.push({ ...route, id: dest.name })
          const coords = route.geometry.coordinates
          if (coords.length >= 2) {
            bearingMap.set(dest.name, initialBearing(
              coords[0][1], coords[0][0],
              coords[1][1], coords[1][0],
            ))
          }
        }
      } catch (err) {
        console.warn(`[agent-routes] route to ${dest.name} failed:`, err)
      }
    }
  }

  // A5: natural language layer over ORS results
  let naturalRoutes: NaturalRoutes | null = null
  try {
    naturalRoutes = await runA5(fires, routes)
    if (naturalRoutes) {
      for (const ruta of naturalRoutes.rutas) {
        let bearing = bearingMap.get(ruta.destino) ?? bearingMap.get(ruta.nombre)
        if (bearing === undefined) {
          for (const [key, val] of bearingMap) {
            if (
              ruta.destino?.toLowerCase().includes(key.toLowerCase()) ||
              ruta.nombre?.toLowerCase().includes(key.toLowerCase())
            ) {
              bearing = val
              break
            }
          }
        }
        if (bearing !== undefined) ruta.bearing_deg = bearing
      }
    }
  } catch (err) {
    console.warn('[agent-routes] A5 LLM failed, returning ORS routes only:', err)
  }

  return { routes, naturalRoutes }
}
