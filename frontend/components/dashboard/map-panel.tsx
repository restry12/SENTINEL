"use client"
import dynamic from "next/dynamic"

const MapboxPanel = dynamic(
  () => import("./mapbox-panel").then((m) => m.MapboxPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export function MapPanel() {
  return (
    <div className="h-[40vh] md:h-auto md:flex-1 flex flex-col bg-background border-b md:border-b-0 border-border shrink-0">
      <div className="h-10 md:h-12 border-b border-border flex items-center justify-between px-3 md:px-4 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Satellite View</h2>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <MapboxPanel />
      </div>
    </div>
  )
}
