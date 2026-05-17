"use client"

import { Wind, ChevronLeft, Zap, Activity, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TornadoCell } from "./world-tornado-map"

const RISK_CONFIG = {
  extreme:  { label: "EXTREMO",    color: "text-red-400",    border: "border-red-500/30",    bg: "bg-red-500/10",    dot: "bg-red-400" },
  confirmed:{ label: "CONFIRMADO", color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10", dot: "bg-purple-400" },
  high:     { label: "ALTO",       color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10", dot: "bg-orange-400" },
  rotation: { label: "ROTACIÓN",   color: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-500/10", dot: "bg-violet-400" },
  moderate: { label: "MODERADO",   color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", dot: "bg-yellow-400" },
  low:      { label: "BAJO",       color: "text-green-400",  border: "border-green-500/30",  bg: "bg-green-500/10",  dot: "bg-green-400" },
}

interface Props {
  cells:        TornadoCell[]
  selectedCell: TornadoCell | null
  onCellSelect: (cell: TornadoCell) => void
  onBack:       () => void
}

export function TornadoLeftPanel({ cells, selectedCell, onCellSelect, onBack }: Props) {
  return (
    <div className="absolute top-6 left-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
      <div className="h-full overflow-y-auto pr-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
        {selectedCell ? (
          <CellDetailPanel cell={selectedCell} onBack={onBack} />
        ) : (
          <GlobalPanel cells={cells} onCellSelect={onCellSelect} />
        )}
      </div>
    </div>
  )
}

function GlobalPanel({ cells, onCellSelect }: { cells: TornadoCell[]; onCellSelect: (c: TornadoCell) => void }) {
  return (
    <>
      {/* Summary widget */}
      <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Alerta Tornado Activa</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Celdas activas</p>
            <p className="text-xl font-black text-white">{cells.length}</p>
          </div>
          <div className="bg-black/30 rounded border border-red-500/15 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Riesgo máx.</p>
            <p className="text-sm font-black text-red-400">EXTREMO</p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Viento máx.</p>
            <p className="text-base font-black text-white">142<span className="text-xs text-white/50 ml-1">km/h</span></p>
          </div>
          <div className="bg-black/30 rounded border border-purple-500/15 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Prob. máx.</p>
            <p className="text-base font-black text-purple-300">78<span className="text-xs text-white/50 ml-1">%</span></p>
          </div>
        </div>

        {/* EF bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-white/30 mb-1 font-mono">
            <span>EF0</span><span>EF1</span><span>EF2</span><span>EF3</span><span>EF4</span><span>EF5</span>
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden bg-black/30">
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #22c55e 0%, #eab308 20%, #f97316 40%, #ef4444 65%, #a855f7 85%, #7c3aed 100%)" }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_#fff]" style={{ left: "76%" }} />
          </div>
          <p className="text-[9px] text-white/30 mt-1 text-right font-mono">Nivel actual estimado: EF2–EF3</p>
        </div>
      </div>

      {/* Cells list */}
      <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Celdas Convectivas</span>
        </div>
        <div className="p-3 flex flex-col gap-2">
          {cells.map(cell => {
            const rc = RISK_CONFIG[cell.risk] ?? RISK_CONFIG.moderate
            return (
              <button
                key={cell.id}
                onClick={() => onCellSelect(cell)}
                className={cn(
                  "w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
                  "bg-black/20 hover:bg-black/40",
                  rc.border, "hover:shadow-[0_0_16px_rgba(0,0,0,0.4)]"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-[11px]", rc.bg, rc.color)}>
                  {cell.code}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-xs font-bold truncate">{cell.name}</p>
                  <p className="text-white/35 text-[10px] font-mono truncate">{cell.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={cn("text-[9px] font-bold uppercase tracking-wide", rc.color)}>{rc.label}</span>
                  <span className="text-[9px] text-white/30 font-mono">{cell.prob}%</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modelo HRRR */}
      <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-cyan-500/15 rounded-lg p-3 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/70">Modelo HRRR-v4</span>
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed">
          Radar NEXRAD-IV en vivo. Actualización cada 5 min. Confianza del modelo: <span className="text-cyan-400 font-bold">0.83</span>
        </p>
      </div>
    </>
  )
}

function CellDetailPanel({ cell, onBack }: { cell: TornadoCell; onBack: () => void }) {
  const rc = RISK_CONFIG[cell.risk] ?? RISK_CONFIG.moderate
  return (
    <>
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white/80 transition-colors px-2 py-1.5 rounded border border-white/10 hover:border-white/20 bg-black/20 backdrop-blur-md"
      >
        <ChevronLeft className="w-3 h-3" />
        Celdas activas
      </button>

      {/* Cell header */}
      <div className={cn("bg-[#0a0d14]/90 backdrop-blur-xl border rounded-lg p-4 shadow-2xl", rc.border)}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider mb-2", rc.bg, rc.color)}>
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", rc.dot)} />
              {rc.label}
            </div>
            <h2 className="text-white font-black text-sm">{cell.name}</h2>
            <p className="text-white/40 text-[10px] font-mono mt-0.5">{cell.description}</p>
          </div>
          <span className={cn("text-2xl font-black", rc.color)}>{cell.code}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { k: "Prob. tornado", v: `${cell.prob}%` },
            { k: "Viento máx.", v: `${cell.wind} km/h` },
            { k: "Impacto en", v: `${cell.eta} min` },
            { k: "Escala EF", v: cell.ef },
          ].map(({ k, v }) => (
            <div key={k} className="bg-black/30 rounded border border-white/5 p-2">
              <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">{k}</p>
              <p className="text-sm font-black text-white leading-tight">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 bg-black/30 rounded border border-white/5 p-2">
          <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Rotación</p>
          <p className="text-white font-black">{cell.rotacion} kt <span className="text-white/40 text-xs font-normal">· Mesociclón</span></p>
        </div>
      </div>

      {/* AI Prediction */}
      <div className="bg-[#040d18]/90 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-4 shadow-[0_0_24px_rgba(34,211,238,0.05)]">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/70">Predicción IA · HRRR-v4</span>
        </div>
        <p className="text-[11px] text-white/60 leading-relaxed">{cell.aiPrediction}</p>
      </div>

      {/* Wind indicator */}
      <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Condiciones de viento</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-black text-white">{cell.wind}<span className="text-sm text-white/40 ml-1">km/h</span></p>
            <p className="text-[10px] text-white/35 font-mono mt-0.5">Viento superficial</p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(cell.wind / 200 * 100, 100)}%`,
              background: "linear-gradient(90deg, #22c55e, #eab308, #f97316, #ef4444)"
            }}
          />
        </div>
      </div>
    </>
  )
}
