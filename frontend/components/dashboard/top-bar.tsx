"use client"

import { Flame, Activity, ShieldAlert, Globe } from "lucide-react"
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
    <div className="flex flex-col shrink-0 z-50">
      {/* Top Accent Strip */}
      <div className="h-[1px] bg-[linear-gradient(90deg,transparent_0%,rgba(239,68,68,0)_10%,rgba(239,68,68,0.5)_40%,rgba(239,68,68,0.8)_50%,rgba(239,68,68,0.5)_60%,rgba(239,68,68,0)_90%,transparent_100%)]" />
      
      <header className="h-[60px] px-5 border-b border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_70%)] bg-[#0a0b0e/85] backdrop-blur-[12px] flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="w-80 flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-sm border border-border-2 bg-[radial-gradient(circle_at_50%_75%,rgba(249,115,22,0.32),transparent_65%),linear-gradient(180deg,#15171c,#0c0e12)] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.5)]">
            <Flame className="w-[18px] h-[18px] text-orange" />
          </div>
          <div className="flex flex-col gap-1.5 leading-none">
            <span className="text-sm font-semibold tracking-[0.18em] text-[#f4f5f7] uppercase">SENTINEL</span>
            <span className="text-[9px] font-mono font-normal tracking-[0.18em] text-text-muted uppercase">Wildfire Intelligence</span>
          </div>
        </div>

        {/* Center: Mission Critical Status */}
        <div className="flex-1 flex items-center justify-center gap-3.5">
          <div className="px-3.5 py-1.5 rounded-full border border-red/35 bg-[linear-gradient(180deg,rgba(239,68,68,0.10),rgba(239,68,68,0.04))] text-red-soft flex items-center gap-2.5 shadow-[0_0_0_1px_rgba(239,68,68,0.04),0_8px_24px_-12px_rgba(239,68,68,0.35)]">
            <div className="w-1.5 h-1.5 rounded-full bg-red shadow-[0_0_8px_var(--red)] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase whitespace-nowrap">Critical Active</span>
          </div>

          <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-surface border border-border rounded-sm text-[11px] font-medium tracking-[0.12em] text-text-dim">
            <span>Hotspots</span>
            <span className="text-orange-soft font-mono text-sm leading-none num">2,847</span>
          </div>
        </div>

        {/* Right: Telemetry & Time */}
        <div className="w-80 flex items-center justify-end gap-2">
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 bg-surface border border-border rounded-sm text-[11px] font-medium tracking-[0.12em] text-green-soft">
            <Activity className="w-3 h-3" />
            <span>Operational</span>
          </div>

          <div className="px-2.5 py-1.5 bg-surface border border-border rounded-sm flex items-center gap-2 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
            <span className="text-[11px] font-mono text-text-2 tracking-[0.04em] uppercase">
              {time ? time.split(' ')[1] : "00:00:00"} <span className="text-text-muted ml-0.5">UTC</span>
            </span>
          </div>

          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-border rounded-sm text-[11px] font-medium tracking-[0.08em] text-foreground hover:border-border-3 hover:bg-surface-2 transition-colors">
            <Globe className="w-3 h-3 opacity-70" />
            <span>EN</span>
          </button>
        </div>
      </header>
    </div>
  )
}
