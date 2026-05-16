"use client"

import { bearingName, type WindData } from "./types"

interface Props {
  wind: WindData
}

export function SmokeAlert({ wind }: Props) {
  const windDir = bearingName(wind.fromDeg)

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-5 py-2 bg-black/75 backdrop-blur-md border border-red-500/40 rounded-sm font-mono whitespace-nowrap">
      <span
        className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0"
        style={{ animation: "smokeAlertBlink 1.2s ease-in-out infinite" }}
      />
      <span className="text-xs font-semibold tracking-widest uppercase text-red-400">
        Smoke Propagation Detected
      </span>
      <span className="text-border">|</span>
      <span className="text-xs text-muted-foreground">
        2 Active Sources
      </span>
      <span className="text-border">|</span>
      <span className="text-xs text-muted-foreground">
        Wind: {windDir} {wind.speed} km/h
      </span>
    </div>
  )
}
