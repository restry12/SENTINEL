"use client"

import { Users, FileText } from "lucide-react"

export function InfoSections() {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Municipal Briefing */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-foreground" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Municipal Briefing
          </span>
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            15:00 UTC
          </span>
        </div>
        
        <div className="p-3 bg-background border border-border rounded-lg">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Cedar Ridge Fire has expanded to approximately{" "}
            <span className="text-foreground font-semibold">12,400 acres</span>{" "}
            with <span className="text-warning font-semibold">8%</span>{" "}
            containment. NW winds at 24 km/h are pushing the fire toward
            residential zones 7A-C. All CAL FIRE resources deployed.
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="p-2 bg-background border border-border rounded text-center">
            <div className="text-lg font-mono font-bold text-foreground">1,247</div>
            <div className="text-xs text-muted-foreground">Personnel</div>
          </div>
          <div className="p-2 bg-background border border-border rounded text-center">
            <div className="text-lg font-mono font-bold text-foreground">89</div>
            <div className="text-xs text-muted-foreground">Vehicles</div>
          </div>
          <div className="p-2 bg-background border border-border rounded text-center">
            <div className="text-lg font-mono font-bold text-foreground">12</div>
            <div className="text-xs text-muted-foreground">Aircraft</div>
          </div>
        </div>
        
        <div className="p-2 bg-warning/10 border border-warning/30 rounded mt-3">
          <p className="text-xs text-warning text-center">
            Next briefing: 18:00 UTC
          </p>
        </div>
      </div>

      {/* Social Impact */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-info" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Social Impact
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-background border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">At Risk</div>
            <div className="text-lg font-mono font-bold text-critical">127,450</div>
          </div>
          <div className="p-3 bg-background border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Evacuated</div>
            <div className="text-lg font-mono font-bold text-safe">84,230</div>
          </div>
          <div className="p-3 bg-background border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">In Shelters</div>
            <div className="text-lg font-mono font-bold text-info">23,847</div>
          </div>
          <div className="p-3 bg-background border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Structures</div>
            <div className="text-lg font-mono font-bold text-warning">4,892</div>
          </div>
        </div>
        
        {/* Evacuation Progress */}
        <div className="mt-3 p-3 bg-background border border-border rounded-lg">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Evacuation Progress</span>
            <span className="font-mono text-foreground">66%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-safe" style={{ width: "66%" }} />
          </div>
        </div>
      </div>
    </div>
  )
}
