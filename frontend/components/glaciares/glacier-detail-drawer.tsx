'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { Glacier } from '@/lib/glacier-types'

const INFRA_LABELS: Record<string, string> = {
  AP:'Agua Potable', EM:'Embalse', HE:'Hidroeléctrica', AG:'Agrícola',
  CI:'Ciudad', PN:'Área Protegida', RT:'Ruta', MI:'Mina', RI:'Río', TU:'Turismo',
}

const RISK_COLOR: Record<string, string> = {
  'Crítico':'#ff3333','Riesgo Alto':'#f97316','Observación':'#38bdf8','Estable':'#10b981',
}

function MiniLineChart({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={pts} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 9 }}
          labelFormatter={() => ''}
          formatter={(v: number) => [v.toFixed(2), '']}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface Props {
  glacier: Glacier | null
  open: boolean
  onClose: () => void
}

export function GlacierDetailDrawer({ glacier: g, open, onClose }: Props) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed right-0 top-0 bottom-0 z-[61] w-[480px] max-w-[90vw] bg-[#0a0b0e] border-l border-white/10 overflow-y-auto transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {g && (
          <>
            <div className="sticky top-0 bg-[#0a0b0e]/95 backdrop-blur border-b border-white/10 p-4 flex items-start justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: RISK_COLOR[g.cat] }}>
                  {g.cat} · #{g.glimsId}
                </span>
                <h2 className="text-base font-black text-white mt-1">{g.name}</h2>
                <p className="text-[9px] font-mono text-white/40">
                  {g.region.toUpperCase()} · LAT {g.lat.toFixed(4)} / LON {g.lon.toFixed(4)}
                </p>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none p-1">✕</button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: 'Índice de Riesgo', v: `${g.riesgo}/100`, style: { color: RISK_COLOR[g.cat] } },
                  { k: 'Tendencia', v: g.trend },
                  { k: 'Variación', v: g.deltaShort, style: { color: '#ff3333' } },
                  { k: 'Δ Temperatura', v: `+${g.tempAnomaly}°C`, style: { color: '#f97316' } },
                  { k: 'Balance de masa', v: g.masaVar, style: { fontFamily: 'monospace', fontSize: '12px' } },
                  { k: 'Superficie', v: `${g.area} km²`, style: { fontFamily: 'monospace' } },
                  { k: 'Cuenca', v: g.cuenca },
                  { k: 'Altitud', v: g.elevation !== undefined ? `${g.elevation} m` : 'N/D' },
                ].map(({ k, v, style }) => (
                  <div key={k} className="bg-white/3 border border-white/8 rounded p-2.5">
                    <p className="text-[8px] font-bold text-white/30 uppercase mb-1">{k}</p>
                    <p className="text-sm font-bold text-white" style={style}>{v}</p>
                  </div>
                ))}
              </div>

              {[
                { title: 'Evolución de Superficie · %', data: g.areaHistory, color: '#38bdf8' },
                { title: 'Balance de Masa · m EH/año', data: g.massHistory, color: '#ff3333' },
                { title: 'Δ Temperatura ERA5 · °C', data: g.tempHistory, color: '#f97316' },
              ].map(({ title, data, color }) => (
                <div key={title}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-2">{title}</p>
                  <div className="bg-white/3 border border-white/8 rounded overflow-hidden">
                    <MiniLineChart data={data} color={color} />
                  </div>
                </div>
              ))}

              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-2">Infraestructura y Zonas Sensibles</p>
                <div className="space-y-1.5">
                  {g.infra.map((it, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono bg-white/8 px-1.5 py-0.5 rounded text-white/50">{it.ic}</span>
                        <span className="text-[10px] text-white/70">{it.t}</span>
                        <span className="text-[8px] text-white/30">{INFRA_LABELS[it.ic] ?? ''}</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/40">{it.d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {g.ai && (
                <div className="bg-white/3 border border-white/8 rounded p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue mb-2">Análisis IA</p>
                  <p className="text-[10px] text-white/70 leading-relaxed mb-2">{g.ai.diag}</p>
                  <p className="text-[9px] text-white/50 leading-relaxed">{g.ai.impact}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-[#0a0b0e]/95 backdrop-blur border-t border-white/10 p-4 flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 rounded border border-white/15 text-[10px] font-black tracking-widest text-white/50 hover:bg-white/5 uppercase">
                CERRAR
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
