import type { Express } from 'express'
import type { Server } from 'socket.io'
import type { AlertPayload, StatusPayload } from '@sentinel/types'
import type { PollingController } from '../controllers/polling'
import { runAnalysis } from '../services/orchestrator'
import { triggerMakeWebhook } from '../services/alert'
import { executeAndBroadcast } from '../socket/handlers'

export function registerRoutes(app: Express, io: Server, polling: PollingController): void {
  // POST /api/trigger — manual single run
  app.post('/api/trigger', async (req, res) => {
    const { lat, lon } = req.body as { lat?: number; lon?: number }
    try {
      io.emit('status', { state: 'loading' } satisfies StatusPayload)
      const update = await runAnalysis(lat, lon)
      io.emit('update', update)
      io.emit('status', { state: 'ok' } satisfies StatusPayload)

      if (update.riskLevel === 'high' || update.riskLevel === 'critical') {
        const alert: AlertPayload = {
          riskLevel: update.riskLevel,
          fires: update.fires,
          timestamp: update.timestamp,
        }
        io.emit('alert', alert)
        await triggerMakeWebhook(alert)
      }

      res.json({ ok: true, update })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ ok: false, error: message })
    }
  })

  // POST /api/polling/start
  app.post('/api/polling/start', (req, res) => {
    const { intervalMs } = req.body as { intervalMs: number }
    if (!intervalMs || intervalMs < 10000) {
      res.status(400).json({ ok: false, error: 'intervalMs must be >= 10000' })
      return
    }
    polling.start(intervalMs)
    res.json({ ok: true, state: polling.getState() })
  })

  // POST /api/polling/stop
  app.post('/api/polling/stop', (_req, res) => {
    polling.stop()
    res.json({ ok: true, state: polling.getState() })
  })

  // GET /api/polling/status
  app.get('/api/polling/status', (_req, res) => {
    res.json(polling.getState())
  })

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'backend', ts: new Date().toISOString() })
  })
}
