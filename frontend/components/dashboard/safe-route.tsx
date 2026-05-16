"use client"

import { Route } from "lucide-react"

export function SafeRoute() {
  return (
    <div className="sentinel-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-green-soft">
          <Route className="h-3 w-3" />
          <span>Safe Route</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-red shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-blink" />
          <span className="text-[9px] font-bold text-red-soft uppercase tracking-wider">HWY 9 CLOSED</span>
        </div>
      </div>
      
      <div className="p-4 bg-green/5 border border-green/20 rounded-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-text-2">
          <span>Oak Valley Rd</span>
          <span className="text-text-muted">→</span>
          <span>I-42 N</span>
          <span className="text-text-muted">→</span>
          <span>Exit 17B</span>
          <span className="text-text-muted">→</span>
          <span>Lincoln High</span>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          <span>Est. travel time</span>
          <span className="text-sm font-medium text-foreground num">23 MIN</span>
        </div>
      </div>
    </div>
  )
}
