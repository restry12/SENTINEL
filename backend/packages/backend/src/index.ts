import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { PollingController } from './controllers/polling'
import { registerRoutes } from './routes/index'
import { registerSocketHandlers, executeAndBroadcast } from './socket/handlers'

// Validate required env vars at startup — fail fast rather than on first request
const REQUIRED_ENV = [
  'AGENT_FIRE_URL', 'AGENT_WEATHER_URL', 'AGENT_AIR_URL', 'AGENT_ROUTES_URL',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY',
]
for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    console.error(`[startup] Missing required environment variable: ${name}`)
    process.exit(1)
  }
}

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(express.text({ type: 'text/plain', limit: '10mb' }))

const httpServer = createServer(app)

// Restrict CORS to the configured frontend origin.
// Set ALLOWED_ORIGIN in your .env (e.g. https://sentinel.vercel.app).
// Multiple origins can be separated by commas.
const rawOrigin = process.env.ALLOWED_ORIGIN ?? ''
const allowedOrigins = rawOrigin
  ? rawOrigin.split(',').map(o => o.trim()).filter(Boolean)
  : []

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) cb(null, true)
          else cb(new Error(`CORS: origin ${origin} not allowed`))
        }
      : false,
    methods: ['GET', 'POST'],
  },
})

// Single shared instance — routes and socket handlers share the same polling state
const polling = new PollingController(async () => {
  await executeAndBroadcast(io)
})

registerRoutes(app, io, polling)
registerSocketHandlers(io, polling)

const PORT = process.env.PORT ?? 3000
httpServer.listen(PORT, () => {
  console.log(`[backend] running on port ${PORT}`)
})

export { io }
