"use client"

import { useState } from "react"
import { THREAT_COLORS, type ThreatLevel, type ScenarioId } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props { scenarioId: ScenarioId }

interface Event {
  id:      string
  time:    string
  message: string
  level:   ThreatLevel
}

export function IncidentTimeline({ scenarioId }: Props) {
  const { tx } = useLang()

  const BASE_EVENTS: Event[] = [
    { id: "e1", time: "13:42", message: tx.events.base[0], level: "HIGH"     },
    { id: "e2", time: "13:47", message: tx.events.base[1], level: "HIGH"     },
    { id: "e3", time: "13:51", message: tx.events.base[2], level: "CRITICAL" },
    { id: "e4", time: "13:53", message: tx.events.base[3], level: "MODERATE" },
    { id: "e5", time: "13:55", message: tx.events.base[4], level: "HIGH"     },
    { id: "e6", time: "13:58", message: tx.events.base[5], level: "HIGH"     },
  ]

  const SCENARIO_EVENTS: Record<Exclude<ScenarioId, "none">, Event[]> = {
    wind: [
      { id: "w1", time: "14:02", message: tx.events.wind[0], level: "CRITICAL" },
      { id: "w2", time: "14:05", message: tx.events.wind[1], level: "CRITICAL" },
    ],
    humidity: [
      { id: "h1", time: "14:02", message: tx.events.humidity[0], level: "CRITICAL" },
      { id: "h2", time: "14:05", message: tx.events.humidity[1], level: "CRITICAL" },
    ],
    worst: [
      { id: "x1", time: "14:02", message: tx.events.worst[0], level: "CRITICAL" },
      { id: "x2", time: "14:04", message: tx.events.worst[1], level: "CRITICAL" },
      { id: "x3", time: "14:06", message: tx.events.worst[2], level: "CRITICAL" },
    ],
  }

  const extra  = scenarioId !== "none" ? (SCENARIO_EVENTS[scenarioId] ?? []) : []
  const events = [...BASE_EVENTS, ...extra].slice(-7)
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
        </div>
      )}
    </div>
  )
}
