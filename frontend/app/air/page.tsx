"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { useLang } from "@/contexts/language-context"
import {
  MAP_CENTER, computeAQI, aqiInfo, computeThreatLevel,
  SCENARIOS, type ScenarioId,
} from "@/components/air/types"
import { SmokeAlert }       from "@/components/air/smoke-alert"
import { AQIOverlay }       from "@/components/air/aqi-overlay"
import { EnvStatus }        from "@/components/air/env-status"
import { AQILegend }        from "@/components/air/aqi-legend"
import { ThreatIndicator }  from "@/components/air/threat-indicator"
import { ActionPlan }       from "@/components/air/action-plan"
import { AIBriefing }       from "@/components/air/ai-briefing"
import { IncidentTimeline } from "@/components/air/incident-timeline"
import { ScenarioControls } from "@/components/air/scenario-controls"

const AirMap = dynamic(
  () => import("@/components/air/air-map").then(m => m.AirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function AirPage() {
  const pathname = usePathname()
  const { lang, toggle, tx } = useLang()
  const [scenarioId, setScenarioId] = useState<ScenarioId>("none")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scenario = SCENARIOS[scenarioId]

  const rawAQI = useMemo(
    () => computeAQI(scenario.fires, scenario.env.wind, MAP_CENTER.lat, MAP_CENTER.lng),
    [scenario]
  )
  const aqiData = useMemo(() => aqiInfo(rawAQI, 127_450), [rawAQI])
  const threat  = useMemo(() => computeThreatLevel(rawAQI), [rawAQI])

  return (
    <div
      className="h-screen w-screen flex flex-col bg-background overflow-hidden"
      data-threat={threat}
    >
      <div className="pointer-events-none fixed inset-0 z-[9999] scanline-overlay" />

      <header className="h-12 border-b border-border flex items-center justify-between px-6 shrink-0 z-[2000]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground font-mono">
            SENTINEL
          </span>
          <span className="text-border">|</span>
          <nav className="flex items-center gap-1">
            {[
              { href: '/dashboard', label: tx.navDashboard },
              { href: '/air',       label: tx.navAir },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-widest uppercase transition-colors ${
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
        <div className="flex items-center gap-4">
          <ThreatIndicator level={threat} />
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-red-500"
              style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
            />
            <span className="text-xs font-mono text-muted-foreground">LIVE</span>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground transition-all"
          >
            🌐 {lang.toUpperCase()}
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="absolute top-2 right-2 z-[2000] md:hidden bg-black/80 backdrop-blur-sm border border-white/20 rounded-sm px-2 py-1 font-mono text-[10px] text-muted-foreground"
        >
          PANELS
        </button>
        <AirMap wind={scenario.env.wind} />
        <SmokeAlert wind={scenario.env.wind} />
        <AQIOverlay info={aqiData} />
        <EnvStatus env={scenario.env} />
        <AQILegend />

        <div
          className={`absolute top-14 right-0 z-[1000] w-64 flex flex-col gap-3 max-h-[calc(100vh-80px)] overflow-y-auto scrollbar-none transition-transform duration-300 md:right-4 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
        >
          <ActionPlan threat={threat} aqi={rawAQI} />
          <AIBriefing threat={threat} />
          <IncidentTimeline scenarioId={scenarioId} />
        </div>

        <ScenarioControls active={scenarioId} onSelect={setScenarioId} />
      </main>
    </div>
  )
}
