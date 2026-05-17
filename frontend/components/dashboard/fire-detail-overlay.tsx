"use client"

import { MapPin, Flame, Wind, ChevronUp, X, ShieldAlert } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useFireSelection } from "@/contexts/fire-selection-context"
import { useSentinel } from "@/contexts/sentinel-context"
import { CollapsibleWidget } from "./widget"

function WindRose({ direction }: { direction: string }) {
  const deg = ({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 } as Record<string, number>)[direction] ?? 0
  return (
    <div className="relative w-10 h-10 border border-white/10 rounded-full flex items-center justify-center bg-black/40 shadow-inner shrink-0">
      <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[6px] font-bold text-text-muted">N</span>
      <div
        className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[14px] border-b-blue filter drop-shadow-[0_0_4px_rgba(56,189,248,0.6)]"
        style={{ transform: `rotate(${deg}deg)` }}
      />
    </div>
  )
}

export function FireDetailOverlay() {
  const { tx } = useLang()
  const { selectedFire, setSelectedFire } = useFireSelection()
  const { sentinelUpdate: u } = useSentinel()

  if (!selectedFire) return null

  const intensityColor = selectedFire.intensity === 'critical' ? 'text-red border-red/40 bg-red/10'
    : selectedFire.intensity === 'high' ? 'text-orange border-orange/40 bg-orange/10'
    : 'text-amber border-amber/40 bg-amber/10'

  const reportActions = u?.report?.acciones_inmediatas ?? []
  const recommendedAction = reportActions[0] ?? (
    selectedFire.intensity === 'critical' ? 'Evacuación preventiva inmediata'
    : selectedFire.intensity === 'high' ? 'Preparar evacuación de la zona'
    : 'Monitoreo continuo del foco'
  )

  return (
    <div className="absolute top-24 bottom-8 left-6 z-40 w-80 pointer-events-none flex flex-col">
      <div className="flex-1 overflow-y-auto pr-3 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
        {/* Main ID & Close Widget */}
        <div className="w-full bg-[#0a0b0e/90] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl relative group">
          <button
            onClick={() => setSelectedFire(null)}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{tx.fireId}</span>
          </div>
          
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black tracking-[0.15em] text-white num">{selectedFire.id}</div>
            <span className={`px-2.5 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${intensityColor}`}>
              {selectedFire.intensity === 'critical' ? tx.criticalFires
                : selectedFire.intensity === 'high' ? tx.highFires
                : tx.moderateFires}
            </span>
          </div>
          
          <div className="mt-2 text-[10px] font-mono text-text-muted">
            {selectedFire.lat.toFixed(4)}° / {selectedFire.lon.toFixed(4)}°
          </div>
        </div>

        {/* Recommended Action Widget */}
        <CollapsibleWidget title="Acción Recomendada" icon={<ShieldAlert className="w-3.5 h-3.5" />} defaultOpen={true} className="w-full">
          <div className="p-3 rounded border border-orange/20 bg-orange/10 text-[12px] font-semibold text-orange-soft leading-relaxed shadow-[inset_0_0_15px_rgba(255,126,21,0.05)]">
            {recommendedAction}
          </div>
        </CollapsibleWidget>

        {/* FRP Widget */}
        <CollapsibleWidget title="Potencia Térmica" icon={<Flame className="w-3.5 h-3.5" />} className="w-full">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">FRP (MW)</div>
              <div className="text-2xl font-black text-orange-soft num leading-none">
                {selectedFire.frp.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">Brillo (K)</div>
              <div className="text-2xl font-black text-orange-soft num leading-none">
                {selectedFire.brightness.toFixed(0)}
              </div>
            </div>
          </div>
        </CollapsibleWidget>

        {/* Wind Widget — solo si el foco tiene datos enriquecidos (top 150) */}
        {selectedFire.weather && (
          <CollapsibleWidget title="Impacto del Viento" icon={<Wind className="w-3.5 h-3.5" />} className="w-full">
            <div className="flex items-center gap-4">
              <WindRose direction={selectedFire.windImpactDir} />
              <div className="flex-1">
                <div className="text-2xl font-bold text-white num leading-none">
                  {selectedFire.windKmh}<span className="text-[11px] font-sans text-text-dim ml-1.5">KM/H</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1.5 uppercase tracking-tight font-medium">
                  Propagación: <span className="text-blue font-black">{selectedFire.windImpactDir}</span>
                </div>
              </div>
            </div>
          </CollapsibleWidget>
        )}

        {/* Projections Widget */}
        <CollapsibleWidget title="Proyecciones" icon={<ChevronUp className="w-3.5 h-3.5 rotate-45" />} defaultOpen={false} className="w-full">
          <div className="space-y-3">
            {([
              { label: '2H', data: selectedFire.expansion2h, color: 'text-red-soft' },
              { label: '6H', data: selectedFire.expansion6h, color: 'text-orange' },
              { label: '12H', data: selectedFire.expansion12h, color: 'text-amber' },
            ] as const).map(({ label, data, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className={`text-[10px] font-black ${color} tracking-widest`}>{label}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-white num">{data?.km2 ?? '—'} km²</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleWidget>
      </div>
    </div>
  )
}
