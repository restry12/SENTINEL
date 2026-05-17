import 'dotenv/config'
import express from 'express'
import type {
  AgentRequest,
  AgentResponse,
  FireRiskRegionMap,
  RegionDetail,
  RiskCategory,
  RiskFactors,
  WeatherData,
  FireData,
} from '@sentinel/types'
import { buildFireRiskRegionMap } from './grid'
import { buildRegionDetail } from './cell-detail'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/analyze', async (req, res) => {
  const body = req.body as AgentRequest
  const weather: WeatherData = body.weather ?? { speed: 0, deg: 0, humidity: 0 }
  const firms: FireData[] = body.firms ?? []
  try {
    const data = await buildFireRiskRegionMap(weather, firms)
    res.json({ success: true, data } satisfies AgentResponse<FireRiskRegionMap>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<FireRiskRegionMap>)
  }
})

app.post('/cell-detail', async (req, res) => {
  const body = req.body as {
    region_id?: unknown
    nombre?: unknown
    score?: unknown
    category?: unknown
    factors?: unknown
  }
  if (typeof body.region_id !== 'number') {
    res.status(400).json({ success: false, data: null, error: 'Missing region_id' } satisfies AgentResponse<RegionDetail>)
    return
  }
  try {
    const data = await buildRegionDetail({
      region_id: body.region_id,
      nombre: typeof body.nombre === 'string' ? body.nombre : '',
      score: typeof body.score === 'number' ? body.score : 0,
      category: (body.category as RiskCategory) ?? 'bajo',
      factors: (body.factors as RiskFactors) ?? { fwi: 0, historial: 0, terreno: 0 },
    })
    res.json({ success: true, data } satisfies AgentResponse<RegionDetail>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<RegionDetail>)
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'agent-prediction' }))

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => console.log(`[agent-prediction] running on port ${PORT}`))
