"use client"

import type { AQIInfo } from "./types"
import { aqiColor } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props { info: AQIInfo }

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function AQIOverlay({ info }: Props) {
  const { tx } = useLang()
  const barPct    = Math.min(100, (info.current / 300) * 100)
  const pred2hCol = aqiColor(info.predicted2h)
  const recsKey   = info.riskLevel === "VERY HIGH" ? "very_high" : info.riskLevel.toLowerCase() as keyof typeof tx.recs
  const recs      = tx.recs[recsKey]

  // Exposure growth: affectedPopulation is the 2h projected max
  const popNow  = Math.round(info.affectedPopulation * 0.25)
  const pop1h   = Math.round(info.affectedPopulation * 0.535)
  const pop2h   = info.affectedPopulation

  return (
    <div className="absolute top-14 left-4 z-[1000] w-52 flex flex-col gap-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-3 font-mono">

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
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barPct}%`, backgroundColor: info.colorHex }}
          />
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">{tx.forecast2h}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: pred2hCol }}>
          {info.predicted2h}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground uppercase">{tx.riskLevelLabel}</span>
        <span className="text-xs font-semibold" style={{ color: info.colorHex }}>
          {info.riskLevel}
        </span>
      </div>

      <div className="h-px bg-white/10" />

      {/* Population Exposure Projection */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-2">{tx.exposureProj}</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "NOW", pop: popNow },
            { label: "+1H", pop: pop1h  },
            { label: "+2H", pop: pop2h  },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground w-8">{row.label}</span>
              <div className="flex-1 mx-2 h-px bg-white/5" />
              <span
                className="text-[10px] font-semibold tabular-nums"
                style={{ color: info.colorHex }}
              >
                {formatPop(row.pop)} exp.
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div>
        <p className="text-[10px] text-muted-foreground uppercase mb-2">{tx.recommendations}</p>
        <div className="flex flex-col gap-1.5">
          {recs.map(rec => (
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
