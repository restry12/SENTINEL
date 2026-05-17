"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"

export interface Hotspot {
  id: string
  lat: number
  lng: number
  intensity: "low" | "medium" | "high" | "critical"
  frp: number
  label?: string
}

// Aligned with backend/shared/types/index.ts → SentinelUpdate
export interface FirePerFireWeather {
  speed: number
  deg: number
  humidity: number
  temp?: number
}

export interface FireData {
  lat: number
  lon: number
  frp: number
  brightness: number
  timestamp: string
  weather?: FirePerFireWeather
  pm25?: number | null
}

export interface GeoJSONFeature {
  type: "Feature"
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] }
  properties: Record<string, unknown>
}

export interface RiskAssessment {
  risk_level: "CRITICO" | "ALTO" | "MEDIO" | "BAJO"
  zona_afectada: string
  confianza: number
  resumen: string
}

export interface ExpansionPolygon {
  type: "Polygon"
  coordinates: number[][][]
  area_km2: number
}

export interface ExpansionData {
  expansion_2h: ExpansionPolygon
  expansion_6h: ExpansionPolygon
  expansion_12h: ExpansionPolygon
  velocidad_propagacion_kmh: number
  direccion_principal: string
}

export interface AirAlert {
  zona: string
  aqi: number
  color: string
  nivel: string
  recomendacion: string
}

export interface AirAlerts {
  alertas: AirAlert[]
  resumen_general: string
}

export interface AuthorityReport {
  reporte_id: string
  timestamp: string
  nivel_emergencia: "NIVEL 1" | "NIVEL 2" | "NIVEL 3"
  zona_impacto: string
  poblacion_en_riesgo_estimada: number
  recursos_recomendados: string[]
  acciones_inmediatas: string[]
  zonas_evacuacion_prioritaria: string[]
  resumen_ejecutivo: string
}

export interface NaturalRoute {
  nombre: string
  origen: string
  destino: string
  distancia_km: number
  tiempo_estimado_min: number
  instrucciones: string
  estado: "LIBRE" | "CONGESTIONADA" | "BLOQUEADA"
  prioridad: 1 | 2 | 3
}

export interface NaturalRoutes {
  rutas: NaturalRoute[]
  punto_encuentro_principal: string
  mensaje_alerta: string
}

export interface InfrastructurePoint {
  id: string
  name: string
  lat: number
  lon: number
  type: "hospital" | "school" | "emergency"
}

export type RiskCategory = 'bajo' | 'medio' | 'alto' | 'critico'

export interface RiskFactors {
  fwi: number
  historial: number
  terreno: number
}

export interface RegionGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export interface FireRiskRegion {
  id: number
  nombre: string
  score: number
  category: RiskCategory
  factors: RiskFactors
  geometry: RegionGeometry
}

export interface FireRiskRegionMap {
  regions: FireRiskRegion[]
  generated_at: string
  weather_point: { lat: number; lon: number }
}

export interface RegionDetail {
  region_id: number
  nombre: string
  infraestructura_total: number
  resumen_infraestructura: string
  explicacion: string
  recomendaciones: string[]
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
}

export interface PerFireExpansion {
  lat: number
  lon: number
  frp: number
  expansion_2h_km2: number
  expansion_6h_km2: number
  expansion_12h_km2: number
  velocidad_kmh: number
  direccion: string
  regional_context?: {
    region_name: string
    country: string
    vegetation_type: string
    terrain_type: string
    spread_multiplier: number
    max_ros_kmh: number
    reference_fires: string[]
    context_summary: string
  }
}

export interface SentinelUpdate {
  timestamp: string
  fires: FireData[]
  polygon: GeoJSONFeature
  weather: { speed: number; deg: number; humidity: number; temp?: number; visibility?: number }
  airQuality: { pm25: number; aqi: number; category: string }
  routes: Array<{ id: string; geometry: { type: "LineString"; coordinates: [number, number][] }; distance: number; duration: number }>
  riskLevel: "low" | "medium" | "high" | "critical"
  riskAssessment?: RiskAssessment
  expansion?: ExpansionData
  perFireExpansions?: PerFireExpansion[]
  airAlerts?: AirAlerts
  report?: AuthorityReport
  naturalRoutes?: NaturalRoutes
  // Optional — populated once Make.com / backend start sending infrastructure
  infrastructure?: InfrastructurePoint[]
}

export interface SocketStatus {
  state: "idle" | "loading" | "ok" | "error"
  message?: string
}

const LS_KEY = "sentinel_last_update"

function readCachedUpdate(): SentinelUpdate | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as SentinelUpdate) : null
  } catch {
    return null
  }
}

function cacheUpdate(u: SentinelUpdate): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(u))
  } catch {
    /* localStorage full or unavailable — non-critical */
  }
}

export function useSocket() {
  const [sentinelUpdate, setSentinelUpdate] = useState<SentinelUpdate | null>(null)
  const [status, setStatus] = useState<SocketStatus>({ state: "idle" })
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // 1. Instant paint from the browser's own cache of the last analysis.
    const cached = readCachedUpdate()
    if (cached) {
      setSentinelUpdate(cached)
      setStatus({ state: "ok" })
    }

    // 2. Hydrate from the backend's last snapshot (covers a fresh browser).
    const hydrate = async (retries = 3) => {
      try {
        const r = await fetch("/api/last")
        const d = await r.json()
        if (d?.ok && d.update) {
          setSentinelUpdate(d.update as SentinelUpdate)
          cacheUpdate(d.update as SentinelUpdate)
          setStatus({ state: "ok" })
          return true
        }
      } catch (e) {
        if (retries > 0) {
          setTimeout(() => hydrate(retries - 1), 2000)
        }
      }
      return false
    }

    hydrate()

    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000"
    const socket: Socket = io(url, { transports: ["websocket"] })
    socketRef.current = socket

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))

    socket.on("update", (data: SentinelUpdate) => {
      setSentinelUpdate(data)
      cacheUpdate(data)
    })

    socket.on("status", (s: { state: "loading" | "ok" | "error"; message?: string }) =>
      setStatus(s)
    )

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const trigger = useCallback((lat?: number, lon?: number) => {
    socketRef.current?.emit("trigger", { lat, lon })
  }, [])

  const triggerCitizen = useCallback((lat: number, lon: number) => {
    // Use HTTP proxy (BACKEND_URL server-side) so the trigger works regardless
    // of whether NEXT_PUBLIC_SOCKET_URL is set or the socket is connected.
    // The socket is still used to receive the analysis result back.
    fetch('/api/trigger/citizen-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, socketId: socketRef.current?.id ?? null }),
    }).catch((err) => {
      console.error('[triggerCitizen] HTTP trigger failed:', err)
      // Last resort: try direct socket emit
      socketRef.current?.emit('trigger-citizen', { lat, lon })
    })
  }, [])

  return { sentinelUpdate, status, connected, trigger, triggerCitizen }
}
