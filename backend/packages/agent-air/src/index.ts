import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, AirAlerts, AirRiskGridResult } from '@sentinel/types'
import { analyzeAir } from './analyze'
import { getAirRiskGrid } from './air-risk-grid'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const air = body.openaq ?? { pm25: 0, aqi: 0, category: 'Good' }
  const fires = body.firms ?? []
  const weather = body.weather ?? { speed: 3, deg: 270, humidity: 50 }

  try {
    const [alerts, airRiskGrid] = await Promise.all([
      analyzeAir(air, fires),
      Promise.resolve(getAirRiskGrid(fires, weather)),
    ])
    res.json({ success: true, data: { ...alerts, airRiskGrid } } satisfies AgentResponse<AirAlerts & { airRiskGrid: AirRiskGridResult }>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<AirAlerts>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-air' }))

const PORT = process.env.PORT ?? 3003
app.listen(PORT, () => console.log(`[agent-air] running on port ${PORT}`))
