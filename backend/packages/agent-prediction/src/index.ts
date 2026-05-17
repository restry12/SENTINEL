import 'dotenv/config'
import express from 'express'
import type {
  AgentRequest,
  AgentResponse,
  FireRiskGrid,
  CellDetail,
  FireRiskCell,
  WeatherData,
  FireData,
} from '@sentinel/types'
import { buildFireRiskGrid } from './grid'
import { buildCellDetail } from './cell-detail'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const weather: WeatherData = body.weather ?? { speed: 0, deg: 0, humidity: 0 }
  const firms: FireData[] = body.firms ?? []
  try {
    const data = await buildFireRiskGrid(weather, firms)
    res.json({ success: true, data } satisfies AgentResponse<FireRiskGrid>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<FireRiskGrid>)
  }
})

app.post('/cell-detail', async (req, res) => {
  const body = req.body as { cell?: FireRiskCell }
  if (!body.cell) {
    res.status(400).json({ success: false, data: null, error: 'Missing cell' } satisfies AgentResponse<CellDetail>)
    return
  }
  try {
    const data = await buildCellDetail(body.cell)
    res.json({ success: true, data } satisfies AgentResponse<CellDetail>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<CellDetail>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-prediction' }))

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => console.log(`[agent-prediction] running on port ${PORT}`))
