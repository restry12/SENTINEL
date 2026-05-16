"use client"

import { Route } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"

export function SafeRoute() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()
  const r = u?.naturalRoutes?.rutas?.[0] ?? null
  const steps = r ? [r.origen, r.destino] : []
  const travelTime = r ? `${r.tiempo_estimado_min} MIN` : "—"
  const routeBlocked = (u?.naturalRoutes?.rutas ?? []).some((x) => x.estado === "BLOQUEADA")
  return (
    <div className="sentinel-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-green-soft">
          <Route className="h-3 w-3" />
          <span>{tx.safeRoute}</span>
        </div>
        {routeBlocked && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-1.5 h-1.5 rounded-full bg-red shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-blink" />
            <span className="text-[9px] font-bold text-red-soft uppercase tracking-wider">{tx.hwyClosed}</span>
          </div>
        )}
      </div>
      
      <div className="p-4 bg-green/5 border border-green/20 rounded-md">
        {steps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-text-2">
            {steps.map((s, i) => (
              <span key={i} className="flex items-center gap-x-3">
                {i > 0 && <span className="text-text-muted">→</span>}
                <span>{s}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-text-muted uppercase tracking-wider">{tx.noRouteData}</div>
        )}
        <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          <span>{tx.estTravelTime}</span>
          <span className="text-sm font-medium text-foreground num">{travelTime}</span>
        </div>
      </div>
    </div>
  )
}
