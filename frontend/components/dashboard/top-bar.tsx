"use client"

import { Sparkles } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"
import { HotspotSearch } from "@/components/dashboard/hotspot-search"

export function TopBar() {
  const pathname = usePathname()
  const { tx } = useLang()
  const { connected, status, sentinelUpdate } = useSentinel()
  const [time, setTime] = useState<string>("")

  const fireCount = sentinelUpdate?.fires.length ?? 0
  const isLoading = status.state === "loading"
  const riskLevel = (sentinelUpdate?.riskLevel ?? "stable").toLowerCase()
  
  const statusLabel = !connected
    ? "OFFLINE"
    : isLoading
      ? "ANALIZANDO…"
      : status.state === "error"
        ? "ERROR"
        : riskLevel === 'critical' ? 'SITUACIÓN CRÍTICA'
        : riskLevel === 'high' ? 'ALERTA ALTA'
        : 'ESTADO OPERATIVO'

  const statusColor = !connected || status.state === "error" ? "text-text-muted" 
    : riskLevel === 'critical' ? "text-red drop-shadow-[0_0_8px_rgba(255,51,51,0.5)]"
    : riskLevel === 'high' ? "text-orange drop-shadow-[0_0_8px_rgba(255,126,21,0.5)]"
    : "text-green-soft"

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
      <header className="h-[56px] md:h-[72px] px-4 md:px-8 border-b border-white/10 bg-[#0f172a] backdrop-blur-2xl flex items-center justify-between gap-4 md:gap-8 relative">
        {/* Animated Glow Line */}
        <div className={`absolute bottom-0 left-0 h-[2px] transition-all duration-1000 ease-in-out ${
          riskLevel === 'critical' ? 'bg-red shadow-[0_0_15px_rgba(255,51,51,0.8)]' : 
          riskLevel === 'high' ? 'bg-orange shadow-[0_0_15px_rgba(249,115,22,0.8)]' : 
          'bg-blue shadow-[0_0_15px_rgba(56,189,248,0.8)]'
        }`} style={{ width: connected ? '100%' : '0%' }} />

        {/* Brand Section */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="relative">
            <div className="absolute inset-0 bg-blue/20 blur-xl rounded-full" />
            <img
              src="/sentinel-logo.png"
              alt="SENTINEL"
              className="h-[36px] md:h-[48px] w-auto relative z-10"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base md:text-xl font-black tracking-[0.25em] text-white leading-none">SENTINEL</h1>
            <p className="hidden md:block text-[9px] font-bold tracking-[0.3em] text-text-muted mt-1.5 uppercase opacity-70">{tx.brandSub}</p>
          </div>
        </div>

        {/* Tactical Status & Navigation */}
        <div className="hidden md:flex flex-1 items-center gap-6">
          <div className={`mr-auto flex items-center gap-4 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl transition-all duration-500 ${
            riskLevel === 'critical' ? 'border-red/30 bg-red/5' : ''
          }`}>
            <div className="flex items-center gap-3 pr-4 border-r border-white/10">
              <div className={`w-2 h-2 rounded-full ${connected ? (riskLevel === 'critical' ? 'bg-red' : 'bg-green') : 'bg-text-muted'} ${connected ? 'animate-pulse' : ''}`} />
              <span className={`text-[11px] font-black tracking-[0.2em] uppercase ${statusColor}`}>{statusLabel}</span>
            </div>
            
            <nav className="flex items-center gap-1">
              {[
                { href: '/dashboard', label: tx.navDashboard },
                { href: '/air',       label: tx.navAir },
                { href: '/tornado',   label: tx.navTornado },
                { href: '/news',      label: tx.navNews ?? 'Noticias' },
                { href: '/glaciares', label: tx.navGlaciares ?? 'GLACIARES' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-300 flex items-center ${
                    pathname === href
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right-aligned utility group */}
          <div className="flex items-center gap-3">
            <HotspotSearch />

            {/* SENTINEL AI — attention-grabbing CTA */}
            <Link
              href="/chat"
              className="group relative inline-flex items-center"
            >
              {/* Soft contained glow */}
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 rounded-full blur-[6px] transition-opacity duration-500 bg-gradient-to-r from-blue/60 via-fuchsia-500/50 to-orange/60 ${
                  pathname === '/chat' ? 'opacity-70' : 'opacity-40 group-hover:opacity-70'
                }`}
              />
              {/* Gradient ring via padding */}
              <span className="relative rounded-full p-[1.5px] bg-gradient-to-r from-blue via-fuchsia-400 to-orange">
                <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0b1220] text-[11px] font-black tracking-[0.2em] uppercase text-white">
                  <Sparkles className="w-3.5 h-3.5 text-blue drop-shadow-[0_0_4px_rgba(56,189,248,0.9)] animate-pulse" />
                  <span>{tx.navChat ?? 'SENTINEL AI'}</span>
                </span>
              </span>
            </Link>
          </div>

        </div>

        {/* Telemetry & Global Info */}
        <div className="hidden md:flex items-center justify-end gap-4 min-w-[250px]">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md">
              <span className="text-[9px] font-bold text-text-muted tracking-widest uppercase">Hotspots</span>
              <span className="text-sm font-black text-orange num leading-none">{fireCount.toLocaleString()}</span>
            </div>
            <div className="text-[11px] font-mono text-text-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-soft animate-pulse" />
              {time || "00:00:00"} <span className="opacity-50">UTC</span>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10 mx-2" />
        </div>
        {/* Mobile: status dot + time */}
        <div className="flex md:hidden items-center gap-3 ml-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
            <div className={`w-2 h-2 rounded-full ${connected ? (riskLevel === 'critical' ? 'bg-red' : 'bg-green') : 'bg-text-muted'} ${connected ? 'animate-pulse' : ''}`} />
            <span className={`text-[10px] font-black tracking-widest uppercase ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <span className="text-[10px] font-mono text-text-muted">{time || "00:00:00"}</span>
        </div>
      </header>
    </div>
  )
}
