"use client"
import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import { useSentinel } from "@/contexts/sentinel-context"

const MapboxPanel = dynamic(
  () => import("./mapbox-panel").then((m) => m.MapboxPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

function MapLabel({ label, value }: { label: string, value: string | React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.14em] text-text-dim whitespace-nowrap">
      <span className="text-[9.5px] tracking-[0.2em] uppercase text-text-muted">{label}</span>
      <span className="text-orange-soft font-bold uppercase">{value}</span>
    </div>
  )
}

export function MapPanel() {
  const { sentinelUpdate: u } = useSentinel()
  const fires = u?.fires ?? []

  const criticalFires = fires.filter(f => f.frp > 35).sort((a, b) => b.frp - a.frp)
  const [critIdx, setCritIdx] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(false)
  useEffect(() => {
    if (criticalFires.length < 2) return
    const t = setInterval(() => setCritIdx(i => (i + 1) % criticalFires.length), 2500)
    return () => clearInterval(t)
  }, [criticalFires.length])
  const activeCrit = criticalFires[critIdx]

  const centroid = fires.length > 0
    ? {
        lat: fires.reduce((s, f) => s + f.lat, 0) / fires.length,
        lon: fires.reduce((s, f) => s + f.lon, 0) / fires.length,
      }
    : null
  const latLabel = centroid ? `${Math.abs(centroid.lat).toFixed(2)}° ${centroid.lat < 0 ? "S" : "N"}` : "—"
  const lonLabel = centroid ? `${Math.abs(centroid.lon).toFixed(2)}° ${centroid.lon < 0 ? "W" : "E"}` : "—"

  return (
    <div className="relative flex-1 flex flex-col bg-[#04050a] min-h-0 overflow-hidden">
      {/* Map Header - Refined Sentinel Pass */}
      <header className="relative z-40 h-14 px-[18px] flex items-center justify-between gap-4 border-b border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_80%)] bg-[#0a0b0e/70] backdrop-blur-md shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_8px_rgba(34,197,94,0.7)] animate-pulse" />
            <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-green-soft">Live Feed</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-5">
            <MapLabel label="Lat" value={latLabel} />
            <MapLabel label="Lng" value={lonLabel} />
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 min-w-[140px] cursor-pointer select-none rounded px-1.5 py-0.5 transition-all duration-200 ${showHeatmap ? 'bg-red/10 ring-1 ring-red/40' : 'hover:bg-white/5'}`}
              onClick={() => setShowHeatmap(h => !h)}
              title={showHeatmap ? "Ocultar heatmap de predicción" : "Mostrar heatmap de predicción A6"}
            >
              <div className="w-2 h-2 rounded-full bg-red shadow-[0_0_6px_var(--red)] animate-pulse shrink-0" />
              {activeCrit ? (
                <span className="text-[9.5px] font-bold tracking-[0.1em] text-red uppercase tabular-nums transition-all duration-500">
                  {Math.abs(activeCrit.lat).toFixed(2)}°{activeCrit.lat < 0 ? "S" : "N"}&nbsp;
                  {Math.abs(activeCrit.lon).toFixed(2)}°{activeCrit.lon < 0 ? "W" : "E"}&nbsp;
                  <span className="text-text-dim">|</span>&nbsp;{activeCrit.frp.toFixed(0)}MW
                </span>
              ) : (
                <span className="text-[9.5px] font-bold tracking-[0.14em] text-text-dim uppercase">Critical Fire</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange shadow-[0_0_6px_var(--orange)]" />
              <span className="text-[9.5px] font-bold tracking-[0.14em] text-text-dim uppercase">Active Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-[1px] bg-green-soft" />
              <span className="text-[9.5px] font-bold tracking-[0.14em] text-text-dim uppercase">Evac Route</span>
            </div>
          </div>
        </div>
      </header>

      {/* Map Stage */}
      <div className="flex-1 relative min-h-0 group">
        {/* Deep Space / Aura Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 map-aura" />
          <div className="absolute top-[10%] left-[20%] w-[60%] h-[60%] nebula-glow" style={{ '--color': 'rgba(249, 115, 22, 0.05)', '--x': '30%', '--y': '40%' } as any} />
          <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] nebula-glow" style={{ '--color': 'rgba(59, 130, 246, 0.08)', '--x': '70%', '--y': '60%' } as any} />
        </div>

        {/* Base Layer: Mapbox */}
        <MapboxPanel showHeatmap={showHeatmap} />

        {/* HUD: Grid & Corners */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Refined Grid Overlay */}
          <div className="absolute inset-0 opacity-[0.15] mix-blend-screen bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)_0_0/48px_48px,linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)_0_0/48px_48px]" />
          
          {/* Tactical Corners */}
          <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t border-l border-white/20" />
          <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t border-r border-white/20" />
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b border-l border-white/20" />
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b border-r border-white/20" />

          {/* Floating Data Chips */}
          <div className="absolute top-6 left-6 px-2.5 py-1.5 bg-[#0a0b0e/75] border border-border-2 rounded-sm backdrop-blur-md flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium text-text-2 tracking-wider">
              {fires.length > 0
                ? <>TRACKING <b className="text-foreground font-bold">{fires.length}</b> {fires.length === 1 ? "FIRE" : "FIRES"}</>
                : <b className="text-foreground font-bold">NO ACTIVE FIRES</b>}
            </span>
          </div>

          <div className="absolute bottom-6 right-6 px-2.5 py-1.5 bg-[#0a0b0e/75] border border-border-2 rounded-sm backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-[1px] bg-text-dim/50" />
              <span className="text-[10px] font-mono font-medium text-text-2 tracking-widest uppercase">5.0 KM</span>
            </div>
          </div>

          {/* Central Reticle (Slightly more technical) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
            <div className="w-40 h-40 border border-white/30 rounded-full flex items-center justify-center">
              <div className="w-[1px] h-12 bg-white/40 absolute" />
              <div className="w-12 h-[1px] bg-white/40 absolute" />
            </div>
          </div>
        </div>

        {/* Scanline Overlay (Integrated into Map Stage) */}
        <div className="absolute inset-0 scanline-overlay z-20 opacity-[0.4] mix-blend-overlay" />
      </div>
    </div>
  )
}
