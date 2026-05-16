"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"
import {
  aqiInfo, computeThreatLevel, visibilityFromAQI,
  type EnvData, type FirePoint,
} from "@/components/air/types"
import { SmokeAlert }       from "@/components/air/smoke-alert"
import { AQIOverlay }       from "@/components/air/aqi-overlay"
import { EnvStatus }        from "@/components/air/env-status"
import { AQILegend }        from "@/components/air/aqi-legend"
import { ThreatIndicator }  from "@/components/air/threat-indicator"
import { ActionPlan }       from "@/components/air/action-plan"
import { AIBriefing }       from "@/components/air/ai-briefing"
import { IncidentTimeline } from "@/components/air/incident-timeline"
import { AuthGuard } from "@/components/auth-guard"

const AirMap = dynamic(
  () => import("@/components/air/air-map").then(m => m.AirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function AirPage() {
  return (
    <AuthGuard>
      <AirPageInner />
    </AuthGuard>
  )
}

function AirPageInner() {
  const pathname   = usePathname()
  const { lang, toggle, tx } = useLang()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { sentinelUpdate: u, connected } = useSentinel()

  // Real env from weather data (speed is m/s → km/h)
  const liveEnv: EnvData = {
    wind:         { speed: u ? Math.round(u.weather.speed * 3.6) : 0, fromDeg: u?.weather.deg ?? 0 },
    humidity:     u?.weather.humidity ?? 0,
    tempC:        u?.weather.temp ?? 0,
    visibilityKm: visibilityFromAQI(u?.airQuality.aqi ?? 0),
  }

  // Real fires from NASA FIRMS data (FireData uses .lon, FirePoint uses .lng)
  const liveFires: FirePoint[] = (u?.fires ?? []).map((f, i) => ({
    id:        `fire-${i}`,
    lat:       f.lat,
    lng:       f.lon,
    intensity: Math.min(1, f.frp / 100),
    name:      `SRC-${String(i + 1).padStart(3, "0")}`,
  }))

  // Real AQI directly from airQuality data (not computed from fires)
  const rawAQI  = u?.airQuality.aqi ?? 0
  const aqiData = useMemo(
    () => aqiInfo(rawAQI, u?.report?.poblacion_en_riesgo_estimada ?? 0),
    [rawAQI, u]
  )
  const threat = useMemo(() => computeThreatLevel(rawAQI), [rawAQI])

  // Real action items from authority report
  const liveActions = u?.report?.acciones_inmediatas ?? null

  // Real briefing text
  const liveBriefing = u?.report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? u?.airAlerts?.resumen_general ?? null

  // Real alerts for timeline
  const liveAlerts = u?.airAlerts?.alertas ?? null

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-threat={threat}>
      <div className="pointer-events-none fixed inset-0 z-[9999] scanline-overlay" />

      {/* ── Header ── */}
      <header className="h-12 border-b border-border flex items-center justify-between px-3 sm:px-6 shrink-0 z-[2000] gap-2">
        {/* Left: brand + nav */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:block text-xs font-semibold tracking-widest uppercase text-muted-foreground font-mono whitespace-nowrap">
            SENTINEL
          </span>
          <span className="hidden sm:block text-border">|</span>
          <nav className="flex items-center gap-1">
            {[
              { href: '/dashboard', label: tx.navDashboard },
              { href: '/air',       label: tx.navAir },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-2 sm:px-3 py-1 rounded text-[9px] sm:text-[10px] font-mono font-bold tracking-widest uppercase transition-colors whitespace-nowrap ${
                  pathname === href
                    ? 'bg-orange/15 text-orange border border-orange/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: threat + live + lang + panels toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block">
            <ThreatIndicator level={threat} />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-red-500"
              style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
            />
            <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
            {!connected && (
              <span className="text-[9px] font-mono text-muted-foreground/60">CONNECTING...</span>
            )}
            {connected && !u && (
              <span className="text-[9px] font-mono text-muted-foreground/60">AWAITING DATA</span>
            )}
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[9px] font-mono font-bold text-muted-foreground hover:text-foreground transition-all"
          >
            🌐 {lang.toUpperCase()}
          </button>
          {/* Mobile panels toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="md:hidden flex items-center gap-1 px-2 py-1 rounded border border-white/20 bg-black/60 text-[9px] font-mono text-muted-foreground"
          >
            {sidebarOpen ? '✕' : '☰'} INFO
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 relative overflow-hidden">
        <AirMap wind={liveEnv.wind} fires={liveFires} />
        <SmokeAlert wind={liveEnv.wind} sourceCount={liveFires.length} />

        {/* Map overlays — hidden when sidebar open on mobile to avoid clutter */}
        <div className={`transition-opacity duration-200 ${sidebarOpen ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}>
          <AQIOverlay info={aqiData} />
          <EnvStatus env={liveEnv} />
          <AQILegend />
        </div>

        {/* ── Desktop sidebar (right) / Mobile drawer (bottom) ── */}
        <>
          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div
              className="absolute inset-0 z-[900] bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar panel */}
          <div
            className={`
              absolute z-[1000] flex flex-col gap-3 overflow-y-auto scrollbar-none transition-transform duration-300
              /* mobile: full-width drawer from bottom */
              bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl border-t border-white/10 bg-background/95 backdrop-blur-xl p-3
              md:bottom-auto md:top-14 md:left-auto md:right-4 md:w-64 md:max-h-[calc(100vh-80px)] md:rounded-none md:border-t-0 md:bg-transparent md:backdrop-blur-none md:p-0
              ${sidebarOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
            `}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <ActionPlan threat={threat} aqi={rawAQI} actions={liveActions} />
            <AIBriefing threat={threat} briefing={liveBriefing} />
            <IncidentTimeline alerts={liveAlerts} />
          </div>
        </>
      </main>
    </div>
  )
}
