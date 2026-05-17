import 'dotenv/config'
import express from 'express'
import type { AgentResponse, GlacierInfo, GlacierMassData, GlacierAnalysis } from '@sentinel/types'
import { buildGlacierAnalysis } from './glacier-analysis'
import { catalog, copernicus } from './data'

type GlacierWithMass = GlacierInfo & { lastMassChange: number }

const app = express()
app.use(express.json())

app.get('/glaciers', (_req, res) => {
  const data: GlacierWithMass[] = catalog.map(g => {
    const history: GlacierMassData[] = copernicus[g.id] ?? []
    const lastMassChange = history[history.length - 1]?.mass_change_mmwe ?? 0
    return { ...g, lastMassChange }
  })
  res.json({ success: true, data } satisfies AgentResponse<GlacierWithMass[]>)
})

app.post('/analyze', async (req, res) => {
  const { glacierId } = req.body as { glacierId?: string }
  if (!glacierId) {
    res.status(400).json({ success: false, data: null, error: 'glacierId required' } satisfies AgentResponse<GlacierAnalysis>)
    return
  }
  try {
    const data = await buildGlacierAnalysis(glacierId)
    res.json({ success: true, data } satisfies AgentResponse<GlacierAnalysis>)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error } satisfies AgentResponse<GlacierAnalysis>)
  }
})

app.get('/glaciers/risk-grid', (_req, res) => {
  const features = catalog.map(g => {
    const history: GlacierMassData[] = copernicus[g.id] ?? []
    const lastMassChange = history[history.length - 1]?.mass_change_mmwe ?? 0
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [g.lon, g.lat] },
      properties: { id: g.id, name: g.name, lastMassChange },
    }
  })
  res.json({
    success: true,
    data: { type: 'FeatureCollection', features },
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-glacier' })
})

const PORT = process.env.PORT ?? 3006
app.listen(PORT, () => {
  console.log(`[agent-glacier] running on port ${PORT}`)
})
