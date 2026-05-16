"use client"

import { AlertTriangle, Wind, MessageSquare } from "lucide-react"

function Label({ children, right }: { children: React.ReactNode, right?: string }) {
  return (
    <div className="sentinel-label">
      <span className="text-foreground">{children}</span>
      <span className="bar opacity-50" />
      {right && <span className="text-orange font-mono tracking-widest">{right}</span>}
    </div>
  )
}

function WindRose({ direction }: { direction: string }) {
  return (
    <div className="relative w-[52px] h-[52px] border border-border-2 rounded-full flex items-center justify-center bg-[radial-gradient(circle,#181a1f_0%,#0c0e12_80%)] shadow-[inset_0_0_12px_rgba(0,0,0,0.6),0_0_15px_rgba(56,189,248,0.1)]">
      <span className="absolute top-[3px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">N</span>
      <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">S</span>
      <span className="absolute right-[4px] top-1/2 -translate-y-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">E</span>
      <span className="absolute left-[4px] top-1/2 -translate-y-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">W</span>
      <div 
        className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-bottom-[18px] border-bottom-blue filter drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]"
        style={{ transform: `rotate(${direction === 'NW' ? -45 : 0}deg)` }}
      />
    </div>
  )
}

export function LeftPanel() {
  const riskLevel = "CRITICAL"
  const frp = 847.3
  const windSpeed = 24
  const windDirection = "NW"
  const aqi = 187
  
  const frpPct = Math.min((frp / 1000) * 100, 100)
  const aqiMarkerPos = Math.min(95, (aqi / 300) * 100)

  return (
    <div className="w-80 border-r border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden relative">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 -left-20 w-40 h-80 bg-orange/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="p-[18px] border-b border-border flex items-center bg-surface/30">
        <Label>Threat Assessment</Label>
      </div>

      {/* Content */}
      <div className="flex-1 p-[18px] space-y-5 overflow-y-auto scrollbar-none relative z-10">
        {/* Risk Level */}
        <div className="relative p-[18px] rounded-xl border border-red/40 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(255,51,51,0.2),transparent_70%)] bg-[#1a0e0f] shadow-[0_15px_35px_-15px_rgba(255,51,51,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-soft">
              Current Risk Level
            </span>
            <div className="w-2 h-2 rounded-full bg-red shadow-[0_0_15px_rgba(255,51,51,1)] animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-red/50 rounded-lg bg-red/10 flex items-center justify-center text-red shadow-[0_0_15px_rgba(255,51,51,0.2)] shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="text-4xl font-bold tracking-tight text-white leading-none num drop-shadow-[0_0_10px_rgba(255,51,51,0.5)]">
              {riskLevel}
            </div>
          </div>
          <p className="mt-3 text-[11px] font-semibold text-red-soft tracking-wide">
            Immediate Action Required · Sector 7A
          </p>
        </div>

        {/* Fire Radiative Power */}
        <div className="sentinel-card sentinel-card-glow-orange p-4">
          <Label right="MW">Fire Radiative Power</Label>
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold tracking-tight text-orange-soft num drop-shadow-[0_0_8px_rgba(255,174,66,0.3)]">
                {frp.toFixed(1)} <span className="text-xs text-text-dim font-sans font-bold ml-1 uppercase">MW</span>
              </div>
              <div className="text-[10px] font-bold px-2 py-0.5 rounded border border-red/40 bg-red/10 text-red num">
                +12%
              </div>
            </div>
            <div className="h-[6px] bg-black/40 border border-border/50 rounded-full relative overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#fbbf24,var(--orange)_55%,var(--red))] shadow-[0_0_15px_rgba(255,126,21,0.5)] animate-shimmer" 
                style={{ width: `${frpPct}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Wind Conditions */}
        <div className="sentinel-card p-4">
          <Label>Wind Conditions</Label>
          <div className="mt-4 flex items-center gap-4">
            <WindRose direction={windDirection} />
            <div className="flex-1">
              <div className="text-2xl font-bold tracking-tight text-foreground num leading-none">
                {windSpeed} <span className="text-[10px] text-text-dim font-sans font-bold ml-1 uppercase">KM/H</span>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-surface border border-border-2 rounded text-xs font-mono font-bold text-blue shadow-[0_0_10px_rgba(56,189,248,0.1)] min-w-[45px] text-center">
              {windDirection}
            </div>
          </div>
        </div>

        {/* Air Quality Index */}
        <div className="sentinel-card sentinel-card-glow-red p-4">
          <Label>Air Quality Index</Label>
          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold tracking-tight text-red-soft num drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]">
                {aqi} <span className="text-[10px] text-text-dim font-sans font-bold ml-1 uppercase">AQI</span>
              </div>
              <div className="text-[10px] font-bold px-2 py-0.5 rounded border border-red/50 bg-red/10 text-red font-mono uppercase tracking-widest">
                UNHEALTHY
              </div>
            </div>
            <div className="h-2 rounded-full bg-[linear-gradient(90deg,#10b981_0%,#10b981_22%,#fbbf24_48%,#ff7e15_68%,#ff3333_92%)] relative mt-2 shadow-inner">
              <div 
                className="absolute top-[-4px] bottom-[-4px] w-[3px] bg-white shadow-[0_0_12px_rgba(255,255,255,1)] rounded-full z-10" 
                style={{ left: `${aqiMarkerPos}%` }}
              >
                <div className="absolute bottom-[-6px] left-[-3px] border-[4px] border-transparent border-t-white" />
              </div>
            </div>
          </div>
        </div>

        {/* SMS Alert */}
        <div className="p-4 bg-[linear-gradient(180deg,rgba(56,189,248,0.15),rgba(56,189,248,0.05))] border border-blue/30 rounded-xl shadow-[0_10px_25px_-10px_rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-bold tracking-[0.2em] text-blue uppercase">
            <MessageSquare className="h-4 w-4" />
            <span>Active Broadcast</span>
          </div>
          <div className="text-[13px] text-foreground leading-relaxed font-medium">
            <span className="text-amber font-bold">⚠ WILDFIRE ALERT:</span>&nbsp;
            Immediate evacuation ordered for Zone 7A–C. Proceed to shelter at Lincoln High School via Route 42.
          </div>
          <div className="mt-3.5 flex justify-between items-center text-[10px] font-bold text-text-muted tracking-wide uppercase border-t border-blue/10 pt-3">
            <span className="num opacity-70">14:23 UTC</span>
            <span className="text-blue num shadow-blue/20 drop-shadow-sm">47,832 Recipients</span>
          </div>
        </div>
      </div>
    </div>
  )
}
