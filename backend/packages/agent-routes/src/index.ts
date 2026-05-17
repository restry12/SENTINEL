import 'dotenv/config'
import express from 'express'
import type { AgentRequest, AgentResponse, NaturalRoutes } from '@sentinel/types'
import { calculateEvacuationRoutes } from './analyze'

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

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-routes' }))

const PORT = process.env.PORT ?? 3004
app.listen(PORT, () => console.log(`[agent-routes] running on port ${PORT}`))
