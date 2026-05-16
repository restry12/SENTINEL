"use client"

import { Users, Route, FileText } from "lucide-react"

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-px h-3 bg-muted-foreground/40 shrink-0" />
      {icon}
      <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {children}
      </span>
    </div>
  )
}

export function RightPanel() {
  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Situational Intelligence
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* Social Impact */}
        <div className="p-4 border-b border-border">
          <SectionHeader icon={<Users className="h-3 w-3 text-info" />}>
            Social Impact
          </SectionHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Population at Risk</span>
              <span className="text-base font-mono font-bold text-critical tabular-nums">127,450</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Evacuated</span>
              <span className="text-base font-mono font-bold text-safe tabular-nums">84,230</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">In Shelters</span>
              <span className="text-base font-mono font-bold text-info tabular-nums">23,847</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Structures Threatened</span>
              <span className="text-base font-mono font-bold text-warning tabular-nums">4,892</span>
            </div>
            <div className="pt-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                <span>Evacuation Progress</span>
                <span className="text-foreground">66%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full shimmer rounded-full" style={{ width: "66%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Safe Route */}
        <div className="p-4 border-b border-border">
          <SectionHeader icon={<Route className="h-3 w-3 text-safe" />}>
            Safe Route
          </SectionHeader>
          <div className="space-y-2.5">
            <div className="p-3 bg-safe/5 border border-safe/30 rounded">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
                Primary Route
              </div>
              <div className="space-y-0.5">
                {["Oak Valley Rd", "Interstate 42 N", "Exit 17B", "Lincoln High School"].map((step) => (
                  <p key={step} className="text-xs font-mono text-safe flex items-center gap-1.5">
                    <span className="text-safe/40">›</span>{step}
                  </p>
                ))}
              </div>
              <div className="mt-2.5 text-[10px] font-mono text-muted-foreground">
                Est. travel time: <span className="text-foreground tabular-nums">23 min</span>
              </div>
            </div>
            <div className="p-3 bg-background border border-border rounded">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
                Alternate Route
              </div>
              <div className="space-y-0.5">
                {["Maple St", "Highway 7 W", "Community Center"].map((step) => (
                  <p key={step} className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <span className="text-muted-foreground/40">›</span>{step}
                  </p>
                ))}
              </div>
              <div className="mt-2.5 text-[10px] font-mono text-muted-foreground">
                Est. travel time: <span className="text-foreground tabular-nums">31 min</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="h-1.5 w-1.5 rounded-full bg-critical blink shrink-0" />
              <span className="text-critical font-bold tracking-wider">HWY 9 CLOSED</span>
            </div>
          </div>
        </div>

        {/* Municipal Briefing */}
        <div className="p-4">
          <SectionHeader icon={<FileText className="h-3 w-3 text-muted-foreground" />}>
            Municipal Briefing
          </SectionHeader>
          <div className="space-y-4">
            <div className="p-3 bg-background border border-border rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-bold text-foreground uppercase tracking-widest">
                  Executive Summary
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">15:00 UTC</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                The Cedar Ridge Fire has expanded to approximately{" "}
                <span className="text-foreground font-semibold">12,400 acres</span>{" "}
                with <span className="text-warning font-semibold">8%</span>{" "}
                containment. NW winds at 24 km/h pushing toward zones 7A-C.
                Air tanker support expected by 16:00 UTC.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { label: "Fire Personnel Deployed", value: "1,247" },
                { label: "Ground Vehicles",         value: "89" },
                { label: "Aircraft Operations",     value: "12" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
                  <span className="text-xs font-mono font-bold text-foreground tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            <div className="p-2 bg-warning/8 border border-warning/25 rounded">
              <p className="text-[10px] font-mono text-warning text-center tracking-wider">
                ⚡ Next briefing: 18:00 UTC
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
