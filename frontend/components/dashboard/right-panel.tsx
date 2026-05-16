"use client"

import { Users, Route, FileText } from "lucide-react"

function Label({ children, right }: { children: React.ReactNode, right?: string }) {
  return (
    <div className="sentinel-label">
      <span>{children}</span>
      <span className="bar" />
      {right && <span className="text-text-muted font-mono tracking-widest">{right}</span>}
    </div>
  )
}

export function RightPanel() {
  const evacPct = 66

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-[18px] border-b border-border flex items-center">
        <Label>Situational Intelligence</Label>
      </div>

      {/* Content */}
      <div className="flex-1 p-[18px] space-y-6 overflow-y-auto scrollbar-none">
        {/* Social Impact */}
        <div className="sentinel-card p-4">
          <div className="mb-4">
            <Label>Social Impact</Label>
          </div>
          <div className="space-y-0">
            <div className="flex items-baseline justify-between py-2.5 border-b border-border">
              <span className="text-sm font-medium text-text-dim">Population at Risk</span>
              <span className="text-lg font-medium text-red-soft num">127,450</span>
            </div>
            <div className="flex items-baseline justify-between py-2.5 border-b border-border">
              <span className="text-sm font-medium text-text-dim">Evacuated</span>
              <span className="text-lg font-medium text-green-soft num">84,230</span>
            </div>
            <div className="flex items-baseline justify-between py-2.5">
              <span className="text-sm font-medium text-text-dim">In Shelters</span>
              <span className="text-lg font-medium text-blue num">23,847</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
                Evacuation Progress
              </span>
              <span className="text-sm font-medium text-green-soft num">{evacPct}%</span>
            </div>
            <div className="h-2 bg-[#15171c] border border-border rounded-full overflow-hidden relative">
              <div 
                className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#16a34a,#22c55e)] shadow-[0_0_10px_rgba(34,197,94,0.35)] animate-shimmer" 
                style={{ width: `${evacPct}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Safe Routes */}
        <div className="space-y-4">
          <Label>Safe Route</Label>
          <div className="p-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_30%)] bg-surface border border-green/30 rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-text-2">Primary · Lincoln HS</span>
              <span className="px-2 py-0.5 rounded border border-green/30 bg-green/10 text-[9px] font-bold text-green-soft tracking-wider uppercase">
                ACTIVE
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { idx: 1, text: "Oak Valley Rd" },
                { idx: 2, text: "Interstate 42 N" },
                { idx: 3, text: "Exit 17B" },
                { idx: 4, text: "Lincoln High School" },
              ].map((step) => (
                <div key={step.idx} className="flex items-center gap-3 py-1">
                  <span className="w-5 h-5 flex items-center justify-center border border-green/30 bg-green/5 text-[10px] font-medium text-green-soft rounded-sm num">
                    {step.idx}
                  </span>
                  <span className="text-sm text-text-2">{step.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              <span>Est. Travel Time</span>
              <span className="text-sm font-medium text-foreground num tracking-normal normal-case">23 MIN</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 border border-red/20 bg-red/5 rounded-sm text-red-soft">
            <div className="w-1.5 h-1.5 rounded-full bg-red shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-blink" />
            <span className="text-[11px] font-bold tracking-widest uppercase">HWY 9 CLOSED · SMOKE ZONE</span>
          </div>
        </div>

        {/* Municipal Briefing */}
        <div className="space-y-4">
          <Label>Municipal Briefing</Label>
          <div className="flex justify-between items-center text-[10px] font-semibold text-text-dim uppercase tracking-wider">
            <span>Executive Summary</span>
            <span className="text-foreground font-mono font-medium lowercase tracking-normal">15:00 UTC</span>
          </div>
          <div className="text-[12.5px] leading-relaxed text-text-2">
            <p>
              The <span className="text-orange font-semibold">Cedar Ridge Fire</span> has expanded to 
              <span className="text-foreground font-bold"> 12,400 acres</span> with 
              <span className="text-foreground font-bold"> 8% containment</span>. NW winds pushing toward sectors 7A–C.
            </p>
          </div>
          <div className="flex items-center gap-3 p-3.5 border border-border rounded-md bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent)] bg-surface">
            <div className="w-9 h-9 border border-green/35 rounded-full flex items-center justify-center bg-green/5 text-[11px] font-semibold text-green-soft tracking-wider">
              CV
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-foreground">Cmdr. C. Vásquez</div>
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider mt-0.5">Incident Commander</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
