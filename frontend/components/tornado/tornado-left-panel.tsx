"use client"

import { Wind, ChevronLeft, Zap, Activity, AlertTriangle, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GridPoint, GridScanResult } from "./world-tornado-map"
import { findCountryForPoint, ISO_NAME } from "@/lib/tornado-utils"

interface SevereWeatherDetail {
  forecast_risk: Array<{
    window: string
    timestamp: string
    score: number
    risk_level: string
    variables: Record<string, number | null>
    drivers: string[]
    confidence: number
    impact_corridor: {
      direction_label: string
      bearing_degrees: number
      estimated_distance_km_1h: number
      estimated_distance_km_3h: number
      estimated_distance_km_6h: number
      explanation: string
    }
  }>
  active_alerts: Array<{
    event: string
    severity: string
    urgency: string
    headline: string
    area_description: string
    expires: string
  }>
  mistral_analysis: {
    risk_summary: string
    citizen_alert_160_chars: string
    recommended_actions: string[]
    shelter_guidance: string
    uncertainty_note: string
  }
}

const RISK_CONFIG = {
  CRITICAL: { label: "CRITICAL", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10", dot: "bg-red-400" },
  HIGH:     { label: "HIGH",     color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10", dot: "bg-orange-400" },
  MODERATE: { label: "MODERATE", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10", dot: "bg-yellow-400" },
  LOW:      { label: "LOW",      color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10", dot: "bg-green-400" },
}

interface Props {
  gridData: GridScanResult | null
  selectedCountryIso?: string | null
  selectedPoint: GridPoint | null
  detail: SevereWeatherDetail | null
  detailLoading: boolean
  onPointSelect: (point: GridPoint) => void
  onBack: () => void
}

export function TornadoLeftPanel({ gridData, selectedCountryIso, selectedPoint, detail, detailLoading, onPointSelect, onBack }: Props) {
  return (
    <div className="absolute top-6 left-6 z-40 w-72 pointer-events-none h-[calc(100vh-160px)]">
      <div className="h-full overflow-y-auto pr-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-12">
        {selectedPoint ? (
          <PointDetailPanel point={selectedPoint} detail={detail} loading={detailLoading} onBack={onBack} />
        ) : (
          <GlobalPanel gridData={gridData} selectedCountryIso={selectedCountryIso} onPointSelect={onPointSelect} onBack={onBack} />
        )}
      </div>
    </div>
  )
}

function GlobalPanel({ gridData, selectedCountryIso, onPointSelect, onBack }: { gridData: GridScanResult | null; selectedCountryIso?: string | null; onPointSelect: (p: GridPoint) => void; onBack: () => void }) {
  const globalPoints = gridData?.points ?? []
  const points = selectedCountryIso 
    ? globalPoints.filter(p => findCountryForPoint(p.lat, p.lon) === selectedCountryIso)
    : globalPoints

  const highRisk = points.filter(p => p.risk_level === "HIGH" || p.risk_level === "CRITICAL")
  const maxScore = points.reduce((max, p) => Math.max(max, p.score), 0)
  const maxWind = points.reduce((max, p) => Math.max(max, p.wind_gusts_10m ?? 0), 0)
  const maxRiskLevel = points.find(p => p.score === maxScore)?.risk_level ?? "LOW"
  const rc = RISK_CONFIG[maxRiskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW

  const title = selectedCountryIso ? (ISO_NAME[selectedCountryIso] ?? selectedCountryIso) : "Global Monitor Active"
  const pointsList = selectedCountryIso ? points.sort((a, b) => b.score - a.score) : highRisk.sort((a, b) => b.score - a.score).slice(0, 10)

  return (
    <>
      {/* Back to Global if in Country Mode */}
      {selectedCountryIso && (
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white/80 transition-colors px-2 py-1.5 rounded border border-white/10 hover:border-white/20 bg-black/20 backdrop-blur-md"
        >
          <ChevronLeft className="w-3 h-3" />
          Global view
        </button>
      )}

      {/* Summary */}
      <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]", highRisk.length > 0 ? "bg-red-400" : "bg-green-400")} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
            {title}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Points scanned</p>
            <p className="text-xl font-black text-white">{points.length}</p>
          </div>
          <div className="bg-black/30 rounded border border-red-500/15 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">HIGH/CRITICAL</p>
            <p className={cn("text-xl font-black", highRisk.length > 0 ? "text-red-400" : "text-green-400")}>{highRisk.length}</p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Max gusts</p>
            <p className="text-base font-black text-white">{maxWind.toFixed(0)}<span className="text-xs text-white/50 ml-1">km/h</span></p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Max SSPI</p>
            <p className={cn("text-base font-black", rc.color)}>{maxScore}</p>
          </div>
        </div>

        {/* Risk bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-white/30 mb-1 font-mono">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden bg-black/30">
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #22c55e 0%, #eab308 25%, #f97316 50%, #ef4444 75%, #a855f7 100%)" }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_#fff]" style={{ left: `${maxScore}%` }} />
          </div>
          <p className="text-[9px] text-white/30 mt-1 text-right font-mono">SSPI max: {maxScore}/100</p>
        </div>
      </div>

      {/* Points list or Empty state */}
      {pointsList.length > 0 ? (
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col min-h-0 shrink-0">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
            <Activity className="w-3.5 h-3.5 text-white/40" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
              {selectedCountryIso ? "Detected Zones" : "High Risk Zones"}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2 overflow-y-auto scrollbar-none" style={{ maxHeight: "300px" }}>
            {pointsList.map((point, i) => {
              const prc = RISK_CONFIG[point.risk_level as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.MODERATE
              return (
                <button
                  key={`${point.lat}-${point.lon}`}
                  onClick={() => onPointSelect(point)}
                  className={cn(
                    "w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
                    "bg-black/20 hover:bg-black/40 shrink-0",
                    prc.border, "hover:shadow-[0_0_16px_rgba(0,0,0,0.4)]"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-[11px]", prc.bg, prc.color)}>
                    {point.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-xs font-bold truncate">
                      {point.lat.toFixed(1)}°, {point.lon.toFixed(1)}°
                    </p>
                    <p className="text-white/35 text-[10px] font-mono truncate">
                      {point.wind_gusts_10m ? `Gusts ${point.wind_gusts_10m.toFixed(0)} km/h` : "No gust data"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={cn("text-[9px] font-bold uppercase tracking-wide", prc.color)}>{prc.label}</span>
                    <span className="text-[9px] text-white/30 font-mono">{point.confidence}%</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : selectedCountryIso && (
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-6 shadow-2xl flex flex-col items-center justify-center text-center">
          <Shield className="w-6 h-6 text-green-400 mb-3 opacity-80" />
          <p className="text-[11px] text-white/80 font-bold mb-1 uppercase tracking-wider">Sin condiciones severas</p>
          <p className="text-[10px] text-white/40 leading-relaxed">No se detectaron focos de riesgo de tornados en {ISO_NAME[selectedCountryIso] ?? selectedCountryIso} en este momento.</p>
        </div>
      )}

      {/* Source info */}
      {!selectedCountryIso && (
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-cyan-500/15 rounded-lg p-3 shadow-2xl shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/70">Data Sources</span>
          </div>
          <p className="text-[10px] text-white/40 leading-relaxed">
            Open-Meteo global forecast + NOAA/NWS alerts (US only). Refresh: {gridData ? Math.round(gridData.refresh_interval_ms / 60000) : 60} min.
            {gridData?.metadata.cached && <span className="text-cyan-400 ml-1">(cached)</span>}
          </p>
        </div>
      )}
    </>
  )
}

function PointDetailPanel({ point, detail, loading, onBack }: { point: GridPoint; detail: SevereWeatherDetail | null; loading: boolean; onBack: () => void }) {
  const activeRiskLevel = detail?.forecast_risk?.[0]?.risk_level ?? point.risk_level
  const rc = RISK_CONFIG[activeRiskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW

  return (
    <>
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white/80 transition-colors px-2 py-1.5 rounded border border-white/10 hover:border-white/20 bg-black/20 backdrop-blur-md"
      >
        <ChevronLeft className="w-3 h-3" />
        Back
      </button>

      {/* Point header */}
      <div className={cn("bg-[#0a0d14]/90 backdrop-blur-xl border rounded-lg p-4 shadow-2xl", rc.border)}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider mb-2", rc.bg, rc.color)}>
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", rc.dot)} />
              {rc.label}
            </div>
            <h2 className="text-white font-black text-sm">{point.lat.toFixed(2)}°, {point.lon.toFixed(2)}°</h2>
            <p className="text-white/40 text-[10px] font-mono mt-0.5">SSPI Score: {detail?.forecast_risk?.[0]?.score ?? point.score}/100</p>
          </div>
          <span className={cn("text-2xl font-black", rc.color)}>{detail?.forecast_risk?.[0]?.score ?? point.score}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/30 rounded border border-white/5 p-2">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Gusts</p>
            <p className="text-sm font-black text-white leading-tight">{(detail?.forecast_risk?.[0]?.variables?.wind_gusts_10m ?? point.wind_gusts_10m)?.toFixed(0) ?? "—"}<span className="text-[10px] text-white/40 ml-0.5">km/h</span></p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Confidence</p>
            <p className="text-sm font-black text-white leading-tight">{detail?.forecast_risk?.[0]?.confidence ?? point.confidence}%</p>
          </div>
        </div>
      </div>

      {loading || !detail ? (
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-6 flex flex-col items-center justify-center gap-4 shadow-2xl text-center">
          <div className="w-5 h-5 rounded-full bg-cyan-400/20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80 leading-relaxed">
            Cargando proyecciones<br/>e información oficial...
          </span>
        </div>
      ) : (
        <>
          {/* Forecast windows */}
          {detail.forecast_risk.length > 0 && (
            <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Forecast Windows</span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {detail.forecast_risk.map(fr => {
                  const frc = RISK_CONFIG[fr.risk_level as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW
                  return (
                    <div key={fr.window} className={cn("flex items-center gap-3 p-2.5 rounded-lg border bg-black/20", frc.border)}>
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm", frc.bg, frc.color)}>
                        {fr.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/90 text-xs font-bold">{fr.window}</p>
                        <p className="text-white/35 text-[10px] font-mono truncate">
                          {fr.drivers.slice(0, 2).join(" · ")}
                        </p>
                      </div>
                      <span className={cn("text-[9px] font-bold uppercase", frc.color)}>{fr.risk_level}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active alerts */}
          {detail.active_alerts.length > 0 && (
            <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-red-500/25 rounded-lg shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-400/70">Official NWS Alerts</span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {detail.active_alerts.map((alert, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
                    <p className="text-[10px] font-bold text-red-400">{alert.event}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{alert.headline}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact corridor */}
          {detail.forecast_risk[0]?.impact_corridor && (
            <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Wind className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Impact Corridor</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { k: "1h", v: detail.forecast_risk[0].impact_corridor.estimated_distance_km_1h },
                  { k: "3h", v: detail.forecast_risk[0].impact_corridor.estimated_distance_km_3h },
                  { k: "6h", v: detail.forecast_risk[0].impact_corridor.estimated_distance_km_6h },
                ].map(({ k, v }) => (
                  <div key={k} className="bg-black/30 rounded border border-white/5 p-2 text-center">
                    <p className="text-[9px] text-white/35 uppercase mb-1">{k}</p>
                    <p className="text-sm font-black text-white">{v}<span className="text-[8px] text-white/40 ml-0.5">km</span></p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-cyan-400" />
                <p className="text-[10px] text-white/40">
                  Direction: <span className="text-white/70 font-bold">{detail.forecast_risk[0].impact_corridor.direction_label}</span>
                  {" "}({detail.forecast_risk[0].impact_corridor.bearing_degrees}°)
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
