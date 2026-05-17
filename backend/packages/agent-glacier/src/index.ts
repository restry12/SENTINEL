import 'dotenv/config'
import express from 'express'
import type { AgentResponse, GlacierInfo, GlacierMassData, GlacierAnalysis } from '@sentinel/types'
import { buildGlacierAnalysis } from './glacier-analysis'
import { catalog, copernicus } from './data'

type GlacierWithMass = GlacierInfo & { lastMassChange: number }

type GeoFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; name: string; lastMassChange: number }
}

type GeoCollection = { type: 'FeatureCollection'; features: GeoFeature[] }

function getLastMassChange(glacierId: string): number {
  const history: GlacierMassData[] = copernicus[glacierId] ?? []
  return history[history.length - 1]?.mass_change_mmwe ?? 0
}

const app = express()
app.use(express.json({ limit: '10mb' }))

app.get('/glaciers', (_req, res) => {
  const data: GlacierWithMass[] = catalog.map(g => ({
    ...g,
    lastMassChange: getLastMassChange(g.id),
  }))
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
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isNotFound = message.startsWith('Glaciar no encontrado')
    res.status(isNotFound ? 404 : 500).json({ success: false, data: null, error: message } satisfies AgentResponse<GlacierAnalysis>)
  }
})

app.get('/glaciers/risk-grid', (_req, res) => {
  const features: GeoFeature[] = catalog.map(g => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [g.lon, g.lat] as [number, number] },
    properties: { id: g.id, name: g.name, lastMassChange: getLastMassChange(g.id) },
  }))
  res.json({ success: true, data: { type: 'FeatureCollection', features } } satisfies AgentResponse<GeoCollection>)
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'agent-glacier' })
})

const PORT = Number(process.env.PORT ?? 3006)
app.listen(PORT, () => {
  console.log(`[agent-glacier] running on port ${PORT}`)
})
