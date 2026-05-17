"use client"

import { useLang } from "@/contexts/language-context"
import { useFireSelection } from "@/contexts/fire-selection-context"
import { useSentinel } from "@/contexts/sentinel-context"
import { Flame, Wind, Droplets, Map as MapIcon, ChevronRight } from "lucide-react"

interface ExpansionKey {
  key: '2h' | '6h' | '12h'
  label: string
}

export function TacticalExpansionWidget({ activeExpansion, onExpansionChange }: { activeExpansion: '2h'|'6h'|'12h'|null, onExpansionChange: (k: '2h'|'6h'|'12h') => void }) {
  const { tx } = useLang()
  const { selectedFire } = useFireSelection()
  const { sentinelUpdate: u } = useSentinel()

  if (!selectedFire) return null

  const isCrit = selectedFire.intensity === 'critical'
  const isHigh = selectedFire.intensity === 'high'
  const accentColor = isCrit ? 'text-red' : isHigh ? 'text-orange' : 'text-amber'
  const borderColor = isCrit ? 'border-red/40' : isHigh ? 'border-orange/40' : 'border-amber/40'
  const bgColor = isCrit ? 'bg-red/5' : isHigh ? 'bg-orange/5' : 'bg-amber/5'

  const areas = {
    '2h': selectedFire.expansion2h,
    '6h': selectedFire.expansion6h,
    '12h': selectedFire.expansion12h
  }

  const fmtKm2 = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k km²` : `${v} km²`

  return (
    <div className="absolute top-24 right-6 z-40 w-72 pointer-events-none flex flex-col gap-3">
      <div className={`pointer-events-auto p-5 bg-[#0a0b0e/95] backdrop-blur-2xl border ${borderColor} rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-8 duration-500`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
          <div className="flex flex-col">
            <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${accentColor}`}>
              {isCrit ? 'Incidente Crítico' : isHigh ? 'Incidente Alto' : 'Foco Activo'}
            </span>
            <span className="text-[11px] font-mono text-text-muted mt-0.5">{selectedFire.id}</span>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${borderColor} ${bgColor} ${accentColor}`}>
            <Flame className="w-4 h-4" />
          </div>
        </div>

        {/* Action Quote */}
        <div className="mb-5 p-3 rounded bg-white/5 border border-white/10 italic text-[11px] text-text-2 leading-relaxed">
          &ldquo;De datos crudos a decisión en menos de 60 segundos.&rdquo;
        </div>

        {/* Interactive Expansion Selection */}
        <div className="space-y-3 mb-6">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.15em]">Proyección de Expansión</span>
          <div className="grid grid-cols-3 gap-2">
            {(['2h', '6h', '12h'] as const).map((k) => {
              const isActive = activeExpansion === k
              const ar = areas[k]
              return (
                <button
                  key={k}
                  onClick={() => onExpansionChange(k)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded border transition-all duration-200 ${
                    isActive 
                      ? `${borderColor} ${bgColor} shadow-[0_0_15px_rgba(0,0,0,0.3)]` 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className={`text-[10px] font-black tracking-widest ${isActive ? accentColor : 'text-text-muted'}`}>{k.toUpperCase()}</span>
                  <span className={`text-[11px] font-bold num ${isActive ? 'text-white' : 'text-text-dim'}`}>{ar ? fmtKm2(ar.km2) : '—'}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div className="space-y-1">
            <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Viento</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-white num leading-none">{selectedFire.windKmh}</span>
              <span className="text-[9px] font-bold text-text-dim uppercase">KM/H</span>
              <span className="text-[9px] font-bold text-blue ml-auto">{selectedFire.windImpactDir}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Humedad</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-white num leading-none">{u?.weather.humidity ?? '—'}</span>
              <span className="text-[9px] font-bold text-text-dim uppercase">%</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 flex items-center justify-between text-[9px] font-bold text-text-muted uppercase tracking-tighter opacity-50">
          <span>Detección Satelital</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  )
}
