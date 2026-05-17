'use client'

import { useLang } from '@/lib/i18n/language-context'

interface TileProps {
  label: string
  value: string
  unit?: string
  delta: string
  deltaType?: 'default' | 'warn' | 'crit'
  sparklinePoints: string
  sparklineColor: string
}

const Tile = ({ label, value, unit, delta, deltaType = 'default', sparklinePoints, sparklineColor }: TileProps) => {
  let deltaColor = 'text-green-soft'
  if (deltaType === 'warn') deltaColor = 'text-orange-soft'
  if (deltaType === 'crit') deltaColor = 'text-red-soft'

  return (
    <div className="p-4 bg-surface/60 border border-white/5 rounded-xl backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-white/10 transition-all duration-300">
      <div className="absolute top-0 left-0 w-8 h-[1px] bg-blue shadow-[0_0_8px_var(--blue)] opacity-50" />
      <div className="text-[9px] font-black tracking-[0.2em] text-text-muted uppercase mb-1.5 group-hover:text-text-dim transition-colors">{label}</div>
      <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1.5">
        {value}
        {unit && <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{unit}</span>}
      </div>
      <div className={`text-[10px] font-bold mt-2 flex items-center gap-1.5 ${deltaColor} num`}>
        {delta}
      </div>
      <svg className="absolute right-3 bottom-3 w-16 h-4 opacity-40 group-hover:opacity-80 transition-opacity" viewBox="0 0 60 16" fill="none">
        <polyline points={sparklinePoints} stroke={sparklineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function TelemetryTiles() {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
      <Tile
        label={t('tileHotspots')}
        value="2,412"
        delta="▲ 312 / HR"
        deltaType="crit"
        sparklinePoints="0,12 8,10 16,11 24,7 32,8 40,4 48,6 60,2"
        sparklineColor="#ff3333"
      />
      <Tile
        label={t('tileCoverage')}
        value="98.4%"
        delta="▲ STABLE · 4 SAT"
        sparklinePoints="0,12 10,11 20,12 30,11 40,11 50,10 60,10"
        sparklineColor="#10b981"
      />
      <Tile
        label={t('tileAlerts')}
        value="18,906"
        delta="▲ +6.1% TODAY"
        sparklinePoints="0,13 10,11 20,10 30,9 40,7 50,6 60,4"
        sparklineColor="#38bdf8"
      />
      <Tile
        label={t('tileLatency')}
        value="3.4"
        unit="MIN"
        delta="▼ -12% OPTIMIZED"
        deltaType="warn"
        sparklinePoints="0,4 10,6 20,7 30,9 40,8 50,10 60,11"
        sparklineColor="#ff7e15"
      />
    </div>
  )
}
