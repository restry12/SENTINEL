"use client"

import { TopBar } from "@/components/dashboard/top-bar"
import { LeftPanel } from "@/components/dashboard/left-panel"
import { MapPanel } from "@/components/dashboard/map-panel"
import { RightPanel } from "@/components/dashboard/right-panel"
import { MetricCards } from "@/components/dashboard/metric-cards"
import { SafeRoute } from "@/components/dashboard/safe-route"
import { InfoSections } from "@/components/dashboard/info-sections"
import { AuthGuard } from "@/components/auth-guard"
import { FireSelectionProvider } from "@/contexts/fire-selection-context"

export default function Dashboard() {
  return (
    <AuthGuard>
    <FireSelectionProvider>
    <div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30 pb-16 md:pb-0">
      <TopBar />

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[320px_1fr_320px] flex-1 min-h-0">
        <LeftPanel />
        <MapPanel />
        <RightPanel />
      </div>

      {/* Mobile */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <MapPanel />
        </div>
        <MetricCards />
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          <SafeRoute />
          <InfoSections />
        </div>
      </div>
    </div>
    </FireSelectionProvider>
    </AuthGuard>
  )
}
