"use client"

import { TopBar } from "@/components/dashboard/top-bar"
import { MapPanel } from "@/components/dashboard/map-panel"
import { AuthGuard } from "@/components/auth-guard"
import { FireSelectionProvider, useFireSelection } from "@/contexts/fire-selection-context"
import { TacticalNotification } from "@/components/dashboard/tactical-notification"
import { useSentinel } from "@/contexts/sentinel-context"
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
  const { refresh } = useSentinel()

  // Re-fetch latest data each time the user navigates to the dashboard
  // so focos always appear without requiring a full page refresh.
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30">
      <TopBar />

      {/* Main Content Area - Full Screen Map HUD */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        <MapPanel />
        
        {/* Tactical Alerts (Mobile/HUD Overlay) */}
        <TacticalNotification />
        
      </div>
    </div>
  )
}
