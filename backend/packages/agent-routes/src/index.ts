import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, NaturalRoutes, FireData } from '@sentinel/types'
import { calculateEvacuationRoutes, calculateCitizenEscapeRoute } from './analyze'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const fires = body.firms ?? []

  try {
    const data = await calculateEvacuationRoutes(fires)
    res.json({ success: true, data } satisfies AgentResponse<typeof data>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<NaturalRoutes>)
  }
})

app.post('/analyze/citizen', async (req, res) => {
  const body = req.body as {
    userLat?: unknown
    userLon?: unknown
    fires?: unknown
    weather?: unknown
  }

  const userLat = typeof body.userLat === 'number' && isFinite(body.userLat) ? body.userLat : null
  const userLon = typeof body.userLon === 'number' && isFinite(body.userLon) ? body.userLon : null
  const rawFires = Array.isArray(body.fires) ? body.fires as Record<string, unknown>[] : []
  const fires = rawFires.filter(
    (f) =>
      typeof f?.lat === 'number' && isFinite(f.lat as number) &&
      typeof f?.lon === 'number' && isFinite(f.lon as number),
  ) as unknown as FireData[]
  const rawWeather = (body.weather && typeof body.weather === 'object' && !Array.isArray(body.weather))
    ? body.weather as Record<string, unknown>
    : {}
  const weather: WeatherData = {
    speed: typeof rawWeather.speed === 'number' && isFinite(rawWeather.speed) ? rawWeather.speed : 0,
    deg: typeof rawWeather.deg === 'number' && isFinite(rawWeather.deg) ? rawWeather.deg : 0,
    humidity: typeof rawWeather.humidity === 'number' && isFinite(rawWeather.humidity) ? rawWeather.humidity : 0,
    temp: typeof rawWeather.temp === 'number' && isFinite(rawWeather.temp) ? rawWeather.temp : undefined,
  }

  if (userLat === null || userLon === null) {
    res.status(400).json({ success: false, data: null, error: 'userLat and userLon required' })
    return
  }

  try {
    const data = await calculateCitizenEscapeRoute(userLat, userLon, fires, weather)
    res.json({ success: true, data } satisfies AgentResponse<typeof data>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<NaturalRoutes>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-routes' }))

const PORT = process.env.PORT ?? 3004
app.listen(PORT, () => console.log(`[agent-routes] running on port ${PORT}`))
