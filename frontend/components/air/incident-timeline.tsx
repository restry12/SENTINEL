"use client"

import { useState } from "react"
import { THREAT_COLORS, type ThreatLevel } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props {
  alerts?: Array<{ zona: string; aqi: number; nivel: string; recomendacion: string }> | null
}

interface Event {
  id:      string
  time:    string
  message: string
  level:   ThreatLevel
}

export function IncidentTimeline({ alerts }: Props) {
  const { tx } = useLang()

  const events: Event[] = (alerts ?? []).map((a, i) => ({
    id:      `live-${i}`,
    time:    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    message: `${a.zona} — AQI ${a.aqi} (${a.nivel})`,
    level:   a.aqi > 150 ? "CRITICAL" : a.aqi > 100 ? "HIGH" : a.aqi > 50 ? "MODERATE" : "LOW",
  }))

  const [open, setOpen] = useState(true)

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
          {tx.incidentLog}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.4)" }} />
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="mt-3">
          {events.length > 0 ? (
            <div className="flex flex-col gap-2">
              {events.map((ev, i) => {
                const color   = THREAT_COLORS[ev.level]
                const opacity = 0.45 + 0.55 * (i / Math.max(events.length - 1, 1))
                return (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2"
                    style={{ opacity }}
                  >
                    <span className="text-[9px] text-muted-foreground tabular-nums flex-shrink-0 mt-0.5">
                      {ev.time}
                    </span>
                    <div
                      className="w-px self-stretch flex-shrink-0 rounded-full"
                      style={{ backgroundColor: color + "70" }}
                    />
                    <span className="text-[10px] text-foreground/70 leading-tight">{ev.message}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider py-1">
              {tx.noIncidents}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
