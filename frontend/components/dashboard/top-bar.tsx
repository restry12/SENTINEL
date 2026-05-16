"use client"

import { Flame, Activity } from "lucide-react"
import { useEffect, useState } from "react"

export function TopBar() {
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () => setTime(new Date().toISOString().slice(0, 19).replace("T", " "))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-12 md:h-14 border-b border-border bg-card flex items-center justify-between px-3 md:px-6 shrink-0 relative">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-critical/60 to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-2 md:gap-3">
        <Flame
          className="h-5 w-5 md:h-6 md:w-6 text-warning shrink-0"
          style={{ filter: "drop-shadow(0 0 6px #f97316)" }}
        />
        <div className="flex flex-col leading-none">
          <span className="text-sm md:text-base font-mono font-bold tracking-[0.18em] text-foreground">
            SENTINEL
          </span>
          <span className="hidden md:block text-[9px] font-mono tracking-[0.12em] text-muted-foreground/70 uppercase mt-0.5">
            Wildfire Response Sys
          </span>
        </div>
      </div>

      {/* CRITICAL ACTIVE badge — center */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 px-3 py-1 rounded border border-critical/50 bg-critical/10 glow-critical">
        <span className="h-1.5 w-1.5 rounded-full bg-critical blink" />
        <span className="text-xs font-mono font-bold tracking-widest text-critical">
          CRITICAL ACTIVE
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Global Hotspots Counter */}
        <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-background rounded border border-border">
          <div className="h-1.5 w-1.5 rounded-full bg-critical animate-pulse" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:inline font-mono">
            HOTSPOTS
          </span>
          <span className="text-base md:text-xl font-mono font-bold text-foreground">
            2,847
          </span>
        </div>

        {/* System Status — desktop only */}
        <div className="hidden md:flex items-center gap-3">
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-safe" />
            <span className="text-xs font-mono text-safe tracking-wider">OPERATIONAL</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-safe" />
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {time} UTC
            </span>
          </div>
        </div>

        {/* Mobile status */}
        <div className="flex md:hidden items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-critical blink" />
          <span className="text-xs font-mono text-critical font-bold">CRIT</span>
        </div>
      </div>
    </header>
  )
}
