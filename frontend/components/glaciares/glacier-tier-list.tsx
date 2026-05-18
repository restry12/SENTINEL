"use client";

import { useMemo, useState } from "react";
import type { Glacier } from "@/lib/glacier-types";
import { useGlacierTierList } from "@/hooks/use-glacier-tier-list";

const TABS = [
  { id: "risk", label: "Riesgo", color: "#ff5a5a" },
  { id: "area", label: "Tamano", color: "#1dd38a" },
  { id: "retreat", label: "Retroceso", color: "#ff9a3d" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const RISK_COLOR: Record<string, string> = {
  Critico: "#ff3b3b",
  "Riesgo Alto": "#ff8a2a",
  Observacion: "#46b8ff",
  Estable: "#1dd38a",
};

interface Props {
  onSelect: (glacier: Glacier) => void;
  selectedId?: string;
}

export function GlacierTierList({ onSelect, selectedId }: Props) {
  const { data, loading, error } = useGlacierTierList();
  const [tab, setTab] = useState<TabId>("risk");
  const [collapsed, setCollapsed] = useState(false);

  const list = useMemo(() => {
    if (!data) return [];
    if (tab === "risk") return data.byRisk;
    if (tab === "area") return data.byArea;
    return data.byRetreat;
  }, [data, tab]);

  return (
    <div className="pointer-events-auto w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-lg border border-white/10 bg-[#0a0d14]/92 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-200">Tier List Global</span>
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[9px] font-mono uppercase tracking-widest text-white/45 hover:text-white/80"
        >
          {collapsed ? "Mostrar" : "Ocultar"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="flex gap-1 border-b border-white/10 px-3 py-2">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    active
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/10 bg-transparent text-white/45 hover:text-white/75"
                  }`}
                  style={active ? { color: t.color, borderColor: `${t.color}55`, backgroundColor: `${t.color}1a` } : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[24rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading && (
              <div className="flex flex-col items-center gap-2 px-4 py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                <p className="text-[9px] font-mono text-white/45">Calculando ranking global...</p>
              </div>
            )}
            {error && !loading && (
              <p className="px-4 py-4 text-[9px] font-mono text-red-300">{error}</p>
            )}
            {!loading && !error && list.length === 0 && (
              <p className="px-4 py-4 text-[9px] font-mono text-white/45">Sin datos en este tier.</p>
            )}
            {!loading && list.map((glacier, index) => {
              const color = RISK_COLOR[glacier.cat] ?? "#46b8ff";
              const isSelected = selectedId === glacier.id;
              const primaryMetric =
                tab === "area" ? `${glacier.area.toFixed(1)} km^2`
                : tab === "risk" ? `${glacier.riesgo}/100`
                : glacier.srcDate ? glacier.srcDate.slice(0, 10) : "N/D";
              const primaryLabel = tab === "area" ? "Area" : tab === "risk" ? "Riesgo" : "Ultima obs";

              return (
                <button
                  key={glacier.id}
                  onClick={() => onSelect(glacier)}
                  className={`flex w-full items-center gap-2 border-b border-white/8 px-3 py-2 text-left transition-colors last:border-b-0 ${
                    isSelected ? "bg-cyan-500/12" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="w-5 shrink-0 text-[9px] font-mono text-white/35">{String(index + 1).padStart(2, "0")}</span>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold text-white">{glacier.name}</p>
                    <p className="truncate text-[8px] font-mono text-white/35">{glacier.glimsId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] uppercase tracking-wider text-white/35">{primaryLabel}</p>
                    <p className="text-[10px] font-black" style={{ color }}>{primaryMetric}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {data && !loading && (
            <div className="border-t border-white/10 px-3 py-2 text-[8px] font-mono uppercase tracking-widest text-white/35">
              Universo: {data.total.toLocaleString()} glaciares GLIMS
            </div>
          )}
        </>
      )}
    </div>
  );
}
