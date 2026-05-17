"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TopBar } from "@/components/dashboard/top-bar"
import { TornadoLeftPanel } from "@/components/tornado/tornado-left-panel"
import { TornadoRightPanel } from "@/components/tornado/tornado-right-panel"
import { TORNADO_CELLS } from "@/components/tornado/world-tornado-map"
import type { TornadoCell } from "@/components/tornado/world-tornado-map"
import { MobileDrawer } from "@/components/ui/mobile-drawer"

const WorldTornadoMap = dynamic(
  () => import("@/components/tornado/world-tornado-map").then(m => m.WorldTornadoMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function TornadoPage() {
  return <AuthGuard><TornadoPageInner /></AuthGuard>
}

function TornadoPageInner() {
  const [selectedCell, setSelectedCell] = useState<TornadoCell | null>(null)

  const handleCellSelect = useCallback((cell: TornadoCell) => {
    setSelectedCell(cell)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedCell(null)
  }, [])

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">

        {/* Map (fills entire area) */}
        <WorldTornadoMap
          selectedCell={selectedCell}
          onCellSelect={handleCellSelect}
        />

        {/* Left panel */}
        <div className="hidden md:block">
          <TornadoLeftPanel
            cells={TORNADO_CELLS}
            selectedCell={selectedCell}
            onCellSelect={handleCellSelect}
            onBack={handleBack}
          />
        </div>

        {/* Right panel */}
        <div className="hidden md:block">
          <TornadoRightPanel selectedCell={selectedCell} />
        </div>

        {/* EF Scale Legend */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-1 bg-[#0a0b0e]/85 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-2xl">
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/30 mr-2">Escala EF</span>
            {[
              { color: "#22c55e", label: "EF0", range: "Bajo" },
              { color: "#eab308", label: "EF1", range: "Mod." },
              { color: "#f97316", label: "EF2", range: "Alto" },
              { color: "#ef4444", label: "EF3", range: "Ext." },
              { color: "#a855f7", label: "EF4+", range: "Conf." },
            ].map(({ color, label, range }) => (
              <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: `${color}18` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
                <span className="text-[9px] font-bold text-white">{label}</span>
                <span className="text-[8px] text-white/40 font-mono">{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MOBILE DRAWER ── */}
        <MobileDrawer title="Monitoreo de Tornados" triggerLabel="Ver celdas">
          <TornadoLeftPanel
            cells={TORNADO_CELLS}
            selectedCell={selectedCell}
            onCellSelect={handleCellSelect}
            onBack={handleBack}
          />
          <TornadoRightPanel selectedCell={selectedCell} />
        </MobileDrawer>

      </main>
    </div>
  )
}
