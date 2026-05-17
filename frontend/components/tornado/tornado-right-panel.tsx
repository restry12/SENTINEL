"use client"

import { Zap, Shield, Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GridPoint } from "./world-tornado-map"

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
    technical_explanation: string
    citizen_alert_160_chars: string
    municipal_briefing: string
    recommended_actions: string[]
    shelter_guidance: string
    uncertainty_note: string
  }
  limitations: string[]
}

interface Props {
  selectedPoint: GridPoint | null
  detail: SevereWeatherDetail | null
}

export function TornadoRightPanel({ selectedPoint, detail }: Props) {
  return (
    <div className="absolute top-6 right-6 z-40 w-72 pointer-events-none h-[calc(100vh-160px)]">
      <div className="h-full overflow-y-auto pl-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-12">
        <SummaryCard selectedPoint={selectedPoint} detail={detail} />
        {detail && <MistralCard detail={detail} />}
        {detail && detail.mistral_analysis.recommended_actions.length > 0 && <ActionsCard detail={detail} />}
        {detail && <DriversCard detail={detail} />}
        <DisclaimerCard detail={detail} />
      </div>
    </div>
  )
}

function SummaryCard({ selectedPoint, detail }: { selectedPoint: GridPoint | null; detail: SevereWeatherDetail | null }) {
  const nowRisk = detail?.forecast_risk[0]
  const score = nowRisk?.score ?? selectedPoint?.score ?? 0
  const riskLevel = nowRisk?.risk_level ?? selectedPoint?.risk_level ?? "LOW"
  const confidence = nowRisk?.confidence ?? selectedPoint?.confidence ?? 0

  const RISK_COLORS: Record<string, string> = {
    CRITICAL: "text-red-400",
    HIGH: "text-orange-400",
    MODERATE: "text-yellow-400",
    LOW: "text-green-400",
  }

  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
            SEVERE WEATHER INTEL
          </span>
          <p className="text-[9px] text-white/25 font-mono mt-0.5">
            {selectedPoint ? `${selectedPoint.lat.toFixed(2)}°, ${selectedPoint.lon.toFixed(2)}°` : "Select a point on the map"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400/80">LIVE</span>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">SSPI Score</p>
            <p className={cn("text-xl font-black", RISK_COLORS[riskLevel] ?? "text-white")}>{score}</p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Risk Level</p>
            <p className={cn("text-sm font-black", RISK_COLORS[riskLevel] ?? "text-white")}>{riskLevel}</p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Confidence</p>
            <p className="text-sm font-black text-white">{confidence}<span className="text-[10px] text-white/40 ml-0.5">%</span></p>
          </div>
          <div className="bg-black/30 rounded border border-white/5 p-2.5">
            <p className="text-[9px] text-white/35 uppercase tracking-widest mb-1">Wind gusts</p>
            <p className="text-sm font-black text-white">
              {nowRisk?.variables?.wind_gusts_10m?.toFixed(0) ?? selectedPoint?.wind_gusts_10m?.toFixed(0) ?? "—"}
              <span className="text-[10px] text-white/40 ml-0.5">km/h</span>
            </p>
          </div>
        </div>
        {/* SSPI gradient bar */}
        <div className="flex items-center gap-2 text-[9px] text-white/30 font-mono">
          <span>0</span>
          <div className="flex-1 relative h-1.5 rounded-full overflow-hidden">
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #22c55e, #eab308 25%, #f97316 50%, #ef4444 75%, #a855f7)" }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_#fff]" style={{ left: `${score}%` }} />
          </div>
          <span>100</span>
        </div>
      </div>
    </div>
  )
}

function MistralCard({ detail }: { detail: SevereWeatherDetail }) {
  const analysis = detail.mistral_analysis
  const hasContent = analysis.risk_summary && analysis.risk_summary !== "AI analysis unavailable."

  return (
    <div className="bg-[#040d18]/90 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-4 shadow-[0_0_24px_rgba(34,211,238,0.05)]">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3 h-3 text-cyan-400" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/70">AI Analysis · Mistral</span>
      </div>
      {hasContent ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-white/70 leading-relaxed">{analysis.risk_summary}</p>
          {analysis.citizen_alert_160_chars && (
            <div className="p-2 rounded border border-yellow-500/20 bg-yellow-500/5">
              <p className="text-[9px] text-yellow-400/70 uppercase tracking-widest mb-1">Citizen Alert</p>
              <p className="text-[10px] text-white/60">{analysis.citizen_alert_160_chars}</p>
            </div>
          )}
          {analysis.shelter_guidance && (
            <div className="p-2 rounded border border-white/10 bg-black/20">
              <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Shelter Guidance</p>
              <p className="text-[10px] text-white/50">{analysis.shelter_guidance}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-white/40 leading-relaxed">
          AI analysis unavailable. Numerical SSPI index calculated successfully.
        </p>
      )}
    </div>
  )
}

function ActionsCard({ detail }: { detail: SevereWeatherDetail }) {
  const actions = detail.mistral_analysis.recommended_actions
  if (actions.length === 0) return null

  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Recommended Actions</span>
        <span className="text-[9px] px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 font-bold uppercase tracking-wide">Priority</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {actions.slice(0, 5).map((action, i) => (
          <div key={i} className="flex gap-3 items-start p-2.5 rounded-lg border border-white/[0.06] bg-black/20">
            <span className="text-[10px] font-black text-cyan-400 font-mono mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-[11px] text-white/60 leading-relaxed">{action}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DriversCard({ detail }: { detail: SevereWeatherDetail }) {
  const nowRisk = detail.forecast_risk[0]
  if (!nowRisk || nowRisk.drivers.length === 0) return null

  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-white/40" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">Risk Drivers (Now)</span>
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        {nowRisk.drivers.map((driver, i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded border border-white/[0.06] bg-black/20">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
            <p className="text-[10px] text-white/60">{driver}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DisclaimerCard({ detail }: { detail: SevereWeatherDetail | null }) {
  return (
    <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/[0.06] rounded-lg p-3 shadow-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3 h-3 text-white/30" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Limitations</span>
      </div>
      <div className="flex flex-col gap-1">
        {(detail?.limitations ?? [
          "This is not an exact tornado prediction.",
          "Estimates favorable conditions for severe storms.",
          "NWS alerts available for US only.",
        ]).map((lim, i) => (
          <p key={i} className="text-[9px] text-white/25 leading-relaxed">• {lim}</p>
        ))}
      </div>
      {detail?.mistral_analysis.uncertainty_note && (
        <p className="text-[9px] text-white/25 mt-2 italic">{detail.mistral_analysis.uncertainty_note}</p>
      )}
    </div>
  )
}
