"use client"

import { Users, Route, FileText } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"

function Label({ children, right }: { children: React.ReactNode, right?: string }) {
  return (
    <div className="sentinel-label">
      <span className="text-foreground">{children}</span>
      <span className="bar opacity-50" />
      {right && <span className="text-blue font-mono tracking-widest">{right}</span>}
    </div>
  )
}

export function RightPanel() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()

  const report = u?.report ?? null
  const natural = u?.naturalRoutes ?? null
  const populationAtRisk = report?.poblacion_en_riesgo_estimada ?? null
  const primaryRoute = natural?.rutas?.[0] ?? null
  const routeSteps = primaryRoute
    ? [primaryRoute.origen, ...primaryRoute.instrucciones.split(/[→·,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 2), primaryRoute.destino]
    : ["Oak Valley Rd", "Interstate 42 N", "Exit 17B", "Lincoln High School"]
  const meetingPoint = natural?.punto_encuentro_principal ?? "PRIMARY: LINCOLN HUB"
  const briefingText = report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? null

  return (
    <div className="w-80 border-l border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden relative">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 -right-20 w-40 h-80 bg-blue/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="p-[18px] border-b border-border flex items-center bg-surface/30">
        <Label>{tx.situationalIntel}</Label>
      </div>

      {/* Content */}
      <div className="flex-1 p-[18px] space-y-6 overflow-y-auto scrollbar-none relative z-10">
        {/* Social Impact */}
        <div className="sentinel-card p-4">
          <div className="mb-4">
            <Label>{tx.socialImpact}</Label>
          </div>
          <div className="space-y-0">
            {[
              { k: tx.populationAtRisk, v: populationAtRisk != null ? populationAtRisk.toLocaleString() : "—", color: "text-red-soft" },
              { k: tx.evacuated, v: "—", color: "text-green-soft" },
              { k: tx.inShelters, v: "—", color: "text-blue" },
            ].map((item) => (
              <div key={item.k} className="flex items-baseline justify-between py-2.5 border-b border-white/5 last:border-0">
                <span className="text-sm font-semibold text-text-dim">{item.k}</span>
                <span className={`text-lg font-bold ${item.color} num`}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Safe Routes */}
        <div className="space-y-4">
          <Label>{tx.escapeRoutes}</Label>
          <div className="p-4 bg-[linear-gradient(180deg,rgba(52,211,153,0.1),transparent_40%)] bg-surface/60 border border-green/30 rounded-xl shadow-[0_10px_25px_-10px_rgba(16,185,129,0.15)] backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-text-2 tracking-tight">{meetingPoint}</span>
              <span className="px-2 py-0.5 rounded border border-green/40 bg-green/10 text-[9px] font-black text-green-soft tracking-[0.15em] uppercase">
                {tx.routeActive}
              </span>
            </div>
            <div className="space-y-2">
              {routeSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 flex items-center justify-center border border-green/40 bg-green/10 text-[10px] font-black text-green-soft rounded num">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-text-2">{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{tx.estTravel}</span>
              <span className="text-sm font-bold text-foreground num bg-surface px-2 py-0.5 border border-border rounded">
                {primaryRoute?.tiempo_estimado_min != null
                  ? `${primaryRoute.tiempo_estimado_min} MIN`
                  : "— MIN"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5 border border-red/30 bg-red/5 rounded-lg text-red-soft shadow-lg shadow-red/5">
            <div className="w-2 h-2 rounded-full bg-red shadow-[0_0_12px_rgba(255,51,51,1)] animate-blink" />
            <span className="text-[11px] font-black tracking-[0.15em] uppercase">{tx.hwyClosed}</span>
          </div>
        </div>

        {/* Municipal Briefing */}
        <div className="space-y-4">
          <Label>{tx.officialBriefing}</Label>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">{tx.execSummary}</span>
          </div>
          <div className="text-[13.5px] leading-[1.6] text-text-2 p-4 bg-surface/40 border border-border rounded-xl">
            {briefingText ? (
              <p>{briefingText}</p>
            ) : (
              <p>
                The <span className="text-orange font-bold drop-shadow-[0_0_8px_rgba(255,126,21,0.3)]">Cedar Ridge Fire</span> expanded to
                <span className="text-foreground font-bold"> 12,400 acres</span>.
                {tx.containment} <span className="text-red-soft font-bold">8%</span>. {tx.windNote}
              </p>
            )}
            {report?.nivel_emergencia && (
              <div className="mt-2 text-[10px] font-bold text-orange-soft uppercase tracking-widest">
                {report.nivel_emergencia}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
