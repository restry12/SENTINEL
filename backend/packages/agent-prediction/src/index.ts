import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, PredictionResult } from '@sentinel/types'
import { predictIgnitionRisk } from './analyze'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const weather = body.weather ?? { speed: 0, deg: 0, humidity: 0 }

  try {
    const data = await predictIgnitionRisk(weather)
    res.json({ success: true, data } satisfies AgentResponse<PredictionResult>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<PredictionResult>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-prediction' }))

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => console.log(`[agent-prediction] running on port ${PORT}`))
