"use client"

import { useMemo, useState } from 'react'
import { useSentinel } from '@/contexts/sentinel-context'
import { CITIZEN_MOCK, type CitizenData, type ScreenRisk } from '@/lib/citizen-mock-data'
import type { SentinelUpdate } from '@/hooks/use-socket'
import {
  ScreenLocating,
  ScreenAlert,
  ScreenTrappedConfirm,
  ScreenTrappedLive,
} from './screens'
import { SentinelCompass } from './sentinel-compass'

type ScreenState = 'locating' | 'alert' | 'compass' | 'trapped_confirm' | 'trapped_live'

// Builds the citizen scene. The demo scenario (fires, route, propagation) is
// coherent and compact; when the citizen's real GPS position is known, the
// whole scene is re-anchored around it (fires keep their relative offset; the
// route and propagation are already computed relative to the user). Until the
// backend can serve fires/routes for an arbitrary location, the fire/route
// geometry stays mock — only the user position and risk level are live.
function buildScene(
  userLoc: { lat: number; lon: number } | null,
  u: SentinelUpdate | null,
): CitizenData {
  const riskLevel = (u?.riskLevel as ScreenRisk) ?? CITIZEN_MOCK.riskLevel
  if (!userLoc) return { ...CITIZEN_MOCK, riskLevel }

  const dLat = userLoc.lat - CITIZEN_MOCK.user.lat
  const dLon = userLoc.lon - CITIZEN_MOCK.user.lon
  return {
    ...CITIZEN_MOCK,
    riskLevel,
    user: { ...CITIZEN_MOCK.user, lat: userLoc.lat, lon: userLoc.lon },
    fires: CITIZEN_MOCK.fires.map((f) => ({ ...f, lat: f.lat + dLat, lon: f.lon + dLon })),
  }
}

export function CitizenApp() {
  const [screen, setScreen] = useState<ScreenState>('locating')
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null)
  const { sentinelUpdate } = useSentinel()
  const data = useMemo(() => buildScene(userLoc, sentinelUpdate), [userLoc, sentinelUpdate])
  const route = data.naturalRoutes[0] ?? CITIZEN_MOCK.naturalRoutes[0]

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      {screen === 'locating' && (
        <ScreenLocating
          riskLevel={data.riskLevel}
          onLocated={(coords) => {
            if (coords) setUserLoc(coords)
            setScreen('alert')
          }}
        />
      )}
      {screen === 'alert' && (
        <ScreenAlert
          riskLevel={data.riskLevel}
          route={route}
          user={data.user}
          fires={data.fires}
          expansion={data.expansion}
          onCompass={() => setScreen('compass')}
          onTrapped={() => setScreen('trapped_confirm')}
        />
      )}
      {screen === 'compass' && (
        <SentinelCompass
          onClose={() => setScreen('alert')}
          route={route}
          userHeading={data.user.heading_deg}
        />
      )}
      {screen === 'trapped_confirm' && (
        <ScreenTrappedConfirm
          onCancel={() => setScreen('alert')}
          onConfirm={() => setScreen('trapped_live')}
        />
      )}
      {screen === 'trapped_live' && (
        <ScreenTrappedLive
          onRecall={() => setScreen('alert')}
        />
      )}
    </div>
  )
}
