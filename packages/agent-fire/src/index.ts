import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, GeoJSONFeature } from '@sentinel/types'
import { analyzeFireExpansion } from './analyze'

const app = express()
app.use(express.json())

app.post('/analyze', (req, res) => {
  const body = req.body as AgentRequest
  const fires = body.firms ?? []
  const weather = body.weather ?? { speed: 0, deg: 0, humidity: 0 }

  try {
    const data = analyzeFireExpansion(fires, weather)
    const response: AgentResponse<GeoJSONFeature> = { success: true, data }
    res.json(response)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<GeoJSONFeature>)
  }
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-fire' })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[agent-fire] running on port ${PORT}`)
})
