"use client"

import React from "react"
import { Snowflake, Loader2 } from "lucide-react"
import type { GlacierInfo } from "@sentinel/types"

type GlacierWithMass = GlacierInfo & { lastMassChange: number }

interface Props {
  glaciers: GlacierWithMass[]
  selectedGlacierId: string | null
  onGlacierSelect: (id: string) => void
  loading: boolean
}

function quickRisk(lastMassChange: number): { label: string; color: string } {
  if (lastMassChange < -1500) return { label: 'CRITICO', color: 'text-red border-red/40 bg-red/5' }
  if (lastMassChange < -1000) return { label: 'ALTO', color: 'text-orange border-orange/40 bg-orange/5' }
  if (lastMassChange < -500)  return { label: 'MEDIO', color: 'text-yellow border-yellow/40 bg-yellow/5' }
  return { label: 'BAJO', color: 'text-blue border-blue/40 bg-blue/5' }
}

export function GlacierLeftPanel({ glaciers, selectedGlacierId, onGlacierSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4 flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin text-text-muted" />
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Cargando…</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Snowflake className="w-3.5 h-3.5 text-blue" />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Glaciares</span>
          <span className="ml-auto text-[9px] font-bold text-white/20">{glaciers.length}</span>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-white/5">
        {glaciers.map(g => {
          const risk = quickRisk(g.lastMassChange)
          const isSelected = g.id === selectedGlacierId
          return (
            <button
              key={g.id}
              onClick={() => onGlacierSelect(g.id)}
              className={`w-full text-left px-4 py-3 transition-colors hover:bg-white/5 border-l-2 ${
                isSelected ? 'bg-white/5 border-l-[#00f2ff]' : 'border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                    {g.name}
                  </div>
                  <div className="text-[9px] text-text-muted font-bold mt-0.5 truncate">
                    {g.region} · {g.country}
                  </div>
                </div>
                <span className={`shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded border ${risk.color}`}>
                  {risk.label}
                </span>
              </div>
              {g.area_km2 != null && (
                <div className="text-[8px] text-white/20 font-mono mt-1">{g.area_km2} km²</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
