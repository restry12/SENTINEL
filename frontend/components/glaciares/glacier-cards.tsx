"use client";

import type { Glacier } from "@/lib/glacier-types";

const RISK_COLOR: Record<string, string> = {
  Critico: "#ff3b3b",
  "Riesgo Alto": "#ff8a2a",
  Observacion: "#46b8ff",
  Estable: "#1dd38a",
};

interface Props {
  glaciers: Glacier[];
  selected: Glacier | null;
  onSelect: (glacier: Glacier) => void;
  onAnalyze: (glacier: Glacier) => void;
  onOpenDetail: (glacier: Glacier) => void;
}

export function GlacierCards({ glaciers, selected, onSelect, onAnalyze, onOpenDetail }: Props) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d14]/88 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/45">Glaciares en vista</span>
        <span className="text-[9px] font-mono text-white/35">{glaciers.length} REGISTROS</span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {glaciers.map((glacier, index) => {
          const color = RISK_COLOR[glacier.cat] ?? "#46b8ff";
          const isSelected = selected?.glimsId === glacier.glimsId;

          return (
            <div
              key={`${glacier.glimsId}-${glacier.lat.toFixed(4)}-${glacier.lon.toFixed(4)}-${index}`}
              onClick={() => onSelect(glacier)}
              className={`shrink-0 w-52 rounded-lg border p-2.5 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "border-cyan-300/35 bg-cyan-500/8"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold text-white">{glacier.name}</p>
                  <p className="truncate text-[8px] font-mono text-white/40">{glacier.glimsId}</p>
                </div>
                <span
                  className="shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-black uppercase"
                  style={{ color, borderColor: `${color}66`, backgroundColor: `${color}18` }}
                >
                  {glacier.cat === "Riesgo Alto" ? "ALTO" : glacier.cat.toUpperCase()}
                </span>
              </div>

              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[7px] uppercase text-white/35">Area</p>
                  <p className="text-[10px] font-semibold text-white">{glacier.area.toFixed(2)} km2</p>
                </div>
                <div>
                  <p className="text-[7px] uppercase text-white/35">Riesgo</p>
                  <p className="text-[10px] font-semibold" style={{ color }}>
                    {glacier.riesgo}/100
                  </p>
                </div>
              </div>

              <div className="mb-2">
                <p className="text-[7px] uppercase text-white/35">Fecha observacion</p>
                <p className="truncate text-[9px] font-mono text-white/65">{glacier.srcDate ?? "N/D"}</p>
              </div>

              <div className="grid grid-cols-2 gap-1 border-t border-white/10 pt-2">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDetail(glacier);
                  }}
                  className="rounded border border-white/15 py-1 text-[8px] font-black uppercase tracking-wider text-white/60 hover:bg-white/5"
                >
                  Detalle
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onAnalyze(glacier);
                  }}
                  className="rounded border py-1 text-[8px] font-black uppercase tracking-wider"
                  style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}
                >
                  Analizar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
