"use client"
import dynamic from "next/dynamic"
import { useState, useCallback, useRef } from "react"
import { Loader2 } from "lucide-react"
import { useSentinel } from "@/contexts/sentinel-context"
import type { FireRiskRegionMap, FireRiskRegion, RegionDetail } from "@/hooks/use-socket"
import { FireDetailOverlay } from "./fire-detail-overlay"
import { FireRiskCellPanel } from "./fire-risk-cell-panel"
import { SituationalOverlay } from "./situational-overlay"
import { TacticalExpansionWidget } from "./tactical-expansion-widget"

const MapboxPanel = dynamic(
  () => import("./mapbox-panel").then((m) => m.MapboxPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export function MapPanel() {
  const { sentinelUpdate: u } = useSentinel()
  const fires = u?.fires ?? []
  const [activeExpansion, setActiveExpansion] = useState<'2h' | '6h' | '12h' | null>(null)

  const [showGrid, setShowGrid] = useState(false)
  const [riskMap, setRiskMap] = useState<FireRiskRegionMap | null>(null)
  const [gridLoading, setGridLoading] = useState(false)
  const [gridError, setGridError] = useState<string | null>(null)

  const [selectedRegion, setSelectedRegion] = useState<FireRiskRegion | null>(null)
  const [regionDetail, setRegionDetail] = useState<RegionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const toggleGrid = useCallback(async () => {
    const next = !showGrid
    setShowGrid(next)
    if (next && !riskMap && !gridLoading) {
      setGridLoading(true)
      setGridError(null)
      try {
        const res = await fetch('/api/risk-grid')
        const data = await res.json()
        if (data.ok) setRiskMap(data.grid as FireRiskRegionMap)
        else setGridError(data.error ?? 'Error al cargar el mapa de riesgo')
      } catch {
        setGridError('Backend inalcanzable')
      } finally {
        setGridLoading(false)
      }
    }
  }, [showGrid, riskMap, gridLoading])

  const handleRegionClick = useCallback(async (region: FireRiskRegion) => {
    const reqId = ++requestIdRef.current
    setSelectedRegion(region)
    setRegionDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const res = await fetch('/api/cell-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region_id: region.id,
          nombre: region.nombre,
          score: region.score,
          category: region.category,
          factors: region.factors,
        }),
      })
      const data = await res.json()
      if (reqId !== requestIdRef.current) return
      if (data.ok) setRegionDetail(data.detail as RegionDetail)
      else setDetailError('No se pudo cargar el detalle de la región')
    } catch {
      if (reqId === requestIdRef.current) setDetailError('No se pudo cargar el detalle de la región')
    } finally {
      if (reqId === requestIdRef.current) setDetailLoading(false)
    }
  }, [])

  return (
    <div className="relative flex-1 flex flex-col bg-[#04050a] min-h-0 overflow-hidden">
      <div className="flex-1 relative min-h-0 group">
        {/* Deep Space / Aura Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 map-aura" />
          <div className="absolute top-[10%] left-[20%] w-[60%] h-[60%] nebula-glow" style={{ '--color': 'rgba(249, 115, 22, 0.05)', '--x': '30%', '--y': '40%' } as any} />
          <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] nebula-glow" style={{ '--color': 'rgba(59, 130, 246, 0.08)', '--x': '70%', '--y': '60%' } as any} />
        </div>

        {/* Base Layer: Mapbox */}
        <MapboxPanel
          riskMap={showGrid ? riskMap : null}
          onRegionClick={handleRegionClick}
          activeExpansion={activeExpansion}
          setActiveExpansion={setActiveExpansion}
        />

        {/* Fire Details Overlay — hidden in Fire Risk Grid mode */}
        {!showGrid && <FireDetailOverlay />}

        {/* Fire Risk Region Panel */}
        <FireRiskCellPanel
          region={selectedRegion}
          detail={regionDetail}
          loading={detailLoading}
          detailError={detailError}
          onClose={() => { setSelectedRegion(null); setRegionDetail(null); setDetailLoading(false); setDetailError(null) }}
        />

        {/* Situational Intelligence Overlay — hidden in Fire Risk Grid mode */}
        {!showGrid && <SituationalOverlay />}

        {/* Tactical Expansion HUD (Fixed Right side) — hidden in Fire Risk Grid mode */}
        {!showGrid && (
          <TacticalExpansionWidget
            activeExpansion={activeExpansion}
            onExpansionChange={(k) => setActiveExpansion(prev => prev === k ? null : k)}
          />
        )}

        {/* HUD: Grid & Corners */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-0 opacity-[0.15] mix-blend-screen bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)_0_0/48px_48px,linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)_0_0/48px_48px]" />
          <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t border-l border-white/20" />
          <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t border-r border-white/20" />
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b border-l border-white/20" />
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b border-r border-white/20" />
          <div className="absolute top-6 left-6 px-2.5 py-1.5 bg-[#0f172a] border border-border-2 rounded-sm backdrop-blur-md flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium text-text-2 tracking-wider">
              {fires.length > 0
                ? <>TRACKING <b className="text-foreground font-bold">{fires.length}</b> {fires.length === 1 ? "FIRE" : "FIRES"}</>
                : <b className="text-foreground font-bold">NO ACTIVE FIRES</b>}
            </span>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
            <div className="w-40 h-40 border border-white/30 rounded-full flex items-center justify-center">
              <div className="w-[1px] h-12 bg-white/40 absolute" />
              <div className="w-12 h-[1px] bg-white/40 absolute" />
            </div>
          </div>
        </div>

        {/* Fire Risk Grid toggle (floating control) */}
        <button
          onClick={toggleGrid}
          title={showGrid ? "Ocultar Fire Risk Grid" : "Mostrar Fire Risk Grid"}
          className={`absolute top-6 right-6 z-30 flex items-center gap-2 px-2.5 py-1.5 rounded-md backdrop-blur-md transition-all duration-200 ${
            showGrid
              ? "bg-red/12 border border-red/45 shadow-[0_0_14px_rgba(255,51,51,0.18)]"
              : "bg-[#0f172a] border border-border-2 hover:border-red/40"
          }`}
        >
          {gridLoading
            ? <Loader2 className="w-2.5 h-2.5 animate-spin text-red" />
            : <div className={`w-2 h-2 rounded-full bg-red shadow-[0_0_6px_var(--red)] ${showGrid ? "animate-pulse" : "opacity-60"}`} />}
          <span className={`text-[9.5px] font-bold tracking-[0.14em] uppercase ${showGrid ? "text-red" : "text-text-dim"}`}>
            Fire Risk Grid
          </span>
        </button>

        {/* Grid load error */}
        {gridError && showGrid && (
          <div className="absolute top-16 right-6 z-30 px-2.5 py-1.5 rounded-md bg-red/15 border border-red/40 backdrop-blur-md">
            <span className="text-[9px] font-bold uppercase tracking-wider text-red">{gridError}</span>
          </div>
        )}

        {/* Scanline Overlay */}
        <div className="absolute inset-0 scanline-overlay z-20 opacity-[0.4] mix-blend-overlay" />
      </div>
    </div>
  )
}
