import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, RouteData } from '@sentinel/types'
import { calculateEvacuationRoutes } from './analyze'

const app = express()
app.use(express.json())

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const fires = body.firms ?? []
  const polygon = body.polygon

  try {
    const data = await calculateEvacuationRoutes(fires, polygon)
    const response: AgentResponse<RouteData[]> = { success: true, data }
    res.json(response)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<RouteData[]>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-routes' }))

const PORT = process.env.PORT ?? 3004
app.listen(PORT, () => console.log(`[agent-routes] running on port ${PORT}`))
