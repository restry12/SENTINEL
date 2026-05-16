"use client"

import { Wind, AlertTriangle, MessageSquare } from "lucide-react"

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

export function LeftPanel() {
  const riskLevel: RiskLevel = "CRITICAL"
  const frp = 847.3
  const windSpeed = 24
  const windDirection = "NW"
  const aqi = 187
  const aqiStatus = "unhealthy" as keyof typeof aqiConfig

  return (
    <div className="w-80 border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Threat Assessment
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Risk Level */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Current Risk Level
          </span>
          <div
            className={`${riskConfig[riskLevel].bg} border border-border rounded p-4`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`h-8 w-8 ${riskConfig[riskLevel].color}`}
              />
              <span
                className={`text-4xl font-bold tracking-wider ${riskConfig[riskLevel].color}`}
              >
                {riskLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Fire Intensity */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Fire Radiative Power
          </span>
          <div className="bg-background border border-border rounded p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-warning">
                {frp.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">MW</span>
            </div>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-warning"
                style={{ width: `${Math.min((frp / 1000) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Wind Conditions */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Wind Conditions
          </span>
          <div className="bg-background border border-border rounded p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wind className="h-5 w-5 text-info" />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold text-foreground">
                      {windSpeed}
                    </span>
                    <span className="text-sm text-muted-foreground">km/h</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded">
                <span className="text-lg font-mono font-bold text-foreground">
                  {windDirection}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AQI Index */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Air Quality Index
          </span>
          <div className="bg-background border border-border rounded p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-mono font-bold ${aqiConfig[aqiStatus].color}`}
                >
                  {aqi}
                </span>
                <span className="text-sm text-muted-foreground">AQI</span>
              </div>
              <span
                className={`text-xs font-semibold uppercase px-2 py-1 rounded ${aqiConfig[aqiStatus].bg} text-background`}
              >
                {aqiConfig[aqiStatus].label}
              </span>
            </div>
            <div className="mt-3 flex gap-1">
              <div className="flex-1 h-1 rounded-full bg-safe" />
              <div className="flex-1 h-1 rounded-full bg-warning" />
              <div className="flex-1 h-1 rounded-full bg-critical" />
            </div>
          </div>
        </div>

        {/* SMS Alert */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-info" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Active SMS Alert
            </span>
          </div>
          <div className="bg-info/10 border border-info/30 rounded p-4">
            <p className="text-sm text-foreground leading-relaxed font-mono">
              ⚠️ WILDFIRE ALERT: Immediate evacuation ordered for Zone 7A-C.
              Proceed to designated shelter at Lincoln High School via Route 42.
              Avoid Highway 9. Updates at sentinel.gov/alerts
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Sent: 14:23 UTC</span>
              <span className="text-info">47,832 recipients</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
