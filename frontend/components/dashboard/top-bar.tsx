"use client"

import { Flame, Activity, Globe, RadarIcon } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"

export function TopBar() {
  const pathname = usePathname()
  const { lang, toggle, tx } = useLang()
  const { connected, status, trigger, sentinelUpdate } = useSentinel()
  const [time, setTime] = useState<string>("")

  const fireCount = sentinelUpdate?.fires.length ?? 0
  const isLoading = status.state === "loading"
  const statusLabel = !connected
    ? "OFFLINE"
    : isLoading
      ? "ANALIZANDO…"
      : status.state === "error"
        ? "ERROR"
        : (sentinelUpdate?.riskLevel ?? "").toUpperCase() || (connected ? "EN LÍNEA" : tx.statusCritical)
  const statusColor = !connected || status.state === "error" ? "text-text-muted" : "text-red"

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toISOString().slice(11, 19))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col shrink-0 z-50">
      <div className="h-[1.5px] bg-[linear-gradient(90deg,transparent_0%,rgba(255,126,21,0.2)_10%,rgba(255,51,51,0.8)_50%,rgba(255,126,21,0.2)_90%,transparent_100%)] shadow-[0_0_15px_rgba(255,51,51,0.3)]" />

      <header className="h-[64px] px-6 border-b border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_70%)] bg-[#080c14/90] backdrop-blur-xl flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="w-80 flex items-center gap-4">
          <div className="w-[38px] h-[38px] rounded-lg border border-white/10 bg-[radial-gradient(circle_at_50%_75%,rgba(255,126,21,0.4),transparent_65%),linear-gradient(180deg,#1e293b,#0f172a)] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <Flame className="w-[20px] h-[20px] text-orange drop-shadow-[0_0_8px_rgba(255,126,21,0.6)]" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="text-[15px] font-black tracking-[0.2em] text-white uppercase drop-shadow-sm">SENTINEL</span>
            <span className="text-[9px] font-bold tracking-[0.25em] text-text-muted uppercase">{tx.brandSub}</span>
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <nav className="flex items-center gap-1 p-1 rounded-lg border border-white/5 bg-surface/40 backdrop-blur-md">
            {([
              { href: '/dashboard',         label: tx.navDashboard },
              { href: '/air',               label: tx.navAir },
              { href: '/dashboard/citizen', label: 'Ciudadano' },
            ] as const).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase transition-all duration-200 ${
                  pathname === href
                    ? 'bg-orange/15 text-orange border border-orange/30 shadow-[0_0_12px_rgba(255,126,21,0.15)]'
                    : 'text-text-muted hover:text-foreground hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className={`px-4 py-2 rounded-full border border-red/40 bg-[linear-gradient(180deg,rgba(255,51,51,0.15),rgba(255,51,51,0.05))] ${statusColor} flex items-center gap-3 shadow-[0_10px_30px_-10px_rgba(255,51,51,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in zoom-in duration-500`}>
            <div className={`w-2 h-2 rounded-full shadow-[0_0_12px_rgba(255,51,51,1)] ${connected ? "bg-red animate-pulse" : "bg-text-muted"}`} />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase whitespace-nowrap">{statusLabel}</span>
          </div>

          <button
            onClick={() => trigger()}
            disabled={isLoading || !connected}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange/40 bg-orange/10 text-orange text-[11px] font-black tracking-[0.15em] uppercase hover:bg-orange/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RadarIcon className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "…" : "Analizar"}</span>
          </button>

          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-surface/60 border border-white/5 rounded-lg text-[11px] font-bold tracking-[0.15em] text-text-dim backdrop-blur-md">
            <span>{tx.hotspots}</span>
            <span className="text-orange-soft font-mono text-base leading-none num drop-shadow-[0_0_8px_rgba(255,174,66,0.4)]">{fireCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Right */}
        <div className="w-80 flex items-center justify-end gap-3">
          <div className="hidden xl:flex items-center gap-2.5 px-3 py-2 bg-green/5 border border-green/20 rounded-lg text-[11px] font-bold tracking-[0.15em] text-green-soft shadow-lg shadow-green/5">
            <Activity className="w-3.5 h-3.5" />
            <span>{tx.operational}</span>
          </div>

          <div className="px-3 py-2 bg-surface/60 border border-white/5 rounded-lg flex items-center gap-3 whitespace-nowrap shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-[12px] font-mono font-bold text-foreground tracking-widest uppercase">
              {time || "00:00:00"} <span className="text-text-muted font-normal ml-0.5 text-[10px]">UTC</span>
            </span>
          </div>

          <button
            onClick={toggle}
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-2 rounded-lg text-[11px] font-black tracking-[0.1em] text-foreground hover:border-blue/50 hover:bg-blue/5 hover:text-blue transition-all duration-200"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'ES' : 'EN'}</span>
          </button>
        </div>
      </header>
    </div>
  )
}
