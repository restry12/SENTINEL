import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { PollingController } from './controllers/polling'
import { registerRoutes } from './routes/index'
import { registerSocketHandlers, executeAndBroadcast } from './socket/handlers'

const app = express()
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
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
