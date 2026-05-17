import type { Server, Socket } from 'socket.io'
import type { StatusPayload, AlertPayload, SentinelUpdate } from '@sentinel/types'
import type { PollingController } from '../controllers/polling'
import { runAnalysis } from '../services/orchestrator'
import { triggerMakeWebhook } from '../services/alert'
import { acquireLock, releaseLock, isLocked } from '../services/analysis-lock'
import { saveIncident } from '../services/history'
import { getLastUpdate, setLastUpdate } from '../services/last-update'

const MIN_POLL_INTERVAL_MS = 10000

// Per-socket trigger rate limit: max 1 trigger per socket every 15 seconds
const SOCKET_TRIGGER_COOLDOWN_MS = 15000
const socketLastTrigger = new Map<string, number>()

export function registerSocketHandlers(io: Server, polling: PollingController): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`)

    // Replay the last known analysis so the dashboard has memory immediately,
    // without waiting for the next Make.com trigger.
    const last = getLastUpdate()
    if (last) {
      socket.emit('update', last)
      socket.emit('status', { state: 'ok' } satisfies StatusPayload)
    }

    socket.on('trigger', (data: { lat?: number; lon?: number }) => {
      // Per-socket rate limit
      const lastTrigger = socketLastTrigger.get(socket.id) ?? 0
      const elapsed = Date.now() - lastTrigger
      if (elapsed < SOCKET_TRIGGER_COOLDOWN_MS) {
        const waitSec = Math.ceil((SOCKET_TRIGGER_COOLDOWN_MS - elapsed) / 1000)
        socket.emit('status', {
          state: 'error',
          message: `Demasiadas peticiones. Espera ${waitSec}s antes de analizar otra zona.`,
        } satisfies StatusPayload)
        return
      }

      // Global lock — only one analysis at a time
      if (isLocked()) {
        socket.emit('status', {
          state: 'error',
          message: 'Análisis en curso. Espera que termine antes de seleccionar otra zona.',
        } satisfies StatusPayload)
        return
      }

      socketLastTrigger.set(socket.id, Date.now())

      const lat = typeof data.lat === 'number' && isFinite(data.lat) ? data.lat : undefined
      const lon = typeof data.lon === 'number' && isFinite(data.lon) ? data.lon : undefined

      executeAndBroadcast(io, lat, lon, undefined).catch((err) => {
        console.error('[socket] trigger unhandled error:', err)
      })
    })

    socket.on('trigger-citizen', (data: { lat?: number; lon?: number }) => {
      const lastTrigger = socketLastTrigger.get(socket.id) ?? 0
      const elapsed = Date.now() - lastTrigger
      if (elapsed < SOCKET_TRIGGER_COOLDOWN_MS) {
        const waitSec = Math.ceil((SOCKET_TRIGGER_COOLDOWN_MS - elapsed) / 1000)
        socket.emit('status', {
          state: 'error',
          message: `Demasiadas peticiones. Espera ${waitSec}s.`,
        } satisfies StatusPayload)
        return
      }

      if (isLocked()) {
        socket.emit('status', {
          state: 'error',
          message: 'Análisis en curso. Espera que termine antes de analizar tu zona.',
        } satisfies StatusPayload)
        return
      }

      const lat = typeof data.lat === 'number' && isFinite(data.lat) ? data.lat : undefined
      const lon = typeof data.lon === 'number' && isFinite(data.lon) ? data.lon : undefined
      if (!lat || !lon) {
        socket.emit('status', { state: 'error', message: 'Coordenadas inválidas.' } satisfies StatusPayload)
        return
      }

      socketLastTrigger.set(socket.id, Date.now())
      socket.emit('status', { state: 'loading' } satisfies StatusPayload)

      const citizenWebhookUrl = process.env.MAKE_CITIZEN_WEBHOOK_URL
      if (citizenWebhookUrl) {
        const webhookHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        const webhookSecret = process.env.MAKE_CITIZEN_WEBHOOK_SECRET
        if (webhookSecret) webhookHeaders['x-make-apikey'] = webhookSecret

        fetch(citizenWebhookUrl, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            lat, lon, socketId: socket.id,
            west: Math.round((lon - 3) * 10) / 10,
            south: Math.round((lat - 3) * 10) / 10,
            east: Math.round((lon + 3) * 10) / 10,
            north: Math.round((lat + 3) * 10) / 10,
          }),
        }).catch((err) => {
          console.error('[trigger-citizen] Make.com webhook call failed:', err)
          socket.emit('status', { state: 'error', message: 'No se pudo iniciar el análisis ciudadano.' } satisfies StatusPayload)
        })
      } else {
        console.warn('[trigger-citizen] MAKE_CITIZEN_WEBHOOK_URL not set — running degraded analysis')
        executeAndBroadcast(io, lat, lon, [], undefined, undefined, socket.id).catch((err) => {
          console.error('[trigger-citizen] fallback analysis error:', err)
        })
      }
    })

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
      socketLastTrigger.delete(socket.id)
      console.log(`[socket] client disconnected: ${socket.id}`)
    })
  })
}

const DEFAULT_LAT = -38.5
const DEFAULT_LON = -72.0

export async function executeAndBroadcast(io: Server, lat?: number, lon?: number, firms?: unknown[], weather?: unknown, pm25?: number, targetSocketId?: string): Promise<void> {
  if (!acquireLock()) {
    console.warn('[orchestrator] analysis already in progress — skipping duplicate trigger')
    return
  }

  const emitter = targetSocketId ? io.to(targetSocketId) : io
  emitter.emit('status', { state: 'loading' } satisfies StatusPayload)

  try {
    const update = await runAnalysis(lat, lon, firms, weather, pm25)
    setLastUpdate(update)
    emitter.emit('update', update)
    emitter.emit('status', { state: 'ok' } satisfies StatusPayload)

    let alertsSent = false
    if (update.riskLevel === 'high' || update.riskLevel === 'critical') {
      const alert: AlertPayload = {
        riskLevel: update.riskLevel,
        fires: update.fires,
        timestamp: update.timestamp,
      }
      emitter.emit('alert', alert)
      const centLat = lat ?? DEFAULT_LAT
      const centLon = lon ?? DEFAULT_LON
      await triggerMakeWebhook(update as SentinelUpdate, centLat, centLon)
      alertsSent = true
    }

    // Save to historical record (fails silently if Supabase not configured)
    await saveIncident(update, lat ?? DEFAULT_LAT, lon ?? DEFAULT_LON, alertsSent)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[orchestrator] error:', message)
    emitter.emit('status', { state: 'error', message } satisfies StatusPayload)
  } finally {
    releaseLock()
  }
}
