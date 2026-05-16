"use client"

import { TopBar } from "@/components/dashboard/top-bar"
import { LeftPanel } from "@/components/dashboard/left-panel"
import { MapPanel } from "@/components/dashboard/map-panel"
import { RightPanel } from "@/components/dashboard/right-panel"
import { MetricCards } from "@/components/dashboard/metric-cards"
import { SafeRoute } from "@/components/dashboard/safe-route"
import { InfoSections } from "@/components/dashboard/info-sections"

export default function Dashboard() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30">
      {/* Top Bar */}
      <TopBar />
      
      {/* Desktop Layout: Refined 3-Column Grid */}
      <div className="hidden md:grid grid-cols-[320px_1fr_320px] flex-1 min-h-0">
        <LeftPanel />
        <MapPanel />
        <RightPanel />
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <MapPanel />
        </div>
        
        {/* Mobile Horizontal Metrics */}
        <MetricCards />
        
        {/* Mobile Content Stack */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          <SafeRoute />
          <InfoSections />
        </div>
      </div>
    </div>
  )
}
