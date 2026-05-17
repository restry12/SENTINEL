"use client"

import { AlertTriangle, MessageSquare, MapPin, Droplets } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinel, useSentinelMetrics } from "@/contexts/sentinel-context"
import { useFireSelection } from "@/contexts/fire-selection-context"

function Label({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div className="sentinel-label">
      <span className="text-foreground">{children}</span>
      <span className="bar opacity-50" />
      {right && <span className="text-orange font-mono tracking-widest">{right}</span>}
    </div>
  )
}

function WindRose({ direction }: { direction: string }) {
  const deg = ({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 } as Record<string, number>)[direction] ?? 0
  return (
    <div className="relative w-[52px] h-[52px] border border-border-2 rounded-full flex items-center justify-center bg-[radial-gradient(circle,#181a1f_0%,#0c0e12_80%)] shadow-[inset_0_0_12px_rgba(0,0,0,0.6),0_0_15px_rgba(56,189,248,0.1)] shrink-0">
      <span className="absolute top-[3px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">N</span>
      <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">S</span>
      <span className="absolute right-[4px] top-1/2 -translate-y-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">E</span>
      <span className="absolute left-[4px] top-1/2 -translate-y-1/2 text-[8px] font-semibold text-text-muted tracking-[0.04em]">W</span>
      <div
        className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[18px] border-b-blue filter drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]"
        style={{ transform: `rotate(${deg}deg)` }}
      />
    </div>
  )
}

