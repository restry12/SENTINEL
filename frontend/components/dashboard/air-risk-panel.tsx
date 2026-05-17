"use client"

import { useSentinel } from '@/contexts/sentinel-context'
import type { AirRiskCell, AirRiskTimeSlot } from '@/types/air-risk'

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
  EMERGENCY: '#7c2d92',
}

const RISK_RECOMMENDATIONS: Record<string, string> = {
  LOW: 'Air quality is acceptable. No restrictions needed.',
  MODERATE: 'Sensitive groups should limit prolonged outdoor exertion.',
  HIGH: 'Everyone should reduce prolonged outdoor activity. Close windows.',
  CRITICAL: 'Avoid all outdoor activity. Use N95 masks if outside. Seal buildings.',
  EMERGENCY: 'Shelter in place. Evacuate if directed. Immediate health hazard.',
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <span className="text-green-400">↓</span>
  if (trend === 'worsening') return <span className="text-red-400">↑</span>
  return <span className="text-white/40">→</span>
}

interface AirRiskPanelProps {
  cell: AirRiskCell | null
  visible: boolean
  timeSlot: AirRiskTimeSlot
}

export function AirRiskPanel({ cell, visible, timeSlot }: AirRiskPanelProps) {
  const { sentinelUpdate } = useSentinel()
  const airRiskGrid = sentinelUpdate?.airRiskGrid

  if (!visible) return null

  // If no cell selected, auto-pick the highest AQI cell from the current timeSlot
  const displayCell = cell ?? (airRiskGrid?.[timeSlot]?.reduce((best, c) =>
    c.aqi > (best?.aqi ?? 0) ? c : best, null as AirRiskCell | null
  ) ?? null)

  if (!displayCell) return null

  const color = RISK_COLORS[displayCell.risk_level] || '#22c55e'
  const shouldPulse = displayCell.risk_level === 'CRITICAL' || displayCell.risk_level === 'EMERGENCY'

  return (
    <div className="absolute top-4 right-4 z-30 w-[320px]">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
              Air Risk {timeSlot !== 'now' ? `(${timeSlot})` : ''}
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/40">
            {Math.round(displayCell.confidence * 100)}% conf
          </span>
        </div>

        {/* Risk Badge */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
          <div className="relative">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
            />
            {shouldPulse && (
              <div
                className="absolute inset-0 w-3 h-3 rounded-full animate-ping"
                style={{ backgroundColor: color, opacity: 0.4 }}
              />
            )}
          </div>
          <span
            className="text-xs font-black uppercase tracking-widest"
            style={{ color }}
          >
            {displayCell.risk_level}
          </span>
          <span className="ml-auto text-[10px] text-white/30 font-mono">
            {displayCell.id}
          </span>
        </div>

        {/* Metrics Grid 2x3 */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="grid grid-cols-3 gap-2">
            {/* AQI */}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">AQI</div>
              <div className="text-[14px] font-black text-white">{displayCell.aqi}</div>
            </div>
            {/* PM2.5 */}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">PM2.5</div>
              <div className="text-[14px] font-black text-white">
                {displayCell.pm25.toFixed(1)}
                <span className="text-[9px] text-white/30 ml-0.5">µg</span>
              </div>
            </div>
            {/* Ozone */}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Ozone</div>
              <div className="text-[14px] font-black text-white">
                {displayCell.ozone.toFixed(0)}
                <span className="text-[9px] text-white/30 ml-0.5">ppb</span>
              </div>
            </div>
            {/* NO2 */}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">NO₂</div>
              <div className="text-[14px] font-black text-white">
                {displayCell.no2.toFixed(0)}
                <span className="text-[9px] text-white/30 ml-0.5">ppb</span>
              </div>
            </div>
            {/* CO */}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">CO</div>
              <div className="text-[14px] font-black text-white">
                {displayCell.co.toFixed(1)}
                <span className="text-[9px] text-white/30 ml-0.5">ppm</span>
              </div>
            </div>
            {/* Main Pollutant */}
            <div className="bg-white/[0.03] rounded-lg p-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Pollutant</div>
              <div className="text-[11px] font-bold text-white truncate">
                {displayCell.main_pollutant}
              </div>
            </div>
          </div>
        </div>

        {/* Trend + Fire + Smoke */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-white/30 uppercase tracking-wider text-[9px]">Trend</span>
              <TrendIcon trend={displayCell.trend} />
              <span className="text-white/60 capitalize">{displayCell.trend}</span>
            </div>
            {displayCell.nearest_fire_km !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 uppercase tracking-wider text-[9px]">Fire</span>
                <span className="text-orange-400 font-bold">
                  {displayCell.nearest_fire_km.toFixed(1)} km
                </span>
              </div>
            )}
            {displayCell.smoke_direction && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 uppercase tracking-wider text-[9px]">Smoke</span>
                <span className="text-white/60">{displayCell.smoke_direction}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendation */}
        <div className="px-4 py-3">
          <p className="text-[11px] text-white/50 leading-relaxed">
            {RISK_RECOMMENDATIONS[displayCell.risk_level] || RISK_RECOMMENDATIONS.LOW}
          </p>
        </div>
      </div>
    </div>
  )
}
