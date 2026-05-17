"use client"

import { Building2, School, Navigation, Users, Clock } from "lucide-react"
import type { TornadoCell } from "./world-tornado-map"

interface Props {
  selectedCell: TornadoCell | null
}

export function TornadoRightPanel({ selectedCell }: Props) {
  return (
    <div className="absolute top-6 right-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
      <div className="h-full overflow-y-auto pl-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
        <SummaryCard selectedCell={selectedCell} />
        <ActionsCard />
        <InfraCard />
        <TimelineCard />
      </div>
    </div>
  )
}

function SummaryCard({ selectedCell }: { selectedCell: TornadoCell | null }) {
  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-red-500/25 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
            INTEL · TORNADOS
          </span>
          <p className="text-[9px] text-white/25 font-mono mt-0.5">
            {selectedCell ? selectedCell.name : "SECTOR 04-N · HRRR-v4"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-red-500/30 bg-red-500/5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/80">LIVE</span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-black/30 rounded border border-red-500/15 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Riesgo actual</p>
            <p className="text-sm font-black text-red-400">EXTREMO</p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Viento máx.</p>
            <p className="text-sm font-black text-white">{selectedCell?.wind ?? 142}<span className="text-[10px] text-white/40 ml-0.5">km/h</span></p>
          </div>
          <div className="bg-black/30 rounded border border-purple-500/15 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Prob. tornado</p>
            <p className="text-sm font-black text-purple-300">{selectedCell?.prob ?? 78}<span className="text-[10px] text-white/40 ml-0.5">%</span></p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Nivel alerta</p>
            <p className="text-[11px] font-black text-white leading-tight">{selectedCell?.ef ?? "EF2 – EF3"}<span className="block text-[9px] text-white/35 font-normal">PROBABLE</span></p>
          </div>
        </div>
        {/* EF gradient bar */}
        <div className="flex items-center gap-2 text-[9px] text-white/30 font-mono">
          <span>EF0</span>
          <div className="flex-1 relative h-1.5 rounded-full overflow-hidden">
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #22c55e, #eab308 25%, #f97316 50%, #ef4444 75%, #a855f7)" }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_#fff]" style={{ left: "75%" }} />
          </div>
          <span>EF5</span>
        </div>
      </div>
    </div>
  )
}

function ActionsCard() {
  const actions = [
    { n: "01", text: "Activar alerta civil en zonas rojas y de trayectoria probable." },
    { n: "02", text: "Recomendar refugio interior inmediato a población expuesta." },
    { n: "03", text: "Suspender desplazamientos en corredor de impacto N-E." },
    { n: "04", text: "Priorizar hospitales, escuelas y zonas urbanas cercanas." },
  ]
  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Acciones Inmediatas</span>
        <span className="text-[9px] px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 font-bold uppercase tracking-wide">Prioritario</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {actions.map(({ n, text }) => (
          <div key={n} className="flex gap-3 items-start p-2.5 rounded-lg border border-white/[0.06] bg-black/20">
            <span className="text-[10px] font-black text-cyan-400 font-mono mt-0.5 shrink-0">{n}</span>
            <p className="text-[11px] text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfraCard() {
  const items = [
    { icon: School,    label: "Escuelas en riesgo",   value: "12",     color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    { icon: Building2, label: "Hospitales cercanos",  value: "3",      color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20" },
    { icon: Navigation,label: "Rutas comprometidas",  value: "5",      color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { icon: Users,     label: "Población expuesta",   value: "18,400", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  ]
  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Infraestructura Crítica</span>
        <span className="text-[9px] px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 font-bold uppercase tracking-wide">Expuesta</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${bg}`}>
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${bg}`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <div>
              <p className="text-[9px] text-white/35 leading-tight">{label}</p>
              <p className={`text-base font-black ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineCard() {
  const events = [
    { time: "17:35", title: "Formación de rotación", desc: "Mesociclón confirmado por radar Doppler.", color: "bg-cyan-400 shadow-[0_0_8px_#22d3ee]" },
    { time: "17:48", title: "Riesgo de tornado",     desc: "Descenso de nube embudo probable.",       color: "bg-violet-400 shadow-[0_0_8px_#a78bfa]" },
    { time: "18:05", title: "Impacto probable",      desc: "Zona urbana NE — Ciudad Central.",        color: "bg-red-400 shadow-[0_0_10px_#ef4444]" },
    { time: "18:20", title: "Disipación estimada",   desc: "Pérdida de organización vertical.",       color: "bg-yellow-400 shadow-[0_0_8px_#eab308]", dim: true },
  ]
  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Ruta Probable</span>
        <span className="text-[9px] px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400 font-bold uppercase tracking-wide">Predicción IA</span>
      </div>
      <div className="p-4">
        <div className="relative pl-5">
          <div className="absolute left-[7px] top-3 bottom-3 w-[1px] bg-gradient-to-b from-cyan-400 via-violet-400 to-red-400 opacity-50" />
          <div className="flex flex-col gap-4">
            {events.map(({ time, title, desc, color, dim }) => (
              <div key={time} className={`relative flex flex-col gap-0.5 ${dim ? "opacity-60" : ""}`}>
                <div className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full border-2 border-[#0a0d14] ${color}`} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-white font-mono">{time}</span>
                  <Clock className="w-2.5 h-2.5 text-white/20" />
                </div>
                <p className="text-[11px] font-bold text-white/80">{title}</p>
                <p className="text-[10px] text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
