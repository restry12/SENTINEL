"use client"

import type { ScenarioId } from "./types"
import { useLang } from "@/contexts/language-context"

interface Props {
  active:   ScenarioId
  onSelect: (id: ScenarioId) => void
}

export function ScenarioControls({ active, onSelect }: Props) {
  const { tx } = useLang()

  const BUTTONS: { id: Exclude<ScenarioId, "none">; label: string; danger: boolean }[] = [
    { id: "wind",     label: tx.scenarioWind,     danger: false },
    { id: "humidity", label: tx.scenarioHumidity, danger: false },
    { id: "worst",    label: tx.scenarioWorst,    danger: true  },
  ]

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-wrap justify-center items-center gap-2 font-mono px-4 max-w-[calc(100vw-32px)]">
      <span className="text-[9px] text-muted-foreground tracking-widest uppercase mr-1 select-none">
        {tx.simulate}
      </span>
      {BUTTONS.map(btn => {
        const isActive    = active === btn.id
        const activeColor = btn.danger ? "#ef4444" : "#f97316"
        return (
          <button
            key={btn.id}
            onClick={() => onSelect(isActive ? "none" : btn.id)}
            className="px-3 py-1.5 text-[10px] rounded-sm border transition-all duration-300 tracking-wide"
            style={{
              borderColor:     isActive ? activeColor         : "rgba(255,255,255,0.15)",
              color:           isActive ? activeColor         : "rgba(255,255,255,0.45)",
              backgroundColor: isActive ? `${activeColor}15`  : "rgba(0,0,0,0.6)",
              boxShadow:       isActive ? `0 0 12px ${activeColor}30` : "none",
            }}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}
