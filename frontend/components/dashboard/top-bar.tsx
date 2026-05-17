"use client"

import { Globe, RadarIcon, Shield, Activity, Search } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"
import { toast } from "sonner"
import { HotspotSearch } from "@/components/dashboard/hotspot-search"

export function TopBar() {
  const pathname = usePathname()
  const { lang, toggle, tx } = useLang()
  const { connected, status, trigger, sentinelUpdate } = useSentinel()
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

  const onTrigger = () => {
    toast.info("Activando Agente 1: Actualizando datos satelitales en tiempo real...", {
      duration: 3000,
      icon: <RadarIcon className="w-4 h-4 animate-spin text-orange" />
    })
    trigger()
  }

  return (
    <div className="flex flex-col shrink-0 z-50">
      <header className="h-[72px] px-8 border-b border-white/10 bg-[#080c14/80] backdrop-blur-2xl flex items-center justify-between gap-8 relative overflow-hidden">
        {/* Animated Glow Line */}
        <div className={`absolute bottom-0 left-0 h-[2px] transition-all duration-1000 ease-in-out ${
          riskLevel === 'critical' ? 'bg-red shadow-[0_0_15px_rgba(255,51,51,0.8)]' : 
          riskLevel === 'high' ? 'bg-orange shadow-[0_0_15px_rgba(249,115,22,0.8)]' : 
          'bg-blue shadow-[0_0_15px_rgba(56,189,248,0.8)]'
        }`} style={{ width: connected ? '100%' : '0%' }} />

        {/* Brand Section */}
        <div className="flex items-center gap-4 min-w-[250px]">
          <div className="relative">
            <div className="absolute inset-0 bg-blue/20 blur-xl rounded-full" />
            <img
              src="/sentinel-logo.png"
              alt="SENTINEL"
              className="h-[48px] w-auto relative z-10"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-[0.25em] text-white leading-none">SENTINEL</h1>
            <p className="text-[9px] font-bold tracking-[0.3em] text-text-muted mt-1.5 uppercase opacity-70">{tx.brandSub}</p>
          </div>
        </div>

        {/* Tactical Status & Navigation */}
        <div className="flex-1 flex items-center justify-center gap-6">
          <div className={`flex items-center gap-4 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl transition-all duration-500 ${
            riskLevel === 'critical' ? 'border-red/30 bg-red/5' : ''
          }`}>
            <div className="flex items-center gap-3 pr-4 border-r border-white/10">
              <div className={`w-2 h-2 rounded-full ${connected ? (riskLevel === 'critical' ? 'bg-red' : 'bg-green') : 'bg-text-muted'} ${connected ? 'animate-pulse' : ''}`} />
              <span className={`text-[11px] font-black tracking-[0.2em] uppercase ${statusColor}`}>{statusLabel}</span>
            </div>
            
            <nav className="flex items-center gap-1">
              {([
                { href: '/dashboard',         label: tx.navDashboard },
                { href: '/air',               label: tx.navAir },
                { href: '/news',              label: tx.navNews ?? 'Noticias' },
                { href: '/dashboard/citizen', label: 'Ciudadano' },
              ] as const).map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${
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

          {/* New Search Component from Main */}
          <HotspotSearch />

          <button
            onClick={onTrigger}
            disabled={isLoading || !connected}
            className={`group relative flex items-center gap-3 px-5 py-2.5 rounded-lg border transition-all duration-300 overflow-hidden ${
              isLoading ? 'border-orange/30 bg-orange/5' : 'border-blue/40 bg-blue/10 hover:bg-blue/20 text-blue-soft'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <RadarIcon className={`w-4 h-4 ${isLoading ? "animate-spin text-orange" : "text-blue"}`} />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase">{isLoading ? "Procesando" : "Escanear"}</span>
          </button>
        </div>

        {/* Telemetry & Global Info */}
        <div className="flex items-center justify-end gap-4 min-w-[250px]">
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

          <button
            onClick={toggle}
            className="w-12 h-10 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-black transition-colors"
          >
            {lang.toUpperCase()}
          </button>
          
          <div className="w-10 h-10 rounded-full border border-white/20 bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </header>
    </div>
  )
}