export function LeftPanel() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()
  const m = useSentinelMetrics()
  const { selectedFire, setSelectedFire } = useFireSelection()

  const fires = u?.fires ?? []
  const criticalCount = fires.filter(f => f.frp >= 300).length
  const highCount = fires.filter(f => f.frp >= 100 && f.frp < 300).length
  const moderateCount = fires.filter(f => f.frp < 100).length
  const pm25 = u?.airQuality.pm25 ?? 0
  const frpPct = Math.min((m.frpMax / 1000) * 100, 100)
  const aqiMarkerPos = Math.min(95, (m.aqi / 300) * 100)

  const intensityColor = selectedFire?.intensity === 'critical' ? 'text-red'
    : selectedFire?.intensity === 'high' ? 'text-orange'
    : 'text-amber'
  const intensityBorder = selectedFire?.intensity === 'critical' ? 'border-red/40'
    : selectedFire?.intensity === 'high' ? 'border-orange/40'
    : 'border-amber/40'
  const intensityGlow = selectedFire?.intensity === 'critical'
    ? 'radial-gradient(120% 90% at 50% 0%,rgba(255,51,51,0.18),transparent 70%)'
    : selectedFire?.intensity === 'high'
    ? 'radial-gradient(120% 90% at 50% 0%,rgba(255,126,21,0.18),transparent 70%)'
    : 'radial-gradient(120% 90% at 50% 0%,rgba(251,191,36,0.12),transparent 70%)'

  return (
    <div className="w-80 border-r border-border bg-background/95 backdrop-blur-sm flex flex-col overflow-hidden relative">
      <div className="absolute top-0 -left-20 w-40 h-80 bg-orange/5 blur-[100px] pointer-events-none" />

      <div className="p-[18px] border-b border-border flex items-center bg-surface/30">
        <Label>{selectedFire ? tx.fireDetails : tx.threatAssessment}</Label>
      </div>

      <div className="flex-1 p-[18px] space-y-5 overflow-y-auto scrollbar-none relative z-10">
        {selectedFire ? (
          <>
            {/* Fire ID card */}
            <div
              className={`relative p-[18px] rounded-xl border ${intensityBorder} overflow-hidden`}
              style={{ background: intensityGlow, backgroundColor: '#0d0d0f' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">{tx.fireId}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border ${intensityBorder} ${intensityColor}`}>
                  {selectedFire.intensity === 'critical' ? tx.criticalFires
                    : selectedFire.intensity === 'high' ? tx.highFires
                    : tx.moderateFires}
                </span>
              </div>
              <div className="text-2xl font-black tracking-[0.15em] text-foreground num">{selectedFire.id}</div>
              <div className="mt-1.5 text-[10px] font-mono text-text-muted">
                {selectedFire.lat.toFixed(4)}° / {selectedFire.lon.toFixed(4)}°
              </div>
            </div>

            {/* FRP + Brightness */}
            <div className="sentinel-card sentinel-card-glow-orange p-4">
              <Label>{tx.frpLabel}</Label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">FRP</div>
                  <div className="text-2xl font-black text-orange-soft num leading-none">
                    {selectedFire.frp.toFixed(1)}<span className="text-[10px] font-sans text-text-dim ml-1">MW</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">{tx.brightnessLabel}</div>
                  <div className="text-2xl font-black text-orange-soft num leading-none">
                    {selectedFire.brightness.toFixed(0)}<span className="text-[10px] font-sans text-text-dim ml-1">K</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expansion projection */}
            <div className="sentinel-card p-4">
              <Label>{tx.expansionProj}</Label>
              <div className="mt-3 space-y-0">
                {([
                  { label: '2H', data: selectedFire.expansion2h, color: 'text-red-soft' },
                  { label: '6H', data: selectedFire.expansion6h, color: 'text-orange' },
                  { label: '12H', data: selectedFire.expansion12h, color: 'text-amber' },
                ] as const).map(({ label, data, color }) => (
                  <div key={label} className="flex items-baseline justify-between py-2.5 border-b border-white/5 last:border-0">
                    <span className={`text-[10px] font-black ${color} tracking-widest`}>{label}</span>
                    {data ? (
                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground num">{data.km2} km²</span>
                        <span className="text-[10px] text-text-muted ml-2 num">{data.ha.toLocaleString()} ha</span>
                      </div>
                    ) : (
                      <span className="text-sm text-text-muted">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Wind impact — solo si el foco tiene datos enriquecidos (top 150) */}
            {selectedFire.weather && (
              <div className="sentinel-card p-4">
                <Label>{tx.windImpact}</Label>
                <div className="mt-3 flex items-center gap-4">
                  <WindRose direction={selectedFire.windImpactDir} />
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-foreground num leading-none">
                      {selectedFire.windKmh}<span className="text-[10px] font-sans text-text-dim ml-1">KM/H</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">
                      {tx.spreading} <span className="text-blue font-bold">{selectedFire.windImpactDir}</span>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-surface border border-border-2 rounded text-xs font-mono font-bold text-blue min-w-[45px] text-center">
                    {selectedFire.windImpactDir}
                  </div>
                </div>
              </div>
            )}

            {/* Humidity per fire */}
            {selectedFire.weather?.humidity != null && (
              <div className="flex items-center justify-between px-4 py-3 sentinel-card">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue opacity-70" />
                  <span className="text-[11px] font-bold text-text-dim uppercase tracking-widest">{tx.humidity}</span>
                </div>
                <span className="text-lg font-black text-blue num">{selectedFire.weather.humidity}%</span>
              </div>
            )}

            {/* Deselect */}
            <button
              onClick={() => setSelectedFire(null)}
              className="w-full text-[10px] font-bold text-text-muted hover:text-foreground tracking-widest uppercase py-2 border border-border rounded-lg hover:border-border-2 transition-colors"
            >
              {tx.backToOverview}
            </button>
          </>
        ) : (
          <>
            {/* Risk Level */}
            <div className="relative p-[18px] rounded-xl border border-red/40 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(255,51,51,0.2),transparent_70%)] bg-[#1a0e0f] shadow-[0_15px_35px_-15px_rgba(255,51,51,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-soft">{tx.currentRisk}</span>
                <div className="w-2 h-2 rounded-full bg-red shadow-[0_0_15px_rgba(255,51,51,1)] animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border border-red/50 rounded-lg bg-red/10 flex items-center justify-center text-red shadow-[0_0_15px_rgba(255,51,51,0.2)] shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="text-4xl font-bold tracking-tight text-white leading-none num drop-shadow-[0_0_10px_rgba(255,51,51,0.5)]">
                  {m.riskLevel}
                </div>
              </div>
              {(m.riskLevel === "HIGH" || m.riskLevel === "CRITICAL") && (
                <p className="mt-3 text-[11px] font-semibold text-red-soft tracking-wide">{tx.immediateAction}</p>
              )}
            </div>

            {/* Active fire count by intensity */}
            <div className="sentinel-card p-4">
              <Label right={String(fires.length)}>{tx.activeFireCount}</Label>
              <div className="mt-3 space-y-0">
                {([
                  { label: tx.criticalFires, count: criticalCount, color: 'text-red', dot: '#ff3333', shadow: 'rgba(255,51,51,0.8)' },
                  { label: tx.highFires,     count: highCount,     color: 'text-orange', dot: '#ff7e15', shadow: 'rgba(255,126,21,0.8)' },
                  { label: tx.moderateFires, count: moderateCount, color: 'text-amber', dot: '#fbbf24', shadow: 'rgba(251,191,36,0.6)' },
                ]).map(({ label, count, color, dot, shadow }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dot, boxShadow: `0 0 8px ${shadow}` }} />
                      <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wide">{label}</span>
                    </div>
                    <span className={`text-lg font-black ${color} num`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>


            {/* AQI + PM2.5 */}
            <div className="sentinel-card sentinel-card-glow-red p-4">
              <Label>{tx.airQualityIndex}</Label>
              <div className="mt-4 flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold tracking-tight text-red-soft num drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]">
                    {m.aqi} <span className="text-[10px] text-text-dim font-sans font-bold ml-1 uppercase">AQI</span>
                  </div>
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded border border-red/50 bg-red/10 text-red font-mono uppercase tracking-widest">
                    {tx.aqiUnhealthy}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[linear-gradient(90deg,#10b981_0%,#10b981_22%,#fbbf24_48%,#ff7e15_68%,#ff3333_92%)] relative mt-2 shadow-inner">
                  <div
                    className="absolute top-[-4px] bottom-[-4px] w-[3px] bg-white shadow-[0_0_12px_rgba(255,255,255,1)] rounded-full z-10"
                    style={{ left: `${aqiMarkerPos}%` }}
                  >
                    <div className="absolute bottom-[-6px] left-[-3px] border-[4px] border-transparent border-t-white" />
                  </div>
                </div>
                {pm25 > 0 && (
                  <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{tx.pm25Label}</span>
                    <span className="text-sm font-bold text-text-2 num">{pm25.toFixed(1)} µg/m³</span>
                  </div>
                )}
              </div>
            </div>


            {/* SMS Alert — only on high/critical */}
            {(m.riskLevel === "HIGH" || m.riskLevel === "CRITICAL") && (
              <div className="p-4 bg-[linear-gradient(180deg,rgba(56,189,248,0.15),rgba(56,189,248,0.05))] border border-blue/30 rounded-xl shadow-[0_10px_25px_-10px_rgba(56,189,248,0.2)]">
                <div className="flex items-center gap-2 mb-3 text-[10px] font-bold tracking-[0.2em] text-blue uppercase">
                  <MessageSquare className="h-4 w-4" />
                  <span>{tx.activeBroadcast}</span>
                </div>
                <div className="text-[13px] text-foreground leading-relaxed font-medium">
                  {u?.riskAssessment?.resumen ?? u?.airAlerts?.resumen_general ?? (
                    <>
                      <span className="text-amber font-bold">{tx.wildfireAlert}</span>&nbsp;
                      {tx.evacuationOrder}
                    </>
                  )}
                </div>
                <div className="mt-3.5 text-[10px] font-bold text-text-muted tracking-wide uppercase border-t border-blue/10 pt-3">
                  <span className="num opacity-70">
                    {u?.timestamp
                      ? new Date(u.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
                      : "— UTC"}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
