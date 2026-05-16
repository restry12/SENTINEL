"use client"

import { useEffect, useState } from "react"
import type { ThreatLevel, EnvData } from "./types"

interface Props {
  threat: ThreatLevel
  env: EnvData
}

const BRIEFINGS: Record<ThreatLevel, string[]> = {
  LOW: [
    "Air quality remains within acceptable parameters across all monitored zones.",
    "Smoke density is minimal. No immediate risk to public health detected.",
    "Wind conditions are favorable. Dispersion rates are adequate.",
  ],
  MODERATE: [
    "Smoke propagation identified, moving toward residential sectors at 24 km/h.",
    "AQI levels are approaching concerning thresholds in northwest districts.",
    "Sensitive populations should begin precautionary indoor measures.",
  ],
  HIGH: [
    "Smoke density is increasing toward populated sectors northwest of the fire source.",
    "Projected AQI deterioration may affect vulnerable populations within 2 hours.",
    "Wind vectoring at 315° is accelerating smoke drift toward the Temuco corridor.",
    "Healthcare facilities in the affected radius have been placed on standby.",
  ],
  CRITICAL: [
    "CRITICAL: Smoke concentration has exceeded safe exposure thresholds.",
    "Emergency response teams have been activated across all affected zones.",
    "Population in the primary exposure corridor must seek shelter immediately.",
    "Air quality is projected to remain critical for the next 4–6 hours.",
  ],
}

export function AIBriefing({ threat, env }: Props) {
  const briefings = BRIEFINGS[threat]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % briefings.length)
        setVisible(true)
      }, 350)
    }, 5500)
    return () => clearInterval(iv)
  }, [briefings.length])

  useEffect(() => {
    setIndex(0)
    setVisible(true)
  }, [threat])

  return (
    <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
          AI INTELLIGENCE
        </span>
        <div className="flex-1 h-px bg-white/10" />
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"
          style={{ animation: "smokeAlertBlink 2.5s ease-in-out infinite" }}
        />
      </div>

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
  )
}
