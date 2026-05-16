"use client"

import { Wind, AlertTriangle } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinelMetrics } from "@/contexts/sentinel-context"

export function MetricCards() {
  const { tx } = useLang()
  const m = useSentinelMetrics()
  const riskLevel = m.riskLevel
  const windSpeed = m.windSpeedKmh
  const windDirection = m.windDir
  const aqi = m.aqi
  const frp = m.frpMax

  return (
    <div className="border-b border-border bg-background shrink-0 overflow-x-auto scrollbar-none">
      <div className="flex gap-3 p-4 min-w-max">
        {/* Risk Level Card */}
        <div className="p-3 rounded-md border border-red/30 bg-[#1a0e0f] min-w-[140px] flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-soft/70">
            {tx.riskLevel}
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-soft" />
            <span className="text-xl font-bold tracking-tight text-[#ffe2e2] num">
              {riskLevel}
            </span>
          </div>
        </div>

        {/* AQI Card */}
        <div className="sentinel-card p-3 min-w-[120px] flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {tx.airQuality}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-medium tracking-tight text-red-soft num">
              {aqi}
            </span>
            <span className="text-[9px] font-bold text-red-soft/80 uppercase tracking-widest">AQI</span>
          </div>
        </div>

        {/* Wind Card */}
        <div className="sentinel-card p-3 min-w-[120px] flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {tx.wind}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-medium tracking-tight text-foreground num">
              {windSpeed}
            </span>
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{windDirection}</span>
          </div>
        </div>

        {/* FRP Card */}
        <div className="sentinel-card p-3 min-w-[120px] flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {tx.firePower}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-medium tracking-tight text-orange-soft num">
              {frp.toFixed(1)}
            </span>
            <span className="text-[9px] font-bold text-orange-soft/80 uppercase tracking-widest">MW</span>
          </div>
        </div>
      </div>
    </div>
  )
}
