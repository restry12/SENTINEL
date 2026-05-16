import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse } from '@sentinel/types'
import { analyzeAir, type AirAnalysis } from './analyze'

const app = express()
app.use(express.json())

app.post('/analyze', (req, res) => {
  const body = req.body as AgentRequest
  const air = body.openaq ?? { pm25: 0, aqi: 0, category: 'Good' }
  const fires = body.firms ?? []

  try {
    const data = analyzeAir(air, fires)
    const response: AgentResponse<AirAnalysis> = { success: true, data }
    res.json(response)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<AirAnalysis>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-air' }))

const PORT = process.env.PORT ?? 3003
app.listen(PORT, () => console.log(`[agent-air] running on port ${PORT}`))
