"use client"

import React from "react"
import { 
  Snowflake, 
  Thermometer, 
  Droplets, 
  TrendingDown, 
  AlertTriangle, 
  Zap, 
  Info,
  Calendar,
  Layers
} from "lucide-react"
import { CollapsibleWidget } from "@/components/dashboard/widget"
import { RiskIndicator } from "./risk-indicator"
import type { GlacierAnalysis } from "@sentinel/types"
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts"

interface Props {
  data: GlacierAnalysis
}

export function GlacierRightPanel({ data }: Props) {
  const { 
    glacierInfo, 
    climateData, 
    massHistory, 
    riskIndex, 
    riskCategory, 
    prediction, 
    llmAnalysis 
  } = data

  const getRiskColor = (cat: string) => {
    switch (cat) {
      case 'CRITICO': return 'text-red'
      case 'ALTO': return 'text-orange'
      case 'MEDIO': return 'text-yellow'
      case 'BAJO': return 'text-blue'
      default: return 'text-white'
    }
  }

  const riskColorClass = getRiskColor(riskCategory)

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ── SECCION PRINCIPAL: ESTADO Y RIESGO ── */}
      <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
            Estado del Glaciar
          </div>
          <div className={`text-[10px] font-black px-2 py-0.5 rounded border border-current ${riskColorClass} bg-opacity-10`}>
            {riskCategory}
          </div>
        </div>

        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">
          {glacierInfo.name}
        </h2>

        <div className="space-y-4">
          <RiskIndicator value={riskIndex} label="Índice de Vulnerabilidad" />
          
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-white/5 border border-white/5 rounded p-2.5">
              <div className="text-[9px] font-bold text-text-muted uppercase mb-1">Retroceso Est.</div>
              <div className="text-sm font-black text-white tracking-tight">
                {prediction.trend}
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 rounded p-2.5">
              <div className="text-[9px] font-bold text-text-muted uppercase mb-1">Tiempo Crítico</div>
              <div className="text-sm font-black text-white tracking-tight">
                {prediction.estimated_years_to_critical ?? 'Indef.'} <span className="text-[10px] text-text-muted font-bold">AÑOS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HISTORIAL DE MASA ── */}
      <CollapsibleWidget 
        title="Historial de Masa (mmwe)" 
        icon={<TrendingDown className="w-3.5 h-3.5" />}
        className="w-full"
      >
        <div className="h-32 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={massHistory}>
              <defs>
                <linearGradient id="colorMass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="year" 
                hide 
              />
              <YAxis 
                hide 
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0a0b0e', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '10px',
                  borderRadius: '4px'
                }}
                itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="mass_change_mmwe" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorMass)" 
                strokeWidth={2}
                name="Cambio de Masa"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between items-center mt-2 text-[9px] font-bold text-text-muted uppercase tracking-widest px-1">
          <span>{massHistory[0]?.year}</span>
          <span>{massHistory[massHistory.length - 1]?.year}</span>
        </div>
      </CollapsibleWidget>

      {/* ── ESTADISTICAS CLIMATICAS ── */}
      <CollapsibleWidget 
        title="Estadísticas Climáticas" 
        icon={<Thermometer className="w-3.5 h-3.5" />}
        className="w-full"
      >
        <div className="grid grid-cols-2 gap-2 mt-2">
          <StatBox 
            label="Temp. Promedio" 
            value={`${climateData.temp_avg.toFixed(1)}°C`} 
            icon={<Thermometer className="w-3 h-3 text-orange" />}
            anomaly={climateData.thermal_anomaly > 0 ? `+${climateData.thermal_anomaly}°C` : `${climateData.thermal_anomaly}°C`}
          />
          <StatBox 
            label="Precipitación" 
            value={`${climateData.precipitation_mm}mm`} 
            icon={<Droplets className="w-3 h-3 text-blue" />}
          />
          <StatBox 
            label="Nieve" 
            value={`${climateData.snowfall_cm}cm`} 
            icon={<Snowflake className="w-3 h-3 text-white" />}
          />
          <StatBox 
            label="Días > 0°C" 
            value={climateData.days_above_zero} 
            icon={<Calendar className="w-3 h-3 text-yellow" />}
          />
        </div>
      </CollapsibleWidget>

      {/* ── ANALISIS IA ── */}
      <div className="space-y-3">
        {/* Resumen */}
        <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-3.5 h-3.5 text-blue" />
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Resumen IA</div>
          </div>
          <p className="text-[11px] text-text-2 leading-relaxed">
            {llmAnalysis.summary}
          </p>
        </div>

        {/* Explicación del Riesgo */}
        <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-orange" />
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Factores de Riesgo</div>
          </div>
          <p className="text-[11px] text-text-2 leading-relaxed italic">
            {llmAnalysis.riskExplanation}
          </p>
        </div>

        {/* Acciones Urgentes */}
        <div className="bg-red/5 backdrop-blur-md border border-red/20 rounded p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-red" />
            <div className="text-[10px] font-bold text-red uppercase tracking-widest">Acciones Urgentes</div>
          </div>
          <ul className="space-y-2">
            {llmAnalysis.urgentActions.map((action, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red font-bold text-[10px]">•</span>
                <span className="text-[10px] text-white/90 font-medium leading-tight">
                  {action}
                </span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Recomendaciones de Monitoreo */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-3.5 h-3.5 text-blue" />
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Monitoreo Sugerido</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {llmAnalysis.monitoringRecommendations.map((rec, i) => (
              <span key={i} className="text-[8px] font-bold bg-blue/10 text-blue border border-blue/20 px-1.5 py-0.5 rounded uppercase">
                {rec}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, icon, anomaly }: { label: string, value: string | number, icon: React.ReactNode, anomaly?: string }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-[12px] font-black text-white">{value}</div>
        {anomaly && (
          <div className="text-[8px] font-black text-red">{anomaly}</div>
        )}
      </div>
    </div>
  )
}
