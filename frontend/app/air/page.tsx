"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"
import {
  aqiInfo, computeThreatLevel,
  type EnvData, type FirePoint, type InfrastructurePoint,
} from "@/components/air/types"
import { SmokeAlert }       from "@/components/air/smoke-alert"
import { AQIOverlay }       from "@/components/air/aqi-overlay"
import { EnvStatus }        from "@/components/air/env-status"
import { AQILegend }        from "@/components/air/aqi-legend"
import { ThreatIndicator }  from "@/components/air/threat-indicator"
import { ActionPlan }       from "@/components/air/action-plan"
import { AIBriefing }       from "@/components/air/ai-briefing"
import { IncidentTimeline } from "@/components/air/incident-timeline"
import { AuthGuard } from "@/components/auth-guard"
import { TopBar } from "@/components/dashboard/top-bar"
import { CollapsibleWidget } from "@/components/dashboard/widget"
import { Activity, Wind, Droplets, Thermometer, Eye, MessageSquare, AlertTriangle, Info, ShieldAlert } from "lucide-react"

const AirMap = dynamic(
  () => import("@/components/air/air-map").then(m => m.AirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function AirPage() {
  return (
    <AuthGuard>
      <AirPageInner />
    </AuthGuard>
  )
}

function AirPageInner() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()

  // Real env from weather data (speed is m/s → km/h)
  const liveEnv: EnvData = {
    wind:         { speed: u ? Math.round(u.weather.speed * 3.6) : 0, fromDeg: u?.weather.deg ?? 0 },
    humidity:     u?.weather.humidity ?? 0,
    tempC:        u?.weather.temp ?? 0,
    visibilityKm: u?.weather.visibility != null ? Math.round(u.weather.visibility / 100) / 10 : null,
  }

  // Real fires from NASA FIRMS data (FireData uses .lon, FirePoint uses .lng)
  const liveFires: FirePoint[] = (u?.fires ?? []).map((f, i) => ({
    id:        `fire-${i}`,
    lat:       f.lat,
    lng:       f.lon,
    intensity: Math.min(1, f.frp / 100),
    name:      `SRC-${String(i + 1).padStart(3, "0")}`,
  }))

  // Real AQI directly from airQuality data (not computed from fires)
  const rawAQI  = u?.airQuality.aqi ?? 0
  const aqiData = useMemo(
    () => aqiInfo(rawAQI, u?.report?.poblacion_en_riesgo_estimada ?? 0),
    [rawAQI, u]
  )
  const threat = useMemo(() => computeThreatLevel(rawAQI), [rawAQI])

  // Real action items from authority report
  const liveActions = u?.report?.acciones_inmediatas ?? null

  // Real briefing text
  const liveBriefing = u?.report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? u?.airAlerts?.resumen_general ?? null

  // Real alerts for timeline
  const liveAlerts = u?.airAlerts?.alertas ?? null

  // Infrastructure — comes from the backend; empty until Make.com sends it
  const liveInfra: InfrastructurePoint[] = (u?.infrastructure ?? []).map(p => ({
    id: p.id, name: p.name, lat: p.lat, lng: p.lon, type: p.type,
  }))

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-threat={threat}>
      <TopBar />
      
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AirMap wind={liveEnv.wind} fires={liveFires} infrastructure={liveInfra} />
        <SmokeAlert wind={liveEnv.wind} sourceCount={liveFires.length} />

        {/* --- LEFT HUD (Environmental Status) --- */}
        <div className="absolute top-6 left-6 z-40 w-80 pointer-events-none flex flex-col gap-3 h-[calc(100vh-120px)]">
          <div className="flex-1 overflow-y-auto pr-3 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
            
            {/* AQI Primary Widget */}
            <div className="w-full bg-[#0a0b0e/90] backdrop-blur-xl border border-white/20 rounded-lg p-5 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <Activity className="w-12 h-12 text-blue-soft" />
               </div>
               
               <div className="flex items-center gap-2 mb-4">
                 <Activity className="w-3.5 h-3.5 text-text-muted" />
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{tx.airQualityIndex}</span>
               </div>

               <div className="flex items-baseline justify-between mb-4">
                 <div className="flex items-baseline gap-2">
                   <span className="text-5xl font-black tracking-tighter text-white num leading-none">{rawAQI}</span>
                   <span className="text-xs font-bold text-text-muted font-mono tracking-widest uppercase">AQI</span>
                 </div>
                 <div className={`px-2.5 py-1 rounded text-[9px] font-black tracking-widest uppercase border ${
                   threat === 'critical' ? 'text-red border-red/40 bg-red/10' :
                   threat === 'high' ? 'text-orange border-orange/40 bg-orange/10' :
                   threat === 'moderate' ? 'text-amber border-amber/40 bg-amber/10' :
                   'text-green-soft border-green/40 bg-green/10'
                 }`}>
                   {aqiData.label}
                 </div>
               </div>

               <div className="space-y-3">
                 <div className="h-1.5 rounded-full bg-white/5 relative overflow-hidden">
                   <div 
                     className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#10b981,#fbbf24,#f97316,#ef4444)] transition-all duration-1000"
                     style={{ width: `${Math.min(100, (rawAQI / 300) * 100)}%` }}
                   />
                 </div>
                 <div className="flex justify-between text-[9px] font-bold text-text-dim uppercase tracking-wider">
                   <span>{tx.populationAtRisk}</span>
                   <span className="text-white num">{aqiData.riskPop?.toLocaleString() ?? '0'}</span>
                 </div>
               </div>
            </div>

            {/* Weather Metrics Widget */}
            <CollapsibleWidget title={tx.windConditions} icon={<Wind className="w-3.5 h-3.5" />} className="w-full">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <Wind className="w-4 h-4 text-blue-soft" />
                       <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{tx.wind}</span>
                          <span className="text-lg font-black text-white num leading-none">{liveEnv.wind.speed}<span className="text-[10px] font-sans text-text-dim ml-1">KM/H</span></span>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Droplets className="w-4 h-4 text-blue-soft" />
                       <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{tx.humidity}</span>
                          <span className="text-lg font-black text-white num leading-none">{liveEnv.humidity}<span className="text-[10px] font-sans text-text-dim ml-1">%</span></span>
                       </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <Thermometer className="w-4 h-4 text-orange-soft" />
                       <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{tx.temperature}</span>
                          <span className="text-lg font-black text-white num leading-none">{liveEnv.tempC}<span className="text-[10px] font-sans text-text-dim ml-1">°C</span></span>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Eye className="w-4 h-4 text-text-muted" />
                       <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{tx.visibility}</span>
                          <span className="text-lg font-black text-white num leading-none">{liveEnv.visibilityKm ?? '—'}<span className="text-[10px] font-sans text-text-dim ml-1">KM</span></span>
                       </div>
                    </div>
                  </div>
               </div>
            </CollapsibleWidget>

            {/* AQI Legend Widget */}
            <CollapsibleWidget title={tx.aqiScale} icon={<Info className="w-3.5 h-3.5" />} defaultOpen={false} className="w-full">
               <div className="space-y-2">
                 {[
                   { label: '0-50',   color: 'bg-green-500',  text: 'Excelente' },
                   { label: '51-100', color: 'bg-yellow-500', text: 'Moderado' },
                   { label: '101-150', color: 'bg-orange-500', text: 'Insalubre (Sensible)' },
                   { label: '151-200', color: 'bg-red-500',    text: 'Insalubre' },
                   { label: '201+',   color: 'bg-purple-600', text: 'Peligroso' },
                 ].map((item) => (
                   <div key={item.label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                     <div className="flex items-center gap-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                       <span className="text-[10px] font-medium text-text-2">{item.text}</span>
                     </div>
                     <span className="text-[10px] font-mono text-text-muted">{item.label}</span>
                   </div>
                 ))}
               </div>
            </CollapsibleWidget>
          </div>
        </div>

        {/* --- RIGHT HUD (AI Insights & Intelligence) --- */}
        <div className="absolute top-6 right-6 z-40 w-80 pointer-events-none flex flex-col items-end h-[calc(100vh-120px)]">
          <div className="flex-1 overflow-y-auto pl-3 scrollbar-none pointer-events-auto flex flex-col gap-3 items-end pb-4">
            
            {/* AI Briefing Widget */}
            {liveBriefing && (
              <CollapsibleWidget title={tx.aiIntelligence} icon={<MessageSquare className="w-3.5 h-3.5 text-blue" />} className="w-full">
                 <div className="text-[12px] leading-relaxed text-text-2 italic border-l-2 border-blue/30 pl-3 py-1 bg-blue/5 rounded-r">
                    "{liveBriefing}"
                 </div>
              </CollapsibleWidget>
            )}

            {/* Action Plan Widget */}
            <CollapsibleWidget title={tx.aiResponsePlan} icon={<ShieldAlert className="w-3.5 h-3.5" />} className="w-full">
               <div className="space-y-3">
                  {liveActions && liveActions.length > 0 ? (
                    liveActions.slice(0, 4).map((action, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-5 h-5 flex items-center justify-center border border-orange/40 bg-orange/10 text-[9px] font-black text-orange rounded shrink-0 num">
                          {i + 1}
                        </span>
                        <span className="text-[11px] text-text-2 leading-relaxed font-medium">{action}</span>
                      </div>
                    ))
                  ) : (
                    tx.actions[threat].map((action: string, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-5 h-5 flex items-center justify-center border border-blue/40 bg-blue/10 text-[9px] font-black text-blue rounded shrink-0 num">
                          {i + 1}
                        </span>
                        <span className="text-[11px] text-text-2 leading-relaxed">{action}</span>
                      </div>
                    ))
                  )}
               </div>
            </CollapsibleWidget>

            {/* Incident Log Widget */}
            <CollapsibleWidget title={tx.incidentLog} icon={<AlertTriangle className="w-3.5 h-3.5" />} defaultOpen={false} className="w-full">
               <div className="space-y-2.5">
                  {liveAlerts && liveAlerts.length > 0 ? (
                    liveAlerts.slice(0, 5).map((alert, i) => (
                      <div key={i} className="p-2 rounded bg-white/5 border border-white/10">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${
                            alert.nivel === 'CRITICO' ? 'text-red' : 'text-orange'
                          }`}>{alert.nivel}</span>
                          <span className="text-[8px] font-mono text-text-muted">{alert.distancia_km} KM</span>
                        </div>
                        <p className="text-[10px] text-text-2 leading-tight">{alert.mensaje}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-text-muted py-2 italic text-center">
                       {tx.noIncidents}
                    </div>
                  )}
               </div>
            </CollapsibleWidget>

          </div>
        </div>

      </main>
    </div>
  )
}
