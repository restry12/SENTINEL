"use client"

import { Flame, Activity, ShieldAlert } from "lucide-react"
import { useState, useEffect } from "react"

export function TopBar() {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toISOString().slice(0, 19).replace("T", " "))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="h-12 md:h-14 border-b border-border bg-card flex items-center justify-between px-3 md:px-6 shrink-0 overflow-hidden relative">
      {/* Ambient background glow for critical status */}
      <div className="absolute inset-0 bg-critical/5 animate-pulse pointer-events-none" />
      
      {/* Logo & Status Badge */}
      <div className="flex items-center gap-4 md:gap-6 z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <Flame className="h-5 w-5 md:h-6 md:w-6 text-warning" />
          <span className="text-base md:text-lg font-semibold tracking-wider text-foreground">
            SENTINEL
          </span>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 rounded border border-critical/30 bg-critical/10 animate-pulse">
          <ShieldAlert className="h-3 w-3 text-critical" />
          <span className="text-[10px] font-bold text-critical tracking-tighter uppercase">
            CRITICAL ACTIVE
          </span>
        </div>
      </div>

      {/* Global Hotspots Counter */}
      <div className="flex items-center gap-3 px-3 md:px-5 py-1 bg-background/50 rounded-sm border border-border/50 z-10 backdrop-blur-sm">
        <div className="flex flex-col items-center leading-none">
          <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            Hotspots
          </span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-critical shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-xl md:text-2xl font-mono font-bold text-foreground tabular-nums">
              2,847
            </span>
          </div>
        </div>
      </div>

      {/* System Status & Clock */}
      <div className="hidden md:flex items-center gap-6 z-10">
        <div className="flex flex-col items-end leading-none">
          <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            System Status
          </span>
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-safe" />
            <span className="text-xs font-mono text-safe font-bold tracking-tight">OPERATIONAL</span>
          </div>
        </div>
        
        <div className="h-8 w-px bg-border/50" />
        
        <div className="flex flex-col items-end leading-none">
          <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
            Mission Time
          </span>
          <span className="text-xs font-mono text-foreground font-medium">
            {time || "0000-00-00 00:00:00"} <span className="text-muted-foreground ml-1 text-[10px]">UTC</span>
          </span>
        </div>
      </div>

      {/* Mobile status indicator */}
      <div className="flex md:hidden items-center gap-1 z-10">
        <div className="h-2 w-2 rounded-full bg-critical animate-pulse" />
        <span className="text-xs font-mono text-critical font-bold">CRITICAL</span>
      </div>
    </header>
  )
}
