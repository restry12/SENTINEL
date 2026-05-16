"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
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
  const [scenarioId, setScenarioId] = useState<ScenarioId>("none")
  const scenario = SCENARIOS[scenarioId]

  const rawAQI = useMemo(
    () => computeAQI(scenario.fires, scenario.env.wind, MAP_CENTER.lat, MAP_CENTER.lng),
    [scenario]
  )
  const aqiData = useMemo(() => aqiInfo(rawAQI, 127_450), [rawAQI])
  const threat  = computeThreatLevel(rawAQI)

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
          <span className="text-xs font-semibold tracking-widest uppercase text-warning font-mono">
            AIR QUALITY MONITOR
          </span>
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
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <AirMap wind={scenario.env.wind} />
        <SmokeAlert wind={scenario.env.wind} />
        <AQIOverlay info={aqiData} />
        <EnvStatus env={scenario.env} />
        <AQILegend />

        <div className="absolute top-14 right-4 z-[1000] w-64 flex flex-col gap-3 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-none">
          <ActionPlan threat={threat} aqi={rawAQI} />
          <AIBriefing threat={threat} env={scenario.env} />
          <IncidentTimeline scenarioId={scenarioId} />
        </div>

        <ScenarioControls active={scenarioId} onSelect={setScenarioId} />
      </main>
    </div>
  )
}
