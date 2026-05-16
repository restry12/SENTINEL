import type { Server, Socket } from 'socket.io'
import type { StatusPayload, AlertPayload } from '@sentinel/types'
import type { PollingController } from '../controllers/polling'
import { runAnalysis } from '../services/orchestrator'
import { triggerMakeWebhook } from '../services/alert'

export function registerSocketHandlers(io: Server, polling: PollingController): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`)

    socket.on('trigger', async (data: { lat?: number; lon?: number }) => {
      await executeAndBroadcast(io, data.lat, data.lon)
    })

    socket.on('start-polling', (data: { interval: number }) => {
      polling.start(data.interval)
      console.log(`[polling] started every ${data.interval}ms`)
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

export async function executeAndBroadcast(io: Server, lat?: number, lon?: number): Promise<void> {
  const status: StatusPayload = { state: 'loading' }
  io.emit('status', status)

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[orchestrator] error:', message)
    io.emit('status', { state: 'error', message } satisfies StatusPayload)
  }
}
