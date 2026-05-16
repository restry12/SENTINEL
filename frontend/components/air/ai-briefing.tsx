"use client"

import { useEffect, useState } from "react"
import type { ThreatLevel } from "./types"

interface Props {
  threat: ThreatLevel
}

const BRIEFINGS: Record<ThreatLevel, string[]> = {
  LOW: [
    "Air quality remains within acceptable parameters across all monitored zones.",
    "PM2.5 density is minimal. No immediate risk to public health detected.",
    "Wind conditions are favorable. Dispersion rates are adequate.",
  ],
  MODERATE: [
    "PM2.5 propagation identified, moving toward residential sectors at 24 km/h.",
    "AQI levels are approaching concerning thresholds in northwest districts.",
    "Sensitive populations should begin precautionary indoor measures.",
  ],
  HIGH: [
    "PM2.5 density is increasing toward populated sectors northwest of emission sources.",
    "Projected AQI deterioration may affect vulnerable populations within 2 hours.",
    "Wind vectoring at 315° is accelerating smoke drift toward the Temuco corridor.",
    "Healthcare facilities in the affected radius have been placed on standby.",
  ],
  CRITICAL: [
    "CRITICAL: PM2.5 concentration has exceeded safe exposure thresholds.",
    "Emergency response teams have been activated across all affected zones.",
    "Population in the primary exposure corridor must seek shelter immediately.",
    "Air quality is projected to remain critical for the next 4–6 hours.",
  ],
}

export function AIBriefing({ threat }: Props) {
  const briefings = BRIEFINGS[threat]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const iv = setInterval(() => {
      setVisible(false)
      timeoutId = setTimeout(() => {
        setIndex(i => (i + 1) % BRIEFINGS[threat].length)
        setVisible(true)
      }, 350)
    }, 5500)
    return () => { clearInterval(iv); clearTimeout(timeoutId) }
  }, [threat])

  useEffect(() => {
    setIndex(0)
    setVisible(true)
  }, [threat])

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
          AI INTELLIGENCE
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.4)" }} />
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"
          style={{ animation: "smokeAlertBlink 2.5s ease-in-out infinite" }}
        />
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
          <p
            className="text-[11px] text-foreground/75 leading-relaxed italic"
            style={{
              opacity:    visible ? 1 : 0,
              transition: "opacity 0.35s ease",
            }}
          >
            "{briefings[index]}"
          </p>

          <div className="flex gap-1 mt-2.5">
            {briefings.map((_, i) => (
              <div
                key={i}
                className="h-px flex-1 rounded-full transition-colors duration-500"
                style={{
                  backgroundColor:
                    i === index ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
