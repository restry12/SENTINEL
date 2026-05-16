import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, FireAnalysis } from '@sentinel/types'
import { analyzeFireExpansion } from './analyze'

const app = express()
app.use(express.json())

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const fires = body.firms ?? []
  const weather = body.weather ?? { speed: 0, deg: 0, humidity: 0 }

  try {
    const data = await analyzeFireExpansion(fires, weather)
    res.json({ success: true, data } satisfies AgentResponse<FireAnalysis>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<FireAnalysis>)
  }
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-fire' })
})

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[agent-fire] running on port ${PORT}`)
})
