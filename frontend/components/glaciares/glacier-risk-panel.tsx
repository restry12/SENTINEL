'use client'

import type { Glacier } from '@/lib/glacier-types'

const RISK_CONFIG = {
  'Crítico':    { color: '#ff3333',  cls: 'text-red border-red/30 bg-red/10' },
  'Riesgo Alto':{ color: '#f97316',  cls: 'text-orange border-orange/30 bg-orange/10' },
  'Observación':{ color: '#38bdf8',  cls: 'text-blue border-blue/30 bg-blue/10' },
  'Estable':    { color: '#10b981',  cls: 'text-green border-green/30 bg-green/10' },
} as const

function Gauge({ score }: { score: number }) {
  const cfg = RISK_CONFIG[score >= 76 ? 'Crítico' : score >= 51 ? 'Riesgo Alto' : score >= 26 ? 'Observación' : 'Estable']
  const r = 78, cx = 110, cy = 100
  const startDeg = -135, endDeg = 135
  const toRad = (d: number) => (d * Math.PI) / 180
  const arc = (a1: number, a2: number) => {
    const x1 = cx + r * Math.cos(toRad(a1)), y1 = cy + r * Math.sin(toRad(a1))
    const x2 = cx + r * Math.cos(toRad(a2)), y2 = cy + r * Math.sin(toRad(a2))
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }
  const angleFn = (s: number) => startDeg + (s / 100) * (endDeg - startDeg)
  const needleA = angleFn(score)
  const nx = cx + r * Math.cos(toRad(needleA))
  const ny = cy + r * Math.sin(toRad(needleA))

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 220 140" className="w-full max-w-[220px]">
        <path d={arc(startDeg, endDeg)} stroke="rgba(120,200,240,0.08)" strokeWidth="10" fill="none" strokeLinecap="round" />
        {[
          [0,25,'#10b981'],[25,50,'#38bdf8'],[50,75,'#f97316'],[75,100,'#ff3333']
        ].map(([from, to, c]) => (
          <path key={String(from)} d={arc(angleFn(Number(from)), angleFn(Number(to)))} stroke={String(c)} strokeWidth="3" fill="none" opacity="0.5" />
        ))}
        <path d={arc(startDeg, needleA)} stroke={cfg.color} strokeWidth="10" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${cfg.color}88)` }} />
        {[0,25,50,75,100].map(s => {
          const a = angleFn(s)
          return (
            <text key={s}
              x={cx + (r+14) * Math.cos(toRad(a))}
              y={cy + (r+14) * Math.sin(toRad(a))}
              fill="rgba(120,200,240,0.4)" fontSize="7" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
            >{s}</text>
          )
        })}
        <circle cx={nx} cy={ny} r="6" fill={cfg.color} style={{ filter: `drop-shadow(0 0 6px ${cfg.color})` }} />
        <circle cx={nx} cy={ny} r="2.5" fill="#04060a" />
      </svg>
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
        <span className="text-4xl font-black tabular-nums" style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.color}55` }}>
          {score}
        </span>
        <span className="text-[9px] font-mono text-white/40">/ 100 · ÍNDICE</span>
      </div>
    </div>
  )
}

interface Props {
  glacier: Glacier | null
}

export function GlacierRiskPanel({ glacier: g }: Props) {
  if (!g) return (
    <div className="absolute top-6 left-6 z-40 w-72 bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 text-white/30 text-[10px] font-mono">
      Seleccioná un glaciar
    </div>
  )

  const cfg = RISK_CONFIG[g.cat]

  return (
    <div className="absolute top-6 left-6 z-40 w-72 max-h-[calc(100vh-360px)] overflow-y-auto scrollbar-none pointer-events-auto">
      <div className="flex flex-col gap-3 pb-4">
        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase mb-1">Índice de Riesgo Glaciar</p>
              <h3 className="text-sm font-black text-white leading-tight">{g.name}</h3>
              <p className="text-[9px] font-mono text-white/40 mt-0.5">{g.region.toUpperCase()}</p>
            </div>
            <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${cfg.cls}`}>
              {g.cat}
            </span>
          </div>

          <Gauge score={g.riesgo} />

          <div className="mt-2 space-y-1.5">
            {[
              { k: 'Variación', v: g.deltaShort, style: { color: '#ff3333' } },
              { k: 'Tendencia', v: g.trend },
              { k: 'Balance de masa', v: g.masaVar, style: { fontFamily: 'monospace', fontSize: '11px' } },
              { k: 'Dependencia hídrica', v: g.poblacion, style: { fontSize: '10px' } },
            ].map(({ k, v, style }) => (
              <div key={k} className="flex justify-between items-start gap-2 py-1 border-t border-white/5">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider shrink-0">{k}</span>
                <span className="text-[11px] text-white/80 text-right" style={style}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0a0d14]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">Variables · Riesgo</p>
            <span className="text-[9px] font-mono text-white/30">5 FACTORES</span>
          </div>
          {[
            { label: 'Retroceso de superficie', pct: Math.min(100, Math.max(0, (100 - (g.areaHistory.at(-1) ?? 100)) * 1.2)), warn: true },
            { label: 'Anomalía térmica', pct: Math.min(100, g.tempAnomaly / 3 * 100), warn: g.tempAnomaly > 1.5 },
            { label: 'Vulnerabilidad altitudinal', pct: g.elevation !== undefined ? Math.min(100, (5000 - g.elevation) / 40) : 50, warn: false },
            { label: 'Tamaño (área actual)', pct: g.area < 1 ? 90 : g.area < 10 ? 70 : g.area < 100 ? 50 : 30, warn: g.area < 5 },
            { label: 'Importancia hídrica cuenca', pct: g.riesgo, warn: g.riesgo > 70 },
          ].map(({ label, pct, warn }) => (
            <div key={label} className="mb-2 last:mb-0">
              <div className="flex justify-between mb-1">
                <span className={`text-[9px] font-medium ${warn ? 'text-orange' : 'text-white/50'}`}>{label}</span>
                <span className="text-[9px] font-mono text-white/40">{Math.round(pct)}</span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: warn ? '#f97316' : '#38bdf8', boxShadow: warn ? '0 0 6px #f9731688' : undefined }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
