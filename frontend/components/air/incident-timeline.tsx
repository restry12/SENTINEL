"use client"

import { THREAT_COLORS, type ThreatLevel, type ScenarioId } from "./types"

interface Props { scenarioId: ScenarioId }

interface Event {
  id:      string
  time:    string
  message: string
  level:   ThreatLevel
}

const BASE_EVENTS: Event[] = [
  { id: "e1", time: "13:42", message: "Wildfire detected — FIRE-001 active",           level: "HIGH"     },
  { id: "e2", time: "13:47", message: "Smoke propagation identified",                  level: "HIGH"     },
  { id: "e3", time: "13:51", message: "FIRE-002 escalated to PRIMARY",                 level: "CRITICAL" },
  { id: "e4", time: "13:53", message: "AQI deterioration forecasted",                  level: "MODERATE" },
  { id: "e5", time: "13:55", message: "Emergency alerts dispatched",                   level: "HIGH"     },
  { id: "e6", time: "13:58", message: "32K population in exposure corridor",           level: "HIGH"     },
]

const SCENARIO_EVENTS: Record<string, Event[]> = {
  wind: [
    { id: "w1", time: "14:02", message: "Wind intensification detected — 52 km/h",    level: "CRITICAL" },
    { id: "w2", time: "14:05", message: "Smoke drift velocity escalated significantly",level: "CRITICAL" },
  ],
  humidity: [
    { id: "h1", time: "14:02", message: "Relative humidity critical — 8%",             level: "CRITICAL" },
    { id: "h2", time: "14:05", message: "Fire spread risk elevated to CRITICAL",        level: "CRITICAL" },
  ],
  worst: [
    { id: "x1", time: "14:02", message: "Worst-case scenario conditions active",       level: "CRITICAL" },
    { id: "x2", time: "14:04", message: "All parameters at critical threshold",         level: "CRITICAL" },
    { id: "x3", time: "14:06", message: "Emergency evacuation recommended",            level: "CRITICAL" },
  ],
}

export function IncidentTimeline({ scenarioId }: Props) {
  const extra  = scenarioId !== "none" ? (SCENARIO_EVENTS[scenarioId] ?? []) : []
  const events = [...BASE_EVENTS, ...extra].slice(-7)

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">
      <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold mb-3">
        INCIDENT LOG
      </p>
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
  )
}
