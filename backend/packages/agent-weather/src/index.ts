import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse } from '@sentinel/types'
import { analyzeWeather, type WeatherAnalysis } from './analyze'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const weather = body.weather ?? { speed: 0, deg: 0, humidity: 0 }
  const fires = body.firms ?? []

  try {
    const data = await analyzeWeather(weather, fires)
    const response: AgentResponse<WeatherAnalysis> = { success: true, data }
    res.json(response)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<WeatherAnalysis>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-weather' }))

const PORT = process.env.PORT ?? 3002
app.listen(PORT, () => console.log(`[agent-weather] running on port ${PORT}`))
