"use client"

import dynamic from "next/dynamic"
import { MOCK_FIRES, MOCK_ENV, MAP_CENTER, computeAQI, aqiInfo } from "@/components/air/types"
import { SmokeAlert } from "@/components/air/smoke-alert"
import { AQIOverlay } from "@/components/air/aqi-overlay"
import { EnvStatus }  from "@/components/air/env-status"
import { AQILegend }  from "@/components/air/aqi-legend"

const AirMap = dynamic(
  () => import("@/components/air/air-map").then(m => m.AirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

const rawAQI  = computeAQI(MOCK_FIRES, MOCK_ENV.wind, MAP_CENTER.lat, MAP_CENTER.lng)
const aqiData = aqiInfo(rawAQI, 127_450)

export default function AirPage() {
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
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
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-red-500"
            style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
          />
          <span className="text-xs font-mono text-muted-foreground">LIVE</span>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <AirMap />
        <SmokeAlert fires={MOCK_FIRES} wind={MOCK_ENV.wind} />
        <AQIOverlay info={aqiData} />
        <EnvStatus  env={MOCK_ENV} />
        <AQILegend />
      </main>
    </div>
  )
}
