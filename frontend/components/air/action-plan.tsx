"use client"

import { useState } from "react"
import { THREAT_COLORS, type ThreatLevel } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props {
  threat: ThreatLevel
  aqi: number
  actions?: string[] | null
}

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function ActionPlan({ threat, aqi, actions }: Props) {
  const { tx } = useLang()
  const color          = THREAT_COLORS[threat]
  const staticActions  = tx.actions[threat.toLowerCase() as keyof typeof tx.actions]
  const displayActions = actions ?? staticActions
  const [open, setOpen] = useState(true)

  return (
    <div
      className="bg-black/80 backdrop-blur-md border rounded-sm p-3 font-mono"
      style={{
        borderColor: `${color}40`,
        animation:   "slideInRight 0.4s ease-out",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span
          className="text-[10px] tracking-widest uppercase font-semibold"
          style={{ color }}
        >
          {tx.aiResponsePlan}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: `${color}30` }} />
        <span className="text-[9px] text-muted-foreground tabular-nums">
          AQI {Math.round(aqi)}
        </span>
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
            {displayActions.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2"
                style={{ animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both` }}
              >
                <span
                  className="text-[10px] font-bold tabular-nums flex-shrink-0 mt-px"
                  style={{ color }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[10px] text-foreground/80 leading-tight">{action}</span>
              </div>
            ))}
          </div>

          <div
            className="mt-3 pt-2 border-t"
            style={{ borderColor: `${color}20` }}
          >
            <span className="text-[9px] text-muted-foreground">
              {tx.generatedBy} {now()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
