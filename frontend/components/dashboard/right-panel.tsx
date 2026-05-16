"use client"

import { Users, Route, FileText } from "lucide-react"

export function RightPanel() {
  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Situational Intelligence
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Social Impact */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-info" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Social Impact
            </span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Population at Risk
              </span>
              <span className="text-lg font-mono font-bold text-critical">
                127,450
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Evacuated</span>
              <span className="text-lg font-mono font-bold text-safe">
                84,230
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">In Shelters</span>
              <span className="text-lg font-mono font-bold text-info">
                23,847
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Structures Threatened
              </span>
              <span className="text-lg font-mono font-bold text-warning">
                4,892
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Evacuation Progress</span>
                <span className="font-mono">66%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-safe" style={{ width: "66%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Safe Route */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <Route className="h-4 w-4 text-safe" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Safe Route
            </span>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-safe/10 border border-safe/30 rounded">
              <div className="text-xs text-muted-foreground uppercase mb-1">
                Primary Route
              </div>
              <div className="space-y-1">
                <p className="text-sm font-mono text-safe">→ Oak Valley Rd</p>
                <p className="text-sm font-mono text-safe">→ Interstate 42 N</p>
                <p className="text-sm font-mono text-safe">→ Exit 17B</p>
                <p className="text-sm font-mono text-safe">
                  → Lincoln High School
                </p>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Est. travel time:{" "}
                <span className="font-mono text-foreground">23 min</span>
              </div>
            </div>
            <div className="p-3 bg-background border border-border rounded">
              <div className="text-xs text-muted-foreground uppercase mb-1">
                Alternate Route
              </div>
              <div className="space-y-1">
                <p className="text-sm font-mono text-muted-foreground">
                  → Maple St
                </p>
                <p className="text-sm font-mono text-muted-foreground">
                  → Highway 7 W
                </p>
                <p className="text-sm font-mono text-muted-foreground">
                  → Community Center
                </p>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Est. travel time:{" "}
                <span className="font-mono text-foreground">31 min</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-critical animate-pulse" />
              <span className="text-critical font-semibold">
                Highway 9 CLOSED
              </span>
            </div>
          </div>
        </div>

        {/* Municipal Briefing */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Municipal Briefing
            </span>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-background border border-border rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground uppercase">
                  Executive Summary
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  15:00 UTC
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Cedar Ridge Fire has expanded to approximately{" "}
                <span className="text-foreground font-semibold">
                  12,400 acres
                </span>{" "}
                with <span className="text-warning font-semibold">8%</span>{" "}
                containment. NW winds at 24 km/h are pushing the fire toward
                residential zones 7A-C. All available CAL FIRE resources have
                been deployed. Air tanker support expected by 16:00 UTC.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Fire Personnel Deployed
                </span>
                <span className="font-mono text-foreground">1,247</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Ground Vehicles</span>
                <span className="font-mono text-foreground">89</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Aircraft Operations
                </span>
                <span className="font-mono text-foreground">12</span>
              </div>
            </div>
            <div className="p-2 bg-warning/10 border border-warning/30 rounded">
              <p className="text-xs text-warning">
                ⚡ Next briefing scheduled: 18:00 UTC
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
