"use client"

import { Building2 } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"
import { useFireSelection, type SelectedFireData } from "@/contexts/fire-selection-context"
import type { SentinelUpdate, InfrastructurePoint } from "@/hooks/use-socket"

function Label({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div className="sentinel-label">
      <span className="text-foreground">{children}</span>
      <span className="bar opacity-50" />
      {right && <span className="text-blue font-mono tracking-widest">{right}</span>}
    </div>
  )
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

type Tx = ReturnType<typeof useLang>['tx']

function infraColor(type: InfrastructurePoint['type']): string {
  if (type === 'hospital') return 'text-red-soft'
  if (type === 'school') return 'text-blue'
  return 'text-orange'
}

function FireOpsView({ fire, u, tx, onDeselect }: {
  fire: SelectedFireData
  u: SentinelUpdate | null
  tx: Tx
  onDeselect: () => void
}) {
  const infra = u?.infrastructure ?? []
  const nearby = infra
    .map(pt => ({ ...pt, dist: haversineKm(fire.lat, fire.lon, pt.lat, pt.lon) }))
    .filter(pt => pt.dist <= 10)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)

  const evacZones = u?.report?.zonas_evacuacion_prioritaria ?? []
  const resources = u?.report?.recursos_recomendados ?? []
  const routes = u?.naturalRoutes?.rutas ?? []
  const bestRoute = routes
    .filter(r => r.estado !== 'BLOQUEADA')
    .sort((a, b) => a.prioridad - b.prioridad)[0] ?? null

  return (
    <>
      {/* Nearby Infrastructure */}
      <div className="space-y-3">
        <Label>{tx.nearbyInfra}</Label>
        <div className="sentinel-card p-4">
          {nearby.length > 0 ? (
            <div className="space-y-0">
              {nearby.map(pt => (
                <div key={pt.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Building2 className={`w-4 h-4 ${infraColor(pt.type)}`} />
                    <span className="text-[12px] font-semibold text-text-2">{pt.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-text-muted num">{pt.dist.toFixed(1)} km</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-text-muted py-1">{tx.noInfraIn10km}</div>
          )}
        </div>
      </div>

      {/* Priority Evac Zones */}
      {evacZones.length > 0 && (
        <div className="space-y-3">
          <Label>{tx.evacZones}</Label>
          <div className="sentinel-card p-4">
            <div className="flex flex-wrap gap-2">
              {evacZones.slice(0, 4).map((zone, i) => (
                <span key={i} className="px-2 py-1 rounded border border-blue/30 bg-blue/10 text-[10px] font-bold text-blue tracking-wide">
                  {zone}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommended Resources */}
      {resources.length > 0 && (
        <div className="space-y-3">
          <Label>{tx.recommendedRes}</Label>
          <div className="sentinel-card p-4 space-y-2.5">
            {resources.slice(0, 5).map((res, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange mt-[5px] shrink-0 shadow-[0_0_6px_rgba(255,126,21,0.6)]" />
                <span className="text-[12px] text-text-2 leading-relaxed">{res}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Available Route */}
      {bestRoute && (
        <div className="space-y-3">
          <Label>{tx.nearestSafeRoute}</Label>
          <div className="p-4 bg-[linear-gradient(180deg,rgba(52,211,153,0.1),transparent_40%)] bg-surface/60 border border-green/30 rounded-xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-text-2 tracking-tight truncate pr-2">{bestRoute.nombre}</span>
              <span className="px-2 py-0.5 rounded border border-green/40 bg-green/10 text-[9px] font-black text-green-soft tracking-[0.15em] uppercase shrink-0">
                {bestRoute.estado}
              </span>
            </div>
            <div className="text-[11px] text-text-muted mb-3">→ {bestRoute.destino}</div>
            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{tx.estTravel}</span>
              <span className="text-sm font-bold text-foreground num bg-surface px-2 py-0.5 border border-border rounded">
                {bestRoute.tiempo_estimado_min} MIN
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Deselect */}
      <button
        onClick={onDeselect}
        className="w-full text-[10px] font-bold text-text-muted hover:text-foreground tracking-widest uppercase py-2 border border-border rounded-lg hover:border-border-2 transition-colors"
      >
        {tx.backToSituation}
      </button>
    </>
  )
}

function GlobalOpsView({ u, tx }: { u: SentinelUpdate | null; tx: Tx }) {
  const report = u?.report ?? null
  const naturalRoutes = u?.naturalRoutes ?? null
  const primaryRoute = naturalRoutes?.rutas?.[0] ?? null
  const meetingPoint = naturalRoutes?.punto_encuentro_principal ?? null
  const briefingText = report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? null
  const immediateActions = report?.acciones_inmediatas ?? []
  const populationAtRisk = report?.poblacion_en_riesgo_estimada ?? null
  const hasBlockedRoute = naturalRoutes?.rutas?.some(r => r.estado === 'BLOQUEADA') ?? false

  const routeSteps = primaryRoute
    ? [
        primaryRoute.origen,
        ...primaryRoute.instrucciones.split(/[→·,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 2),
        primaryRoute.destino,
      ]
    : []

  return (
    <>
      {/* Social Impact */}
      {populationAtRisk != null && (
        <div className="sentinel-card p-4">
          <div className="mb-3"><Label>{tx.socialImpact}</Label></div>
          <div className="flex items-baseline justify-between py-1">
            <span className="text-sm font-semibold text-text-dim">{tx.populationAtRisk}</span>
            <span className="text-lg font-bold text-red-soft num">{populationAtRisk.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Immediate Actions */}
      {immediateActions.length > 0 && (
        <div className="space-y-3">
          <Label>{tx.immediateActions}</Label>
          <div className="sentinel-card p-4 space-y-2.5">
            {immediateActions.slice(0, 4).map((action, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 flex items-center justify-center border border-orange/40 bg-orange/10 text-[9px] font-black text-orange rounded shrink-0 num">
                  {i + 1}
                </span>
                <span className="text-[12px] text-text-2 leading-relaxed">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escape Routes */}
      {primaryRoute && (
        <div className="space-y-3">
          <Label>{tx.escapeRoutes}</Label>
          <div className="p-4 bg-[linear-gradient(180deg,rgba(52,211,153,0.1),transparent_40%)] bg-surface/60 border border-green/30 rounded-xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-text-2 tracking-tight">{meetingPoint ?? primaryRoute.destino}</span>
              <span className={`px-2 py-0.5 rounded border text-[9px] font-black tracking-[0.15em] uppercase ${
                primaryRoute.estado === 'BLOQUEADA'    ? 'border-red/40 bg-red/10 text-red-soft' :
                primaryRoute.estado === 'CONGESTIONADA' ? 'border-amber/40 bg-amber/10 text-amber' :
                'border-green/40 bg-green/10 text-green-soft'
              }`}>
                {primaryRoute.estado}
              </span>
            </div>
            {routeSteps.length > 0 && (
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
            )}
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{tx.estTravel}</span>
              <span className="text-sm font-bold text-foreground num bg-surface px-2 py-0.5 border border-border rounded">
                {primaryRoute.tiempo_estimado_min} MIN
              </span>
            </div>
          </div>

          {hasBlockedRoute && (
            <div className="flex items-center gap-3 px-4 py-2.5 border border-red/30 bg-red/5 rounded-lg text-red-soft shadow-lg shadow-red/5">
              <div className="w-2 h-2 rounded-full bg-red shadow-[0_0_12px_rgba(255,51,51,1)] animate-blink" />
              <span className="text-[11px] font-black tracking-[0.15em] uppercase">{tx.hwyClosed}</span>
            </div>
          )}
        </div>
      )}

      {/* Official Briefing */}
      {briefingText && (
        <div className="space-y-3">
          <Label>{tx.officialBriefing}</Label>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">{tx.execSummary}</span>
            {u?.timestamp && (
              <span className="text-blue font-mono font-bold text-[10px] uppercase">
                {new Date(u.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
              </span>
            )}
          </div>
          <div className="text-[13.5px] leading-[1.6] text-text-2 p-4 bg-surface/40 border border-border rounded-xl">
            <p>{briefingText}</p>
          </div>
          {report && (
            <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-surface/80 shadow-lg">
              <div className="w-10 h-10 border-2 border-orange/40 rounded-full flex items-center justify-center bg-orange/10 text-[9px] font-black text-orange shadow-[0_0_15px_rgba(255,126,21,0.2)] shrink-0 text-center leading-tight px-1">
                {report.nivel_emergencia}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground truncate">{report.zona_impacto}</div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">{tx.execSummary}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function RightPanel() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()
  const { selectedFire, setSelectedFire } = useFireSelection()

  return (
    <div className="w-80 border-l border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden relative">
      <div className="absolute top-0 -right-20 w-40 h-80 bg-blue/5 blur-[100px] pointer-events-none" />

      <div className="p-[18px] border-b border-border flex items-center bg-surface/30">
        <Label>{selectedFire ? tx.fireOpsIntel : tx.situationalIntel}</Label>
      </div>

      <div className="flex-1 p-[18px] space-y-6 overflow-y-auto scrollbar-none relative z-10">
        {selectedFire ? (
          <FireOpsView
            fire={selectedFire}
            u={u}
            tx={tx}
            onDeselect={() => setSelectedFire(null)}
          />
        ) : (
          <GlobalOpsView u={u} tx={tx} />
        )}
      </div>
    </div>
  )
}
