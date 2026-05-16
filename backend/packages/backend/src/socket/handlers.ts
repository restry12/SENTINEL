import type { Server, Socket } from 'socket.io'
import type { StatusPayload, AlertPayload } from '@sentinel/types'
import type { PollingController } from '../controllers/polling'
import { runAnalysis } from '../services/orchestrator'
import { triggerMakeWebhook } from '../services/alert'

// Min polling interval matches the HTTP route guard — protects external API rate limits
const MIN_POLL_INTERVAL_MS = 10000

export function registerSocketHandlers(io: Server, polling: PollingController): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`)

    socket.on('trigger', (data: { lat?: number; lon?: number }) => {
      const lat = typeof data.lat === 'number' && isFinite(data.lat) ? data.lat : undefined
      const lon = typeof data.lon === 'number' && isFinite(data.lon) ? data.lon : undefined
      executeAndBroadcast(io, lat, lon, undefined).catch((err) => {
        console.error('[socket] trigger unhandled error:', err)
      })
    })

    // Note: any connected client can start/stop polling — intentional for hackathon simplicity
    socket.on('start-polling', (data: { intervalMs: number }) => {
      if (!data.intervalMs || data.intervalMs < MIN_POLL_INTERVAL_MS) {
        socket.emit('status', {
          state: 'error',
          message: `intervalMs must be >= ${MIN_POLL_INTERVAL_MS}`,
        } satisfies StatusPayload)
        return
      }
      polling.start(data.intervalMs)
      console.log(`[polling] started every ${data.intervalMs}ms`)
    })

    socket.on('stop-polling', () => {
      polling.stop()
      console.log('[polling] stopped')
    })

    socket.on('subscribe', (data: { zone: string }) => {
      socket.join(data.zone)
      console.log(`[socket] ${socket.id} subscribed to zone ${data.zone}`)
    })

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`)
    })
  })
}

export async function executeAndBroadcast(io: Server, lat?: number, lon?: number, firms?: unknown[]): Promise<void> {
  const status: StatusPayload = { state: 'loading' }
  io.emit('status', status)

  try {
    const update = await runAnalysis(lat, lon, firms)
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[orchestrator] error:', message)
    io.emit('status', { state: 'error', message } satisfies StatusPayload)
  }
}
