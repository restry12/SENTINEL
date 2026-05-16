const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors({ origin: "http://localhost:3000" }))

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
})

// TODO: REPLACE WITH REAL DATA — swap this function for FIRMS API query or agent pipeline
function getMockHotspots() {
  return [
    { id: "FIRE-001", lat: 34.12, lng: -118.45, intensity: "high",     frp: 142.3, label: "FIRE-001" },
    { id: "FIRE-002", lat: 33.98, lng: -118.21, intensity: "critical",  frp: 287.6, label: "FIRE-002 (PRIMARY)" },
    { id: "FIRE-003", lat: 34.21, lng: -118.09, intensity: "medium",    frp: 89.1,  label: "FIRE-003" },
  ]
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id)

  socket.emit("hotspots", getMockHotspots())

  const interval = setInterval(() => {
    socket.emit("hotspots", getMockHotspots())
  }, 5000)

  socket.on("disconnect", () => {
    clearInterval(interval)
    console.log("Client disconnected:", socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`SENTINEL socket server running on port ${PORT}`)
})
