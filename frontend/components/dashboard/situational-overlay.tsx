"use client"

import { Users, Map as MapIcon, Info, Building2, ShieldAlert } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"
import { useFireSelection } from "@/contexts/fire-selection-context"
import { CollapsibleWidget } from "./widget"

export function SituationalOverlay() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()
  const { selectedFire } = useFireSelection()

  // Hide overlay when a fire is selected to give full focus to the map circles and popup
  if (selectedFire) return null

  const report = u?.report ?? null
  const naturalRoutes = u?.naturalRoutes ?? null
  const briefingText = report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? null
  const immediateActions = report?.acciones_inmediatas ?? []
  const populationAtRisk = report?.poblacion_en_riesgo_estimada ?? null
  const evacZones = report?.zonas_evacuacion_prioritaria ?? []
  
  const primaryRoute = naturalRoutes?.rutas?.[0] ?? null
  const meetingPoint = naturalRoutes?.punto_encuentro_principal ?? null

  return (
    <div className="absolute top-24 bottom-8 right-6 z-40 w-80 pointer-events-none flex flex-col items-end">
      <div className="flex-1 overflow-y-auto pl-3 scrollbar-none pointer-events-auto flex flex-col gap-3 items-end pb-4">
        
        {/* Social Impact Widget */}
        {populationAtRisk != null && (
          <CollapsibleWidget title={tx.socialImpact} icon={<Users className="w-3.5 h-3.5" />} className="w-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-dim">{tx.populationAtRisk}</span>
              <span className="text-xl font-black text-red-soft num">{populationAtRisk.toLocaleString()}</span>
            </div>
          </CollapsibleWidget>
        )}

        {/* Immediate Actions Widget */}
        {immediateActions.length > 0 && (
          <CollapsibleWidget title={tx.immediateActions} icon={<ShieldAlert className="w-3.5 h-3.5" />} defaultOpen={!selectedFire} className="w-full">
            <div className="space-y-2.5">
              {immediateActions.slice(0, 3).map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-4 h-4 flex items-center justify-center border border-orange/40 bg-orange/10 text-[8px] font-black text-orange rounded shrink-0 num">
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-text-2 leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </CollapsibleWidget>
        )}

        {/* Escape Routes Widget */}
        {primaryRoute && (
          <CollapsibleWidget title={tx.escapeRoutes} icon={<MapIcon className="w-3.5 h-3.5" />} defaultOpen={!selectedFire} className="w-full">
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-text-2 truncate pr-2">{meetingPoint ?? primaryRoute.destino}</span>
                <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black tracking-widest uppercase ${
                  primaryRoute.estado === 'BLOQUEADA' ? 'border-red/40 bg-red/10 text-red-soft' : 'border-green/40 bg-green/10 text-green-soft'
                }`}>
                  {primaryRoute.estado}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{tx.estTravel}</span>
                <span className="text-xs font-bold text-white num">{primaryRoute.tiempo_estimado_min} MIN</span>
              </div>
            </div>
          </CollapsibleWidget>
        )}

        {/* Evacuation Zones Widget */}
        {evacZones.length > 0 && (
          <CollapsibleWidget title={tx.evacZones} icon={<Building2 className="w-3.5 h-3.5" />} defaultOpen={false} className="w-full">
            <div className="flex flex-wrap gap-2">
              {evacZones.map((zone, i) => (
                <span key={i} className="px-2 py-1 rounded border border-blue/30 bg-blue/10 text-[9px] font-bold text-blue tracking-wide">
                  {zone}
                </span>
              ))}
            </div>
          </CollapsibleWidget>
        )}

        {/* Official Briefing Widget */}
        {briefingText && (
          <CollapsibleWidget title={tx.officialBriefing} icon={<Info className="w-3.5 h-3.5" />} defaultOpen={false} className="w-full">
            <div className="text-[11px] leading-relaxed text-text-2 italic opacity-80">
              "{briefingText.length > 200 ? briefingText.substring(0, 200) + "..." : briefingText}"
            </div>
          </CollapsibleWidget>
        )}
      </div>
    </div>
  )
}
