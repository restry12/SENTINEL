"use client"

import { TopBar } from "@/components/dashboard/top-bar"
import { LeftPanel } from "@/components/dashboard/left-panel"
import { MapPanel } from "@/components/dashboard/map-panel"
import { RightPanel } from "@/components/dashboard/right-panel"
import { MetricCards } from "@/components/dashboard/metric-cards"
import { SafeRoute } from "@/components/dashboard/safe-route"
import { InfoSections } from "@/components/dashboard/info-sections"
import { AuthGuard } from "@/components/auth-guard"
import { FireSelectionProvider, useFireSelection } from "@/contexts/fire-selection-context"
import { TacticalNotification } from "@/components/dashboard/tactical-notification"
import { useIsMobile } from "@/hooks/use-mobile"
import { useEffect, useState } from "react"

export default function Dashboard() {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch and ensure we only render one map
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <AuthGuard>
      <FireSelectionProvider>
        {isMobile ? (
          <DashboardContent />
        ) : (
          <div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30 pb-16 md:pb-0">
            <TopBar />
            <div className="grid grid-cols-[320px_1fr_320px] flex-1 min-h-0">
              <LeftPanel />
              <MapPanel />
              <RightPanel />
            </div>
          </div>
        )}
      </FireSelectionProvider>
    </AuthGuard>
  )
}

function DashboardContent() {
  const { selectedFire } = useFireSelection()

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30 pb-16 md:pb-0">
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <MapPanel />
        
        {/* Tactical Alerts (Mobile) */}
        <TacticalNotification />
        
        {/* Mobile Metric HUD - Only visible on small screens when no fire is selected */}
        {!selectedFire && (
          <div className="md:hidden absolute bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-500">
            <MetricCards />
          </div>
        )}

        <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
            <SafeRoute />
            <InfoSections />
          </div>
        </div>
      </div>
    </div>
  )
}
