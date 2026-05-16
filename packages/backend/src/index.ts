import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { registerRoutes } from './routes/index'
import { registerSocketHandlers } from './socket/handlers'

const app = express()
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

registerRoutes(app, io)
registerSocketHandlers(io)

const PORT = process.env.PORT ?? 3000
httpServer.listen(PORT, () => {
  console.log(`[backend] running on port ${PORT}`)
})

export { io }
