"use client"

import { Wind, AlertTriangle } from "lucide-react"

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

const riskConfig: Record<RiskLevel, { color: string; bg: string }> = {
  LOW: { color: "text-safe", bg: "bg-safe/10" },
  MEDIUM: { color: "text-warning", bg: "bg-warning/10" },
  HIGH: { color: "text-warning", bg: "bg-warning/10" },
  CRITICAL: { color: "text-critical", bg: "bg-critical/10" },
}

const aqiConfig = {
  good: { label: "Good", color: "text-safe", bg: "bg-safe" },
  moderate: { label: "Moderate", color: "text-warning", bg: "bg-warning" },
  unhealthy: { label: "Unhealthy", color: "text-critical", bg: "bg-critical" },
}

export function MetricCards() {
  const riskLevel: RiskLevel = "CRITICAL"
  const windSpeed = 24
  const windDirection = "NW"
  const aqi = 187
  const aqiStatus = "unhealthy" as keyof typeof aqiConfig

  return (
    <div className="border-b border-border bg-card shrink-0 overflow-x-auto">
      <div className="flex gap-3 p-3 min-w-max">
        {/* Risk Level Card */}
        <div className={`${riskConfig[riskLevel].bg} border border-border rounded-lg p-3 min-w-[140px]`}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Risk Level
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${riskConfig[riskLevel].color}`} />
            <span className={`text-xl font-bold tracking-wider ${riskConfig[riskLevel].color}`}>
              {riskLevel}
            </span>
          </div>
        </div>

        {/* AQI Card */}
        <div className="bg-background border border-border rounded-lg p-3 min-w-[120px]">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Air Quality
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-mono font-bold ${aqiConfig[aqiStatus].color}`}>
              {aqi}
            </span>
            <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${aqiConfig[aqiStatus].bg} text-background`}>
              {aqiConfig[aqiStatus].label}
            </span>
          </div>
        </div>

        {/* Wind Card */}
        <div className="bg-background border border-border rounded-lg p-3 min-w-[120px]">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Wind
          </div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-info" />
            <span className="text-xl font-mono font-bold text-foreground">
              {windSpeed}
            </span>
            <span className="text-xs text-muted-foreground">km/h</span>
            <span className="text-sm font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
              {windDirection}
            </span>
          </div>
        </div>

        {/* FRP Card */}
        <div className="bg-background border border-border rounded-lg p-3 min-w-[120px]">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Fire Power
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-mono font-bold text-warning">
              847.3
            </span>
            <span className="text-xs text-muted-foreground">MW</span>
          </div>
        </div>
      </div>
    </div>
  )
}
