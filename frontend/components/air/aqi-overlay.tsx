"use client"

import type { AQIInfo } from "./types"
import { aqiColor } from "./types"

interface Props { info: AQIInfo }

const RECOMMENDATIONS = [
  "Avoid outdoor exercise",
  "Close windows and doors",
  "Wear N95 mask outdoors",
  "Sensitive groups stay indoors",
]

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function AQIOverlay({ info }: Props) {
  const barPct    = Math.min(100, (info.current / 300) * 100)
  const pred2hCol = aqiColor(info.predicted2h)

  return (
    <div className="absolute top-14 left-4 z-[1000] w-52 flex flex-col gap-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">

      <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
        Air Quality Index
      </p>

      <div>
        <div className="flex items-end gap-2 mb-1.5">
          <span
            className="text-4xl font-bold leading-none tabular-nums"
            style={{ color: info.colorHex }}
          >
            {info.current}
          </span>
          <span className="text-xs text-muted-foreground mb-0.5">{info.label}</span>
        </div>
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${barPct}%`, backgroundColor: info.colorHex }}
          />
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">+2h Forecast</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: pred2hCol }}>
          {info.predicted2h}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">Risk Level</span>
        <span className="text-xs font-semibold" style={{ color: info.colorHex }}>
          {info.riskLevel}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">Affected Pop.</span>
        <span className="text-xs text-foreground">{formatPop(info.affectedPopulation)}</span>
      </div>

      <div className="h-px bg-white/10" />

      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-2">Recommendations</p>
        <div className="flex flex-col gap-1.5">
          {RECOMMENDATIONS.map(rec => (
            <div key={rec} className="flex items-start gap-1.5">
              <span className="text-warning text-[10px] mt-px flex-shrink-0">▸</span>
              <span className="text-[10px] text-foreground/80 leading-tight">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
