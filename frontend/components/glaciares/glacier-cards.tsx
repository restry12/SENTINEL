'use client'

import type { Glacier } from '@/lib/glacier-types'

const RISK_COLOR: Record<string, string> = {
  'Crítico':    '#ff3333',
  'Riesgo Alto':'#f97316',
  'Observación':'#38bdf8',
  'Estable':    '#10b981',
}

interface Props {
  glaciers: Glacier[]
  selected: Glacier | null
  onSelect: (g: Glacier) => void
  onAnalyze: (g: Glacier) => void
  onOpenDetail: (g: Glacier) => void
}

export function GlacierCards({ glaciers, selected, onSelect, onAnalyze, onOpenDetail }: Props) {
  return (
    <div className="bg-[#0a0d14]/80 backdrop-blur border border-white/8 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Glaciares monitoreados</span>
        <span className="text-[9px] font-mono text-white/30">{glaciers.length} ACTIVOS · CHILE</span>
      </div>
      <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none">
        {glaciers.map(g => {
          const color = RISK_COLOR[g.cat]
          const isSelected = selected?.id === g.id
          return (
            <div
              key={g.id}
              onClick={() => onSelect(g)}
              className={`shrink-0 w-48 rounded-lg border p-3 cursor-pointer transition-all duration-200 ${
                isSelected ? 'border-white/20 bg-white/5' : 'border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white truncate">{g.name}</p>
                  <p className="text-[8px] font-mono text-white/40 truncate">{g.region.toUpperCase()}</p>
                </div>
                <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase"
                  style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}>
                  {g.cat === 'Riesgo Alto' ? 'ALTO' : g.cat.toUpperCase()}
                </span>
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-black tabular-nums" style={{ color, textShadow: `0 0 12px ${color}44` }}>{g.riesgo}</span>
                <span className="text-[9px] font-mono text-white/30">/100</span>
                <span className="ml-auto text-[9px] font-mono" style={{ color: '#ff3333' }}>{g.deltaShort}</span>
              </div>

              <div className="flex items-end gap-px h-6 mb-2">
                {g.riskHistory.slice(-12).map((v, i) => (
                  <div key={i} className="flex-1 rounded-sm"
                    style={{ height: `${(v / 100) * 100}%`, backgroundColor: color, opacity: 0.3 + (i / 12) * 0.7 }} />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1 mb-2">
                <div>
                  <p className="text-[7px] font-bold text-white/30 uppercase">Tendencia</p>
                  <p className="text-[8px] text-white/60 leading-tight">{g.trend}</p>
                </div>
                <div>
                  <p className="text-[7px] font-bold text-white/30 uppercase">Δ/año</p>
                  <p className="text-[8px] font-mono text-white/60">{g.deltaYear}</p>
                </div>
              </div>

              <div className="flex gap-1 pt-2 border-t border-white/5">
                <button onClick={e => { e.stopPropagation(); onOpenDetail(g) }}
                  className="flex-1 py-1 rounded text-[8px] font-black tracking-wider text-white/40 border border-white/10 hover:bg-white/5 hover:text-white/70 uppercase transition-colors">
                  DETALLE
                </button>
                <button onClick={e => { e.stopPropagation(); onAnalyze(g) }}
                  className="flex-1 py-1 rounded text-[8px] font-black tracking-wider uppercase transition-colors"
                  style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}44` }}>
                  ANALIZAR →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
