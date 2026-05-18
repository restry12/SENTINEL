'use client'

import type { Glacier } from '@/lib/glacier-types'

const URGENCY_CONFIG = {
  'CRÍTICA': { color: '#ff3333', cls: 'text-red border-red/30 bg-red/10' },
  'ALTA':    { color: '#f97316', cls: 'text-orange border-orange/30 bg-orange/10' },
  'MEDIA':   { color: '#38bdf8', cls: 'text-blue border-blue/30 bg-blue/10' },
  'BAJA':    { color: '#10b981', cls: 'text-green border-green/30 bg-green/10' },
} as const

function ActionPlan({ riesgo }: { riesgo: number }) {
  const { level, cls, items } = riesgo >= 76
    ? { level: 'P0 · CRÍTICO', cls: 'text-red', items: [
        'Activar alerta técnica regional',
        'Generar informe para gobierno regional',
        'Evaluar impacto en agua potable y ecosistemas',
        'Priorizar monitoreo satelital semanal',
      ]}
    : riesgo >= 51
    ? { level: 'P1 · ALTO', cls: 'text-orange', items: [
        'Alertar a autoridad territorial competente',
        'Evaluar seguridad hídrica de la cuenca',
        'Priorizar análisis hidrológico',
        'Revisar actividades industriales cercanas',
      ]}
    : riesgo >= 26
    ? { level: 'P2 · MEDIO', cls: 'text-blue', items: [
        'Aumentar frecuencia de monitoreo',
        'Revisar dependencia hídrica local',
        'Comparar con líneas base históricas',
      ]}
    : { level: 'P3 · BAJO', cls: 'text-green', items: [
        'Mantener monitoreo mensual',
        'Actualizar línea base anual',
        'Revisar variación estacional',
      ]}

  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Plan de Acción</p>
        <span className={`text-[9px] font-black uppercase tracking-wider ${cls}`}>{level}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/30 shrink-0 mt-0.5">{String(i+1).padStart(2,'0')}</span>
          <span className="text-[10px] text-white/70 leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  glacier: Glacier | null
  analyzing: boolean
  onAnalyze: (g: Glacier) => void
}

export function GlacierAIPanel({ glacier: g, analyzing, onAnalyze }: Props) {
  if (!g) return (
    <div className="absolute top-6 right-6 z-40 w-72 bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 text-white/30 text-[10px] font-mono">
      Seleccioná un glaciar para ver el análisis
    </div>
  )

  return (
    <div className="absolute top-6 right-6 z-40 w-72 max-h-[calc(100vh-360px)] overflow-y-auto scrollbar-none pointer-events-auto">
      <div className="flex flex-col gap-3 pb-4">
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Inteligencia Glaciar IA</p>
            <span className="text-[9px] font-mono text-white/30">v3.1 · LIVE</span>
          </div>

          {g.ai ? (
            <>
              <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Diagnóstico</p>
              <p className="text-[10px] text-white/70 leading-relaxed mb-3">{g.ai.diag}</p>

              <div className="flex items-center justify-between py-2 border-t border-b border-white/5 mb-3">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Nivel de Urgencia</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${URGENCY_CONFIG[g.ai.urgency].cls}`}>
                  {g.ai.urgency}
                </span>
              </div>

              <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Impacto Hídrico</p>
              <p className="text-[10px] text-white/70 leading-relaxed mb-3">{g.ai.impact}</p>

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div>
                  <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Rec. Técnica</p>
                  <p className="text-[10px] text-white/60 leading-relaxed">{g.ai.recT}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-blue uppercase tracking-wider mb-1">Rec. Territorial</p>
                  <p className="text-[10px] text-white/60 leading-relaxed">{g.ai.recR}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              {analyzing ? (
                <>
                  <div className="w-6 h-6 border-2 border-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[9px] font-mono text-white/40">Generando análisis…</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-white/40 text-center">Análisis IA no generado para este glaciar</p>
                  <button
                    onClick={() => onAnalyze(g)}
                    className="px-4 py-2 rounded-md bg-blue/10 border border-blue/30 text-[10px] font-black tracking-widest text-blue uppercase hover:bg-blue/20 transition-colors"
                  >
                    ANALIZAR →
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <ActionPlan riesgo={g.riesgo} />
      </div>
    </div>
  )
}
