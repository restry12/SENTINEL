"use client"

import { Wind, AlertTriangle, MessageSquare } from "lucide-react"

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

const riskConfig: Record<RiskLevel, { color: string; bg: string; border: string; glow: string }> = {
  LOW:      { color: "text-safe",     bg: "bg-safe/10",     border: "border-safe/40",     glow: "" },
  MEDIUM:   { color: "text-warning",  bg: "bg-warning/10",  border: "border-warning/40",  glow: "glow-warning" },
  HIGH:     { color: "text-warning",  bg: "bg-warning/10",  border: "border-warning/50",  glow: "glow-warning" },
  CRITICAL: { color: "text-critical", bg: "bg-critical/10", border: "border-critical/60", glow: "glow-critical" },
}

const aqiConfig = {
  good:      { label: "Good",      color: "text-safe",     bg: "bg-safe" },
  moderate:  { label: "Moderate",  color: "text-warning",  bg: "bg-warning" },
  unhealthy: { label: "Unhealthy", color: "text-critical", bg: "bg-critical" },
}

function SectionHeader({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-px h-3 bg-muted-foreground/40 shrink-0" />
      {icon}
      <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
    </div>
  )
}

export function LeftPanel() {
  const riskLevel: RiskLevel = "CRITICAL"
  const frp = 847.3
  const windSpeed = 24
  const windDirection = "NW"
  const aqi = 187
  const aqiStatus = "unhealthy" as keyof typeof aqiConfig
  const cfg = riskConfig[riskLevel]

  return (
    <div className="w-80 border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Threat Assessment
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-5 overflow-y-auto">

        {/* Risk Level */}
        <div>
          <SectionHeader>Current Risk Level</SectionHeader>
          <div className={`${cfg.bg} border ${cfg.border} ${cfg.glow} rounded p-4`}>
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`h-7 w-7 ${cfg.color} shrink-0`}
                style={riskLevel === "CRITICAL" ? { filter: "drop-shadow(0 0 8px #ef4444)" } : undefined}
              />
              <div className="flex flex-col">
                <span className={`text-3xl font-mono font-bold tracking-widest ${cfg.color} leading-none`}>
                  {riskLevel}
                </span>
                {riskLevel === "CRITICAL" && (
                  <span className="text-[9px] font-mono text-critical/70 tracking-widest mt-1 uppercase">
                    Immediate action required
                  </span>
                )}
              </div>
              {riskLevel === "CRITICAL" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-critical blink shrink-0" />
              )}
            </div>
          </div>
        </div>

        {/* Fire Intensity */}
        <div>
          <SectionHeader>Fire Radiative Power</SectionHeader>
          <div className="bg-background border border-border rounded p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-warning">
                {frp.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-mono">MW</span>
            </div>
            <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((frp / 1000) * 100, 100)}%`,
                  background: "linear-gradient(90deg, #f97316, #ef4444)",
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[9px] font-mono text-muted-foreground/50">
              <span>0</span><span>500</span><span>1000 MW</span>
            </div>
          </div>
        </div>

        {/* Wind Conditions */}
        <div>
          <SectionHeader>Wind Conditions</SectionHeader>
          <div className="bg-background border border-border rounded p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wind className="h-4 w-4 text-info shrink-0" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-bold text-foreground">{windSpeed}</span>
                  <span className="text-xs text-muted-foreground font-mono">km/h</span>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-muted border border-border rounded font-mono text-sm font-bold text-foreground tracking-wider">
                {windDirection}
              </div>
            </div>
          </div>
        </div>

        {/* AQI */}
        <div>
          <SectionHeader>Air Quality Index</SectionHeader>
          <div className="bg-background border border-border rounded p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-mono font-bold ${aqiConfig[aqiStatus].color}`}>{aqi}</span>
                <span className="text-xs text-muted-foreground font-mono">AQI</span>
              </div>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded ${aqiConfig[aqiStatus].bg} text-background`}>
                {aqiConfig[aqiStatus].label}
              </span>
            </div>
            <div className="mt-3 flex gap-0.5">
              <div className="flex-1 h-1 rounded-l-full bg-safe" />
              <div className="flex-1 h-1 bg-warning" />
              <div className="flex-1 h-1 rounded-r-full bg-critical" />
            </div>
            <div className="flex justify-between mt-1 text-[9px] font-mono text-muted-foreground/50">
              <span>Good</span><span>Moderate</span><span>Unhealthy</span>
            </div>
          </div>
        </div>

        {/* SMS Alert */}
        <div>
          <SectionHeader icon={<MessageSquare className="h-3 w-3 text-info" />}>
            Active SMS Alert
          </SectionHeader>
          <div className="bg-info/5 border border-info/25 rounded p-4">
            <p className="text-xs text-foreground/90 leading-relaxed font-mono">
              ⚠️ WILDFIRE ALERT: Immediate evacuation ordered for Zone 7A-C.
              Proceed to shelter at Lincoln High School via Route 42.
              Avoid Highway 9. Updates at sentinel.gov/alerts
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>Sent: 14:23 UTC</span>
              <span className="text-info">47,832 recipients</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
