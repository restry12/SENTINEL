"use client"
import dynamic from "next/dynamic"

const MapboxPanel = dynamic(
  () => import("./mapbox-panel").then((m) => m.MapboxPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export function MapPanel() {
  return (
    <div className="h-[40vh] md:h-auto md:flex-1 flex flex-col bg-background border-b md:border-b-0 border-border shrink-0">
      {/* Tactical Header */}
      <div className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sentinel View
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">38.28°S</span>
            <span className="text-border">|</span>
            <span className="font-mono">71.90°W</span>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 rounded-full bg-warning pulse-dot" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Active Fire</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-2 w-2 md:h-3 md:w-3 border border-dashed border-warning rounded-sm" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Spread Projection</span>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <div className="h-0.5 w-3 md:w-4 bg-safe" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Safe Zones</span>
          </div>
        </div>
      </div>

      {/* Map Container with Overlays */}
      <div className="flex-1 relative overflow-hidden group">
        {/* Base Layer: Functional Mapbox */}
        <MapboxPanel />

        {/* Overlay Layer: Tactical Grid (Pointer events disabled to allow map interaction) */}
        <div className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="tactical-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground" />
              </pattern>
              <pattern id="tactical-grid-large" width="200" height="200" patternUnits="userSpaceOnUse">
                <path d="M 200 0 L 0 0 0 200" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/50" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#tactical-grid)" />
            <rect width="100%" height="100%" fill="url(#tactical-grid-large)" />
          </svg>
        </div>

        {/* HUD Elements */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Sector Label */}
          <div className="absolute top-2 left-2 md:top-4 md:left-4">
            <div className="px-2 py-1 bg-background/60 backdrop-blur-sm border border-border rounded text-[10px] md:text-xs font-mono text-muted-foreground tracking-tighter">
              OPERATIONAL SECTOR: <span className="text-foreground font-bold">ALPHA-01</span>
            </div>
          </div>

          {/* Scale Indicator */}
          <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4">
            <div className="px-2 py-1 md:px-3 md:py-2 bg-background/60 backdrop-blur-sm border border-border rounded">
              <div className="flex items-center gap-2">
                <div className="w-8 md:w-16 h-0.5 bg-foreground" />
                <span className="text-[10px] font-mono text-foreground uppercase tracking-widest">5 KM</span>
              </div>
            </div>
          </div>

          {/* Compass/Crosshair (Minimalist) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20">
            <div className="w-20 h-20 md:w-32 md:h-32 border border-foreground/30 rounded-full flex items-center justify-center">
              <div className="w-1 h-8 bg-foreground/30 absolute" />
              <div className="w-8 h-1 bg-foreground/30 absolute" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
