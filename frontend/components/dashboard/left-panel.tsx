"use client"

import { AlertTriangle, Wind, MessageSquare } from "lucide-react"

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

function Label({ children, right }: { children: React.ReactNode, right?: string }) {
  return (
    <div className="sentinel-label">
      <span>{children}</span>
      <span className="bar" />
      {right && <span className="text-text-muted font-mono tracking-widest">{right}</span>}
    </div>
  )
}

function WindRose({ direction }: { direction: string }) {
  return (
    <div className="relative w-[52px] h-[52px] border border-border-2 rounded-full flex items-center justify-center bg-[radial-gradient(circle,#181a1f_0%,#0c0e12_80%)] shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]">
      <span className="absolute top-[3px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">N</span>
      <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">S</span>
      <span className="absolute right-[4px] top-1/2 -translate-y-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">E</span>
      <span className="absolute left-[4px] top-1/2 -translate-y-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">W</span>
      <div 
        className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-bottom-[18px] border-bottom-blue-2 filter drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]"
        style={{ transform: `rotate(${direction === 'NW' ? -45 : 0}deg)` }}
      />
    </div>
  )
}

export function LeftPanel() {
  const riskLevel: RiskLevel = "CRITICAL"
  const frp = 847.3
  const windSpeed = 24
  const windDirection = "NW"
  const aqi = 187
  
  const frpPct = Math.min((frp / 1000) * 100, 100)
  const aqiMarkerPos = Math.min(95, (aqi / 300) * 100)

  return (
    <div className="w-80 border-r border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-[18px] border-b border-border flex items-center">
        <Label>Threat Assessment</Label>
      </div>

      {/* Content */}
      <div className="flex-1 p-[18px] space-y-5 overflow-y-auto scrollbar-none">
        {/* Risk Level */}
        <div className="relative p-[18px] rounded-md border border-red/30 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(239,68,68,0.14),transparent_70%)] bg-[#1a0e0f] shadow-[inset_0_1px_0_rgba(255,180,180,0.05),0_14px_32px_-22px_rgba(239,68,68,0.6)] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-soft/70">
              Current Risk Level
            </span>
            <div className="w-[7px] h-[7px] rounded-full bg-red shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-blink" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 border border-red/40 rounded-sm bg-red/10 flex items-center justify-center text-red-soft shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold tracking-tight text-[#ffe2e2] leading-none num">
              {riskLevel}
            </div>
          </div>
          <p className="mt-3 text-[11px] font-medium text-red-soft/85 tracking-wide">
            Immediate Action Required · Sector 7A
          </p>
        </div>

        {/* Fire Radiative Power */}
        <div className="sentinel-card p-4">
          <Label right="MW">Fire Radiative Power</Label>
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-medium tracking-tight text-orange-soft num">
                {frp.toFixed(1)} <span className="text-xs text-text-muted font-sans font-bold ml-1 uppercase">MW</span>
              </div>
              <div className="text-[10px] font-medium px-2 py-0.5 rounded border border-red/30 bg-red/10 text-red-soft num">
                +12%
              </div>
            </div>
            <div className="h-[5px] bg-[#15171c] border border-border rounded-full relative overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#fbbf24,var(--orange)_55%,var(--red))] shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-shimmer" 
                style={{ width: `${frpPct}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Wind Conditions */}
        <div className="sentinel-card p-4">
          <Label>Wind</Label>
          <div className="mt-4 flex items-center gap-4">
            <WindRose direction={windDirection} />
            <div className="flex-1">
              <div className="text-2xl font-medium tracking-tight text-foreground num leading-none">
                {windSpeed} <span className="text-[10px] text-text-muted font-sans font-bold ml-1 uppercase">KM/H</span>
              </div>
            </div>
            <div className="px-2 py-1 bg-surface-2 border border-border-2 rounded-sm text-[11px] font-mono font-medium text-text-2 min-w-[38px] text-center">
              {windDirection}
            </div>
          </div>
        </div>

        {/* Air Quality Index */}
        <div className="sentinel-card p-4">
          <Label>Air Quality</Label>
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-medium tracking-tight text-red-soft num">
                {aqi} <span className="text-[10px] text-text-muted font-sans font-bold ml-1 uppercase">AQI</span>
              </div>
              <div className="text-[10px] font-medium px-2 py-0.5 rounded border border-red/30 bg-red/10 text-red-soft font-mono uppercase tracking-wide">
                UNHEALTHY
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[linear-gradient(90deg,#22c55e_0%,#22c55e_22%,#f59e0b_48%,#f97316_68%,#ef4444_92%)] relative mt-2">
              <div 
                className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] rounded-[1px]" 
                style={{ left: `${aqiMarkerPos}%` }}
              >
                <div className="absolute bottom-[-5px] left-[-3px] border-[4px] border-transparent border-t-white" />
              </div>
            </div>
          </div>
        </div>

        {/* SMS Alert */}
        <div className="p-3 bg-[linear-gradient(180deg,rgba(96,165,250,0.06),rgba(96,165,250,0.02))] border border-blue/20 rounded-md">
          <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold tracking-[0.14em] text-blue uppercase">
            <MessageSquare className="h-3 w-3" />
            <span>Active SMS Broadcast</span>
          </div>
          <div className="text-xs text-[#d4d6db] leading-relaxed">
            <span className="text-[#fbbf24] font-bold">⚠ WILDFIRE ALERT:</span>&nbsp;
            Immediate evacuation ordered for Zone 7A–C. Proceed to shelter at Lincoln High School via Route 42. Avoid Highway 9.
          </div>
          <div className="mt-2.5 flex justify-between text-[9px] font-mono text-text-muted tracking-wide uppercase">
            <span className="num">Sent 14:23 UTC</span>
            <span className="text-blue num">47,832 Recipients</span>
          </div>
        </div>
      </div>
    </div>
  )
}
