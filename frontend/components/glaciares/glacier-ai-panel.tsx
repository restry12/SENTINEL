"use client";

import type { Glacier } from "@/lib/glacier-types";

const URGENCY_CLASS: Record<string, string> = {
  CRITICA: "text-red-300 border-red-400/40 bg-red-500/15",
  ALTA: "text-orange-300 border-orange-400/40 bg-orange-500/15",
  MEDIA: "text-cyan-300 border-cyan-400/40 bg-cyan-500/15",
  BAJA: "text-emerald-300 border-emerald-400/40 bg-emerald-500/15",
};

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

        <ActionPlan riesgo={glacier.riesgo} />
      </div>
    </div>
  );
}
