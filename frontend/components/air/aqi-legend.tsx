"use client"

import { AQI_THRESHOLDS } from "./types"

const RANGES = ["0 – 50", "51 – 100", "101 – 150", "151+"]

export function AQILegend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-black/75 backdrop-blur-md border border-white/10 rounded-sm px-3 py-2 font-mono">
      <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-2">
        AQI Scale
      </p>
      <div className="flex flex-col gap-1.5">
        {AQI_THRESHOLDS.map((t, i) => (
          <div key={t.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-[10px] text-muted-foreground w-16">{RANGES[i]}</span>
            <span className="text-[10px] text-foreground/70">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
