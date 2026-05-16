"use client"

import { Route } from "lucide-react"

export function SafeRoute() {
  return (
    <div className="border-b border-border bg-card p-3 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <Route className="h-4 w-4 text-safe" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Safe Route
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <div className="h-2 w-2 rounded-full bg-critical animate-pulse" />
          <span className="text-xs text-critical font-semibold">HWY 9 CLOSED</span>
        </div>
      </div>
      
      <div className="p-3 bg-safe/10 border border-safe/30 rounded-lg">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-mono text-safe">
          <span>Oak Valley Rd</span>
          <span className="text-safe/50">→</span>
          <span>I-42 N</span>
          <span className="text-safe/50">→</span>
          <span>Exit 17B</span>
          <span className="text-safe/50">→</span>
          <span>Lincoln High</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Est. travel time: <span className="font-mono text-foreground">23 min</span>
        </div>
      </div>
    </div>
  )
}
