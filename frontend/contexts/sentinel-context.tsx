"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useSocket, type SentinelUpdate, type SocketStatus } from "@/hooks/use-socket"

interface SentinelContextValue {
  sentinelUpdate: SentinelUpdate | null
  status: SocketStatus
  connected: boolean
  trigger: (lat?: number, lon?: number) => void
  triggerCitizen: (lat: number, lon: number) => void
}

const SentinelContext = createContext<SentinelContextValue | null>(null)

export function SentinelProvider({ children }: { children: ReactNode }) {
  const value = useSocket()
  return <SentinelContext.Provider value={value}>{children}</SentinelContext.Provider>
}

export function useSentinel(): SentinelContextValue {
  const ctx = useContext(SentinelContext)
  if (!ctx) throw new Error("useSentinel must be used within <SentinelProvider>")
  return ctx
}

export function useSentinelMetrics() {
  const { sentinelUpdate: u, connected, status } = useSentinel()
  const hasData = u !== null

  const frpMax = u ? u.fires.reduce((m, f) => Math.max(m, f.frp), 0) : 0
  const aqi = u?.airQuality.aqi ?? 0
  const riskLevel = u ? (u.riskLevel).toUpperCase() : "NO DATA"
  const populationAtRisk = u?.report?.poblacion_en_riesgo_estimada ?? null
  const briefing =
    u?.report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? null

  return {
    hasData,
    connected,
    status,
    update: u,
    frpMax,
    aqi,
    riskLevel,
    populationAtRisk,
    briefing,
  }
}
