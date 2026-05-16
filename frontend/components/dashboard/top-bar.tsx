"use client"

import { Flame, Activity } from "lucide-react"

export function TopBar() {
  return (
    <header className="h-12 md:h-14 border-b border-border bg-card flex items-center justify-between px-3 md:px-6 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 md:gap-3">
        <Flame className="h-5 w-5 md:h-6 md:w-6 text-warning" />
        <span className="text-base md:text-lg font-semibold tracking-wider text-foreground">
          SENTINEL
        </span>
      </div>

      {/* Global Hotspots Counter */}
      <div className="flex items-center gap-2 px-2 md:px-4 py-1 md:py-2 bg-background rounded border border-border">
        <div className="h-2 w-2 rounded-full bg-critical animate-pulse" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:inline">
          Hotspots
        </span>
        <span className="text-lg md:text-2xl font-mono font-bold text-foreground">
          2,847
        </span>
      </div>

      {/* System Status - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-safe" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            System
          </span>
          <span className="text-xs font-mono text-safe">OPERATIONAL</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-safe" />
          <span className="text-xs font-mono text-muted-foreground">
            {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC
          </span>
        </div>
      </div>

      {/* Mobile status indicator */}
      <div className="flex md:hidden items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-safe" />
        <span className="text-xs font-mono text-safe">OK</span>
      </div>
    </header>
  )
}
