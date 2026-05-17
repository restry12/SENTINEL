"use client"

import { X, MapPin, Activity, Building2, Sparkles, Loader2 } from "lucide-react"
import type { FireRiskRegion, RegionDetail } from "@/hooks/use-socket"
import { CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/risk-grid"

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1">
        <span>{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-blue" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function FireRiskCellPanel({
  region,
  detail,
  loading,
  detailError,
  onClose,
}: {
  region: FireRiskRegion | null
  detail: RegionDetail | null
  loading: boolean
  detailError: string | null
  onClose: () => void
}) {
  if (!region) return null

  const color = CATEGORY_COLOR[region.category]

  return (
    <div className="absolute top-24 bottom-8 right-6 z-40 w-80 pointer-events-none flex flex-col">
      <div className="flex-1 overflow-y-auto pl-3 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
        {/* Header + score ring */}
        <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted pr-6">
              {region.nombre}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `conic-gradient(${color} ${region.score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
            >
              <div className="rounded-full bg-[#0a0b0e] flex flex-col items-center justify-center"
                   style={{ width: "3.75rem", height: "3.75rem" }}>
                <span className="text-2xl font-black text-white num leading-none">{region.score}</span>
                <span className="text-[8px] text-text-muted uppercase tracking-widest">score</span>
              </div>
            </div>
            <div>
              <span
                className="px-2.5 py-1 rounded text-[9px] font-black tracking-widest uppercase border"
                style={{ color, borderColor: `${color}66`, background: `${color}1a` }}
              >
                {CATEGORY_LABEL[region.category]}
              </span>
            </div>
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Factores</span>
          </div>
          <div className="space-y-2.5">
            <FactorBar label="FWI (clima)" value={region.factors.fwi} />
            <FactorBar label="Historial" value={region.factors.historial} />
            <FactorBar label="Terreno" value={region.factors.terreno} />
          </div>
        </div>

        {/* Loading state while Overpass + Mistral respond */}
        {loading && (
          <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[11px]">Analizando infraestructura e impacto…</span>
          </div>
        )}

        {/* Detail fetch failure */}
        {!loading && detailError && !detail && (
          <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
            <span className="text-[11px] text-red">{detailError}</span>
          </div>
        )}

        {/* Detail — infrastructure, AI, priority */}
        {!loading && detail && (
          <>
            <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                  Infraestructura sensible
                </span>
              </div>
              <div className="text-[11px] text-text-2 leading-relaxed">
                {detail.resumen_infraestructura}
              </div>
            </div>

            {detail.explicacion && (
              <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Análisis IA</span>
                </div>
                <p className="text-[12px] text-text-2 leading-relaxed mb-3">{detail.explicacion}</p>
                {detail.recomendaciones.length > 0 && (
                  <ul className="space-y-1.5">
                    {detail.recomendaciones.map((r, idx) => (
                      <li key={idx} className="text-[11px] text-orange-soft flex gap-2">
                        <span className="text-orange">▸</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="w-full bg-[#0f172a] backdrop-blur-xl border border-white/20 rounded-lg p-3 shadow-2xl flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                Prioridad de intervención
              </span>
              <span className="px-2.5 py-1 rounded text-[9px] font-black tracking-widest uppercase border border-red/40 bg-red/10 text-red">
                {PRIORITY_LABEL[detail.prioridad] ?? detail.prioridad}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
