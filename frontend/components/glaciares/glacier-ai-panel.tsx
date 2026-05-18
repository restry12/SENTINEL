"use client";

import type { Glacier, GlacierForecast, Trajectory } from "@/lib/glacier-types";

const URGENCY_CLASS: Record<string, string> = {
  CRITICA: "text-red-300 border-red-400/40 bg-red-500/15",
  ALTA: "text-orange-300 border-orange-400/40 bg-orange-500/15",
  MEDIA: "text-cyan-300 border-cyan-400/40 bg-cyan-500/15",
  BAJA: "text-emerald-300 border-emerald-400/40 bg-emerald-500/15",
};

const TRAJECTORY_COLOR: Record<Trajectory, string> = {
  "Crecimiento": "#1dd38a",
  "Estable": "#46b8ff",
  "Retroceso lento": "#ff9a3d",
  "Retroceso acelerado": "#ff5a5a",
  "Colapso": "#ff2d2d",
};

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatMass(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} m EH`;
}

function ForecastBlock({ forecast }: { forecast: GlacierForecast }) {
  const color = TRAJECTORY_COLOR[forecast.trajectory] ?? "#46b8ff";
  const horizons = [
    { label: "6 meses", point: forecast.horizon6m },
    { label: "12 meses", point: forecast.horizon12m },
    { label: "24 meses", point: forecast.horizon24m },
  ];

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d14]/90 p-3.5 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">Pronostico IA</p>
        <span
          className="rounded border px-2 py-0.5 text-[9px] font-black uppercase"
          style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}
        >
          {forecast.trajectory}
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[8px] font-mono uppercase tracking-widest text-white/40">
          <span>Confianza</span>
          <span>{forecast.confidence}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${forecast.confidence}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {horizons.map((h) => {
          const areaColor = h.point.areaPctChange >= 0 ? "#1dd38a" : "#ff8a2a";
          const massColor = h.point.massBalance >= 0 ? "#1dd38a" : "#ff5a5a";
          return (
            <div key={h.label} className="rounded border border-white/10 bg-white/[0.03] p-2">
              <p className="text-[7px] font-bold uppercase tracking-widest text-white/35">{h.label}</p>
              <p className="mt-0.5 text-[10px] font-black" style={{ color: areaColor }}>
                {formatPct(h.point.areaPctChange)}
              </p>
              <p className="text-[8px] font-mono leading-tight" style={{ color: massColor }}>
                {formatMass(h.point.massBalance)}
              </p>
            </div>
          );
        })}
      </div>

      {forecast.rationale && (
        <>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Razonamiento</p>
          <p className="text-[10px] leading-relaxed text-white/70">{forecast.rationale}</p>
        </>
      )}
    </div>
  );
}

function ActionPlan({ riesgo }: { riesgo: number }) {
  const items =
    riesgo >= 76
      ? [
          "Activar alerta tecnica regional",
          "Solicitar inspeccion satelital de alta frecuencia",
          "Evaluar efectos hidricos para consumo humano",
        ]
      : riesgo >= 51
      ? [
          "Mantener vigilancia semanal",
          "Cruzar resultados con datos de cuenca",
          "Preparar informe preventivo para autoridad local",
        ]
      : riesgo >= 26
      ? ["Mantener monitoreo quincenal", "Comparar con serie historica disponible"]
      : ["Monitoreo mensual y control de calidad de datos"];

  return (
    <div className="rounded-lg border border-white/10 bg-[#0a0d14]/90 p-3.5 shadow-2xl backdrop-blur-xl">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/45">Plan de accion</p>
      {items.map((item, index) => (
        <div key={item} className="flex items-start gap-2 border-t border-white/8 py-2 first:border-t-0 first:pt-0">
          <span className="mt-0.5 shrink-0 text-[9px] font-mono text-white/30">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-[10px] leading-relaxed text-white/70">{item}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  glacier: Glacier | null;
  analyzing: boolean;
  onAnalyze: (glacier: Glacier) => void;
  embedded?: boolean;
}

export function GlacierAIPanel({ glacier, analyzing, onAnalyze, embedded = false }: Props) {
  if (!glacier) {
    return (
      <div
        className={`${
          embedded ? "relative w-full" : "absolute top-6 right-6 z-40 w-72"
        } rounded-lg border border-white/10 bg-[#0a0d14]/90 p-4 text-[10px] font-mono text-white/35`}
      >
        Selecciona un glaciar para ver analisis IA.
      </div>
    );
  }

  return (
    <div
      className={`${
        embedded ? "relative w-full max-h-none" : "absolute right-5 top-5 z-40 w-[19rem] max-h-[calc(100vh-13rem)]"
      } overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      <div className="flex flex-col gap-2 pb-3">
        <div className="rounded-lg border border-white/10 bg-[#0a0d14]/90 p-3.5 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">Inteligencia IA</p>
            <span className="text-[9px] font-mono text-white/30">LIVE</span>
          </div>

          {glacier.ai ? (
            <>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Diagnostico</p>
              <p className="mb-3 text-[10px] leading-relaxed text-white/75">{glacier.ai.diag}</p>

              <div className="mb-3 flex items-center justify-between border-y border-white/8 py-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/45">Urgencia</span>
                <span
                  className={`rounded border px-2 py-0.5 text-[9px] font-black uppercase ${
                    URGENCY_CLASS[glacier.ai.urgency] ?? URGENCY_CLASS.MEDIA
                  }`}
                >
                  {glacier.ai.urgency}
                </span>
              </div>

              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Impacto hidrico</p>
              <p className="mb-3 text-[10px] leading-relaxed text-white/75">{glacier.ai.impact}</p>

              <div className="space-y-2 border-t border-white/8 pt-3">
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Recomendacion tecnica</p>
                  <p className="text-[10px] leading-relaxed text-white/65">{glacier.ai.recT}</p>
                </div>
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">Recomendacion territorial</p>
                  <p className="text-[10px] leading-relaxed text-white/65">{glacier.ai.recR}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-5">
              {analyzing ? (
                <>
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  <p className="text-[9px] font-mono text-white/45">Generando analisis...</p>
                </>
              ) : (
                <>
                  <p className="text-center text-[10px] text-white/45">Aun no hay analisis IA para este glaciar.</p>
                  <button
                    onClick={() => onAnalyze(glacier)}
                    className="rounded-md border border-cyan-400/35 bg-cyan-500/12 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Analizar
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {glacier.ai?.forecast && <ForecastBlock forecast={glacier.ai.forecast} />}

        <ActionPlan riesgo={glacier.riesgo} />
      </div>
    </div>
  );
}
