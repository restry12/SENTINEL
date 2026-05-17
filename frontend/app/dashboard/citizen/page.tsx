"use client"

import { IOSFrame } from "@/components/citizen/ios-frame"
import { CitizenApp } from "@/components/citizen/citizen-app"
import { SentinelProvider } from "@/contexts/sentinel-context"
import { AuthGuard } from "@/components/auth-guard"
import { useIsMobile } from "@/hooks/use-mobile"

export default function CitizenPage() {
  const isMobile = useIsMobile()

  return (
    <AuthGuard>
      <SentinelProvider>
        <div className="h-screen flex items-center justify-center bg-background overflow-hidden">
          {isMobile ? (
            <CitizenApp />
          ) : (
            <div className="scale-90 origin-center">
              <IOSFrame width={402} height={874} dark>
                <CitizenApp />
              </IOSFrame>
            </div>
          )}
        </div>
      </SentinelProvider>
    </AuthGuard>
  )
}
