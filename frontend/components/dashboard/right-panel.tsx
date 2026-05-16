"use client"

import { Users, Route, FileText } from "lucide-react"

function Label({ children, right }: { children: React.ReactNode, right?: string }) {
  return (
    <div className="sentinel-label">
      <span className="text-foreground">{children}</span>
      <span className="bar opacity-50" />
      {right && <span className="text-blue font-mono tracking-widest">{right}</span>}
    </div>
  )
}

export function RightPanel() {
  const evacPct = 66

  return (
    <div className="w-80 border-l border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden relative">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 -right-20 w-40 h-80 bg-blue/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="p-[18px] border-b border-border flex items-center bg-surface/30">
        <Label>Situational Intelligence</Label>
      </div>

      {/* Content */}
      <div className="flex-1 p-[18px] space-y-6 overflow-y-auto scrollbar-none relative z-10">
        {/* Social Impact */}
        <div className="sentinel-card p-4">
          <div className="mb-4">
            <Label>Social Impact</Label>
          </div>
          <div className="space-y-0">
            {[
              { k: "Population at Risk", v: "127,450", color: "text-red-soft" },
              { k: "Evacuated", v: "84,230", color: "text-green-soft" },
              { k: "In Shelters", v: "23,847", color: "text-blue" },
            ].map((item) => (
              <div key={item.k} className="flex items-baseline justify-between py-2.5 border-b border-white/5 last:border-0">
                <span className="text-sm font-semibold text-text-dim">{item.k}</span>
                <span className={`text-lg font-bold ${item.color} num`}>{item.v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">
                Evacuation Progress
              </span>
              <span className="text-sm font-bold text-green-soft num">{evacPct}%</span>
            </div>
            <div className="h-2.5 bg-black/40 border border-border/50 rounded-full overflow-hidden relative">
              <div 
                className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#10b981,#34d399)] shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-shimmer" 
                style={{ width: `${evacPct}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Safe Routes */}
        <div className="space-y-4">
          <Label>Escape Routes</Label>
          <div className="p-4 bg-[linear-gradient(180deg,rgba(52,211,153,0.1),transparent_40%)] bg-surface/60 border border-green/30 rounded-xl shadow-[0_10px_25px_-10px_rgba(16,185,129,0.15)] backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-text-2 tracking-tight">PRIMARY: LINCOLN HUB</span>
              <span className="px-2 py-0.5 rounded border border-green/40 bg-green/10 text-[9px] font-black text-green-soft tracking-[0.15em] uppercase">
                ACTIVE
              </span>
            </div>
            <div className="space-y-2">
              {[
                "Oak Valley Rd",
                "Interstate 42 N",
                "Exit 17B",
                "Lincoln High School",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 flex items-center justify-center border border-green/40 bg-green/10 text-[10px] font-black text-green-soft rounded num">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-text-2">{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Est. Travel</span>
              <span className="text-sm font-bold text-foreground num bg-surface px-2 py-0.5 border border-border rounded">23 MIN</span>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5 border border-red/30 bg-red/5 rounded-lg text-red-soft shadow-lg shadow-red/5">
            <div className="w-2 h-2 rounded-full bg-red shadow-[0_0_12px_rgba(255,51,51,1)] animate-blink" />
            <span className="text-[11px] font-black tracking-[0.15em] uppercase">HWY 9 CLOSED · HAZARD</span>
          </div>
        </div>

        {/* Municipal Briefing */}
        <div className="space-y-4">
          <Label>Official Briefing</Label>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">Exec Summary</span>
            <span className="text-blue font-mono font-bold text-[10px] uppercase shadow-blue/20">15:00 UTC</span>
          </div>
          <div className="text-[13.5px] leading-[1.6] text-text-2 p-4 bg-surface/40 border border-border rounded-xl">
            <p>
              The <span className="text-orange font-bold drop-shadow-[0_0_8px_rgba(255,126,21,0.3)]">Cedar Ridge Fire</span> expanded to 
              <span className="text-foreground font-bold"> 12,400 acres</span>. 
              Containment at <span className="text-red-soft font-bold">8%</span>. NW winds pushing toward residential sectors.
            </p>
          </div>
          <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent)] bg-surface/80 shadow-lg">
            <div className="w-10 h-10 border-2 border-green/40 rounded-full flex items-center justify-center bg-green/10 text-[12px] font-black text-green shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              CV
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">Cmdr. C. Vásquez</div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Incident Commander</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
