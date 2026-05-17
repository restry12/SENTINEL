"use client"

import { MessageSquare, X } from "lucide-react"
import { useState, useEffect } from "react"
import { useSentinel, useSentinelMetrics } from "@/contexts/sentinel-context"
import { useLang } from "@/contexts/language-context"

export function TacticalNotification() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()
  const m = useSentinelMetrics()
  const [isVisible, setIsVisible] = useState(false)

  const isUrgent = m.riskLevel === "HIGH" || m.riskLevel === "CRITICAL"

  useEffect(() => {
    if (isUrgent) {
      setIsVisible(true)
    }
  }, [isUrgent])

  if (!isUrgent || !isVisible) return null

  const message = u?.riskAssessment?.resumen ?? u?.airAlerts?.resumen_general ?? (
    <>
      <span className="text-orange font-black">{tx.wildfireAlert}</span>&nbsp;
      {tx.evacuationOrder}
    </>
  )

  return (
    <div className="fixed bottom-32 left-4 right-4 z-[100] md:hidden">
      <div className="relative p-4 bg-[#0a0b0e/95] backdrop-blur-2xl border border-blue/40 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(56,189,248,0.2)] animate-in slide-in-from-bottom-8 duration-500">
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 p-1 text-text-muted hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3 text-[10px] font-black tracking-[0.2em] text-blue uppercase">
          <MessageSquare className="h-4 w-4 animate-pulse" />
          <span>{tx.activeBroadcast}</span>
        </div>

        <div className="text-[14px] text-white leading-relaxed font-semibold pr-4">
          {message}
        </div>

        <div className="mt-3 text-[9px] font-mono font-bold text-text-muted tracking-widest uppercase border-t border-white/10 pt-3 flex justify-between">
          <span>SISTEMA DE ALERTA SENTINEL</span>
          <span>
            {u?.timestamp
              ? new Date(u.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
              : "00:00 UTC"}
          </span>
        </div>
      </div>
    </div>
  )
}
