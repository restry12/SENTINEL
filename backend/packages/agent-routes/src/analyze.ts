import type { FireData, RouteData, NaturalRoutes } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

const EVACUATION_DESTINATIONS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Temuco Centro', lat: -38.7359, lon: -72.5904 },
  { name: 'Angol', lat: -37.7972, lon: -72.7085 },
  { name: 'Victoria', lat: -38.2333, lon: -72.3333 },
]

export interface RoutesResult {
  routes: RouteData[]
  naturalRoutes: NaturalRoutes | null
}

// ORS route fetch (unchanged)
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

  // ORS routes (geometry for map display)
  const routes: RouteData[] = []
  if (apiKey) {
    for (const dest of EVACUATION_DESTINATIONS) {
      try {
        const route = await fetchOrsRoute(apiKey, avgLon, avgLat, dest.lon, dest.lat)
        if (route) routes.push({ ...route, id: dest.name })
      } catch (err) {
        console.warn(`[agent-routes] route to ${dest.name} failed:`, err)
      }
    }
  }

  // A5: natural language layer over ORS results
  let naturalRoutes: NaturalRoutes | null = null
  try {
    naturalRoutes = await runA5(fires, routes)
  } catch (err) {
    console.warn('[agent-routes] A5 LLM failed, returning ORS routes only:', err)
  }

  return { routes, naturalRoutes }
}
