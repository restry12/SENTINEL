"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import type { Glacier } from "@/lib/glacier-types";
import { GlacierAIPanel } from "./glacier-ai-panel";

const RISK_COLOR: Record<string, string> = {
  Critico: "#ff3b3b",
  "Riesgo Alto": "#ff8a2a",
  Observacion: "#46b8ff",
  Estable: "#1dd38a",
};

function MiniLineChart({ data, color }: { data: number[]; color: string }) {
  const points = (data.length > 0 ? data : [0]).map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.6} dot={false} />
        <Tooltip
          contentStyle={{
            background: "#0a0d14",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            fontSize: 10,
          }}
          labelFormatter={() => ""}
          formatter={(value: number) => [value.toFixed(2), ""]}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatDate(value?: string): string {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

interface Props {
  glacier: Glacier | null;
  open: boolean;
  onClose: () => void;
  analyzing: boolean;
  detailLoading: boolean;
  onAnalyze: (glacier: Glacier) => void;
}

export function GlacierDetailDrawer({ glacier, open, onClose, analyzing, detailLoading, onAnalyze }: Props) {
  const color = glacier ? RISK_COLOR[glacier.cat] ?? "#46b8ff" : "#46b8ff";

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 bottom-0 z-[61] w-[520px] max-w-[92vw] overflow-y-auto border-l border-white/10 bg-[#070a10] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {!glacier ? (
          <div className="p-6 text-[11px] text-white/50">Selecciona un glaciar en el mapa para ver detalle.</div>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#070a10]/95 p-4 backdrop-blur">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                    {glacier.cat}
                  </span>
                  {detailLoading && (
                    <span className="inline-flex items-center gap-1 text-[8px] font-mono text-cyan-200">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                      actualizando
                    </span>
                  )}
                </div>
                <h2 className="mt-1 truncate text-base font-black text-white">{glacier.name}</h2>
                <p className="text-[9px] font-mono text-white/45">
                  {glacier.glimsId} · LAT {glacier.lat.toFixed(4)} / LON {glacier.lon.toFixed(4)}
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-lg leading-none text-white/45 hover:text-white">
                ×
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Area GLIMS", value: `${glacier.area.toFixed(3)} km2` },
                  { label: "Riesgo", value: `${glacier.riesgo}/100`, style: { color } },
                  {
                    label: "Anomalia temp.",
                    value: Number.isFinite(glacier.tempAnomaly) ? `${glacier.tempAnomaly > 0 ? "+" : ""}${glacier.tempAnomaly.toFixed(2)} C` : "N/D",
                    style: { color: "#ff9a3d" },
                  },
                  { label: "Tendencia", value: glacier.trend },
                  { label: "Fecha observacion", value: formatDate(glacier.srcDate) },
                  { label: "Fecha release", value: formatDate(glacier.lastReleaseDate) },
                ].map((item) => (
                  <div key={item.label} className="rounded border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="mb-1 text-[8px] font-bold uppercase text-white/35">{item.label}</p>
                    <p className="text-sm font-bold leading-tight text-white" style={item.style}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {[
                { title: "Serie temperatura (12m)", data: glacier.tempHistory, color: "#ff9a3d" },
                { title: "Serie area relativa", data: glacier.areaHistory, color: "#46b8ff" },
                { title: "Serie masa estimada", data: glacier.massHistory, color: "#ff5a5a" },
              ].map((chart) => (
                <div key={chart.title}>
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/40">{chart.title}</p>
                  <div className="overflow-hidden rounded border border-white/10 bg-white/[0.03]">
                    <MiniLineChart data={chart.data} color={chart.color} />
                  </div>
                </div>
              ))}

              <GlacierAIPanel glacier={glacier} analyzing={analyzing} onAnalyze={onAnalyze} embedded />
            </div>
          </>
        )}
      </aside>
    </>
  );
}
