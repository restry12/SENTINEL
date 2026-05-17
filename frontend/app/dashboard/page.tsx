"use client"

import { TopBar } from "@/components/dashboard/top-bar"
import { MapPanel } from "@/components/dashboard/map-panel"
import { AuthGuard } from "@/components/auth-guard"
import { FireSelectionProvider, useFireSelection } from "@/contexts/fire-selection-context"
import { TacticalNotification } from "@/components/dashboard/tactical-notification"
import { MetricCards } from "@/components/dashboard/metric-cards"
import { useEffect, useState } from "react"

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <AuthGuard>
      <FireSelectionProvider>
        <DashboardContent />
      </FireSelectionProvider>
    </AuthGuard>
  )
}

function DashboardContent() {
  const { selectedFire } = useFireSelection()

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30">
      <TopBar />

      {/* Main Content Area - Full Screen Map HUD */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <MapPanel />
        
        {/* Tactical Alerts (Mobile/HUD Overlay) */}
        <TacticalNotification />
        
        {/* Mobile Metric HUD - Only visible on small screens when no fire is selected */}
        {!selectedFire && (
          <div className="md:hidden absolute bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-500">
            <MetricCards />
          </div>
        )}
      </div>
    </div>
  )
}
