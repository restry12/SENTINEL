"use client"

import { THREAT_COLORS, type ThreatLevel } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props { level: ThreatLevel }

export function ThreatIndicator({ level }: Props) {
  const { tx } = useLang()
  const color      = THREAT_COLORS[level]
  const isCritical = level === "CRITICAL"
  const isHigh     = level === "HIGH"

  const LABELS: Record<ThreatLevel, string> = {
    LOW:      tx.threatLow,
    MODERATE: tx.threatModerate,
    HIGH:     tx.threatHigh,
    CRITICAL: tx.threatCritical,
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-sm border font-mono"
      style={{
        borderColor:     `${color}50`,
        backgroundColor: `${color}12`,
        animation: isCritical
          ? "threatPulse 1.4s ease-in-out infinite"
          : isHigh
            ? "threatPulseOrange 2s ease-in-out infinite"
            : undefined,
      }}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{
          backgroundColor: color,
          animation:       "smokeAlertBlink 1.2s ease-in-out infinite",
        }}
      />
      <span
        className="text-[10px] font-semibold tracking-widest"
        style={{ color }}
      >
        {LABELS[level]}
      </span>
    </div>
  )
}
