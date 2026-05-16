"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"

export interface Hotspot {
  id: string
  lat: number
  lng: number
  intensity: "low" | "medium" | "high" | "critical"
  frp: number
  label?: string
}

// Shown when socket never connects — same coordinates as the backend mock
const FALLBACK_HOTSPOTS: Hotspot[] = [
  { id: "FIRE-001", lat: 34.12, lng: -118.45, intensity: "high",     frp: 142.3, label: "FIRE-001" },
  { id: "FIRE-002", lat: 33.98, lng: -118.21, intensity: "critical",  frp: 287.6, label: "FIRE-002 (PRIMARY)" },
  { id: "FIRE-003", lat: 34.21, lng: -118.09, intensity: "medium",    frp: 89.1,  label: "FIRE-003" },
]

export function useSocket() {
  const [hotspots, setHotspots] = useState<Hotspot[]>(FALLBACK_HOTSPOTS)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001"
    const socket: Socket = io(url, { transports: ["websocket"] })

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("hotspots", (data: Hotspot[]) => setHotspots(data))

    return () => {
      socket.disconnect()
    }
  }, [])

  return { hotspots, connected }
}
