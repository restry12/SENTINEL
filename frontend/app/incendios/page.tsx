"use client"

import { TopBar } from "@/components/dashboard/top-bar"
import { MapPanel } from "@/components/dashboard/map-panel"
import { AuthGuard } from "@/components/auth-guard"
import { FireSelectionProvider } from "@/contexts/fire-selection-context"
import { TacticalNotification } from "@/components/dashboard/tactical-notification"
import { useSentinel } from "@/contexts/sentinel-context"
import { useEffect, useState } from "react"

export default function IncendiosPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <AuthGuard>
      <FireSelectionProvider>
        <IncendiosContent />
      </FireSelectionProvider>
    </AuthGuard>
  )
}

function IncendiosContent() {
  const { refresh } = useSentinel()

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-background overflow-hidden relative selection:bg-orange/30">
      <TopBar />
      <div className="flex-1 min-h-0 relative flex flex-col">
        <MapPanel />
        <TacticalNotification />
      </div>
    </div>
  )
}
