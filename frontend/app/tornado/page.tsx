"use client"

import dynamic from "next/dynamic"
import { useState, useCallback, useEffect, useRef } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TopBar } from "@/components/dashboard/top-bar"
import { TornadoLeftPanel } from "@/components/tornado/tornado-left-panel"
import { TornadoRightPanel } from "@/components/tornado/tornado-right-panel"
import type { GridPoint, GridScanResult } from "@/components/tornado/world-tornado-map"

const WorldTornadoMap = dynamic(
  () => import("@/components/tornado/world-tornado-map").then(m => m.WorldTornadoMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

interface SevereWeatherDetail {
  forecast_risk: Array<{
    window: string
    timestamp: string
    score: number
    risk_level: string
    variables: Record<string, number | null>
    drivers: string[]
    confidence: number
    impact_corridor: {
      direction_label: string
      bearing_degrees: number
      estimated_distance_km_1h: number
      estimated_distance_km_3h: number
      estimated_distance_km_6h: number
      explanation: string
    }
  }>
  active_alerts: Array<{
    event: string
    severity: string
    urgency: string
    headline: string
    area_description: string
    expires: string
  }>
  mistral_analysis: {
    risk_summary: string
    technical_explanation: string
    citizen_alert_160_chars: string
    municipal_briefing: string
    recommended_actions: string[]
    shelter_guidance: string
    uncertainty_note: string
  }
  limitations: string[]
}

// ─── localStorage cache (same pattern as fire dashboard) ─────────────────────

const CACHE_KEY = "sentinel_severe_weather_grid"

function loadCachedGrid(): GridScanResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { data: GridScanResult; savedAt: number }
    // Accept cache up to 2 hours old (data refreshes every 1h on server)
    if (Date.now() - cached.savedAt > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return { ...cached.data, metadata: { ...cached.data.metadata, cached: true } }
  } catch {
    return null
  }
}

function saveCachedGrid(data: GridScanResult): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }))
  } catch { /* localStorage full — ignore */ }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TornadoPage() {
  return <AuthGuard><TornadoPageInner /></AuthGuard>
}

function TornadoPageInner() {
  const [gridData, setGridData] = useState<GridScanResult | null>(null)
  const [gridLoading, setGridLoading] = useState(true)
  const [selectedCountryIso, setSelectedCountryIso] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<GridPoint | null>(null)
  const [detail, setDetail] = useState<SevereWeatherDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const detailCacheRef = useRef<Record<string, SevereWeatherDetail>>({})
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from localStorage first (instant paint like fire dashboard)
  useEffect(() => {
    const cached = loadCachedGrid()
    if (cached && cached.points.length > 0) {
      setGridData(cached)
      setGridLoading(false)
    }
    // Then fetch fresh from server
    fetchGrid()
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  async function fetchGrid() {
    // Only show loading if we don't have cached data
    if (!gridData) setGridLoading(true)

    try {
      const res = await fetch("/api/severe-weather/grid")
      if (res.ok) {
        const data = await res.json()

        // Backend returns 202 with scanning: true if scan in progress
        if (data.scanning) {
          console.log("[tornado] Grid scan in progress, retrying in 10s...")
          retryTimerRef.current = setTimeout(() => fetchGrid(), 10000)
          return
        }

        const gridResult = data as GridScanResult
        setGridData(gridResult)
        saveCachedGrid(gridResult)

        // Auto-refresh at the interval the backend specifies (1h)
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = setInterval(() => {
          fetchGrid()
        }, gridResult.refresh_interval_ms)
      }
    } catch (err) {
      console.error("[tornado] Grid fetch failed:", err)
      // Retry in 15s if server isn't ready yet
      retryTimerRef.current = setTimeout(() => fetchGrid(), 15000)
    } finally {
      setGridLoading(false)
    }
  }

  // Fetch detail when a point is selected
  async function fetchDetail(point: GridPoint) {
    const cacheKey = `${point.lat},${point.lon}`
    if (detailCacheRef.current[cacheKey]) {
      setDetail(detailCacheRef.current[cacheKey])
      return
    }

    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/severe-weather?lat=${point.lat}&lon=${point.lon}`)
      if (res.ok) {
        const data = await res.json()
        detailCacheRef.current[cacheKey] = data
        setDetail(data)
      }
    } catch (err) {
      console.error("[tornado] Detail fetch failed:", err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCountrySelect = useCallback((iso: string) => {
    setSelectedCountryIso(iso)
    setSelectedPoint(null)
    setDetail(null)
  }, [])

  const handlePointSelect = useCallback((point: GridPoint) => {
    setSelectedPoint(point)
    fetchDetail(point)
  }, [])

  const handleBack = useCallback(() => {
    if (selectedPoint) {
      setSelectedPoint(null)
      setDetail(null)
    } else if (selectedCountryIso) {
      setSelectedCountryIso(null)
    }
  }, [selectedPoint, selectedCountryIso])

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">

        {/* Map */}
        <WorldTornadoMap
          gridData={gridData}
          selectedCountryIso={selectedCountryIso}
          selectedPoint={selectedPoint}
          onCountrySelect={handleCountrySelect}
          onPointSelect={handlePointSelect}
          onBack={handleBack}
          loading={gridLoading}
          detail={detail}
        />

        {/* Left panel */}
        <TornadoLeftPanel
          gridData={gridData}
          selectedCountryIso={selectedCountryIso}
          selectedPoint={selectedPoint}
          detail={detail}
          detailLoading={detailLoading}
          onPointSelect={handlePointSelect}
          onBack={handleBack}
        />

        {/* Right panel */}
        <TornadoRightPanel selectedPoint={selectedPoint} detail={detail} detailLoading={detailLoading} />

        {/* Risk Scale Legend */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-1 bg-[#0a0b0e]/85 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-2xl">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">SSPI</span>
            {[
              { color: "#22c55e", label: "LOW", range: "0-25" },
              { color: "#eab308", label: "MOD", range: "26-50" },
              { color: "#f97316", label: "HIGH", range: "51-75" },
              { color: "#ef4444", label: "CRIT", range: "76-100" },
            ].map(({ color, label, range }) => (
              <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: `${color}18` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
                <span className="text-[9px] font-bold text-white">{label}</span>
                <span className="text-[8px] text-white/40 font-mono">{range}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
