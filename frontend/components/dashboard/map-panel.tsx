"use client"

import dynamic from "next/dynamic"
import { useSocket } from "@/hooks/use-socket"

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-background animate-pulse" />,
  }
)

export function MapPanel() {
  const { hotspots, connected } = useSocket()

  return (
    <div className="h-[40vh] md:h-auto md:flex-1 flex flex-col bg-background border-b md:border-b-0 border-border shrink-0">
      {/* Map Header */}
      <div className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Map
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">34.05°N</span>
            <span className="text-border">|</span>
            <span className="font-mono">118.24°W</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full transition-colors ${
                connected ? "bg-safe" : "bg-muted-foreground"
              }`}
            />
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Fire</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 border border-dashed border-warning rounded-sm" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Spread</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-0.5 w-3 md:w-4 bg-safe" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Evac</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        <LeafletMap hotspots={hotspots} />

        {/* Sector label overlay */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4 z-[1000] pointer-events-none">
          <div className="px-2 py-1 bg-card/80 border border-border rounded text-xs font-mono text-muted-foreground">
            SECTOR 7A
          </div>
        </div>

        {/* Scale bar overlay */}
        <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 z-[1000] pointer-events-none">
          <div className="px-2 py-1 md:px-3 md:py-2 bg-card/90 border border-border rounded">
            <div className="flex items-center gap-2">
              <div className="w-8 md:w-16 h-0.5 bg-foreground" />
              <span className="text-xs font-mono text-foreground">5 km</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
