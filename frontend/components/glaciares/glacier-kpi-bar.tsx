'use client'

import type { Glacier } from '@/lib/glacier-types'

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const w = 72, h = 18
  const max = Math.max(...values), min = Math.min(...values)
  const range = max - min || 1
  const step = w / (values.length - 1)
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <path d={path} stroke={color} strokeWidth="1.3" fill="none" />
    </svg>
  )
}

interface Props {
  glaciers: Glacier[]
}

export function GlacierKPIBar({ glaciers }: Props) {
  if (glaciers.length === 0) return null

  const critCount = glaciers.filter(g => g.cat === 'Crítico').length
  const retreatCount = glaciers.filter(g => g.trend.includes('Retroceso')).length
  const avgTemp = (glaciers.reduce((s, g) => s + g.tempAnomaly, 0) / glaciers.length).toFixed(1)
  const maxMass = glaciers.reduce((prev, g) => {
    const last = g.massHistory.at(-1) ?? 0
    return last < (prev.massHistory.at(-1) ?? 0) ? g : prev
  })

  const tempSeries = glaciers.slice(0,7).map(g => g.tempAnomaly)
  const retreatSeries = [15, 18, 22, 25, 27, 30, retreatCount]
  const massSeries = glaciers.slice(0,7).map(g => Math.abs(g.massHistory.at(-1) ?? 0.3))

  const timeStr = new Date().toISOString().slice(11, 16)

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 px-0 pb-2">
      {[
        { icon: '◆', label: 'Monitoreados', value: String(glaciers.length), unit: 'ACTIVOS', spark: retreatSeries, color: '#38bdf8', valueColor: undefined },
        { icon: '▼', label: 'En Retroceso', value: String(retreatCount), unit: `${Math.round(retreatCount/glaciers.length*100)}%`, spark: retreatSeries, color: '#ff3333', valueColor: '#ff3333' },
        { icon: '≈', label: 'Riesgo Hídrico', value: critCount > 0 ? 'ALTO' : 'MEDIO', unit: `${critCount} cuencas críticas`, spark: null, color: '#f97316', valueColor: '#f97316' },
        { icon: '↑', label: 'Temp. +anomalía', value: `+${avgTemp}`, unit: '°C', spark: tempSeries, color: '#f97316', valueColor: '#f97316' },
        { icon: '∂', label: 'Variación masa', value: maxMass.masaVar.split(' ')[0], unit: 'm EH/año', spark: massSeries, color: '#ff3333', valueColor: '#ff3333' },
        { icon: '○', label: 'Actualización', value: timeStr, unit: 'UTC −3', sub: 'GLIMS · ERA5 · WGMS', spark: null, color: '#10b981', valueColor: '#10b981' },
      ].map(({ icon, label, value, unit, spark, color, valueColor, sub }) => (
        <div key={label} className="bg-[#0a0d14]/80 backdrop-blur border border-white/8 rounded-lg p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color }}>{icon}</span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 truncate">{label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tabular-nums leading-none" style={{ color: valueColor ?? '#f0f2f5' }}>{value}</span>
            <span className="text-[9px] font-mono text-white/30 truncate">{unit}</span>
          </div>
          {spark && <MiniSpark values={spark} color={color} />}
          {'sub' in { sub } && sub && <span className="text-[8px] font-mono text-white/25 truncate">{sub}</span>}
        </div>
      ))}
    </div>
  )
}
