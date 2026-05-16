import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { PollingController } from './controllers/polling'
import { registerRoutes } from './routes/index'
import { registerSocketHandlers, executeAndBroadcast } from './socket/handlers'

// Validate required env vars at startup — fail fast rather than on first request
const REQUIRED_ENV = ['AGENT_FIRE_URL', 'AGENT_WEATHER_URL', 'AGENT_AIR_URL', 'AGENT_ROUTES_URL']
for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    console.error(`[startup] Missing required environment variable: ${name}`)
    process.exit(1)
  }
}

const app = express()
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' } // TODO: restrict CORS origin before production deployment
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
