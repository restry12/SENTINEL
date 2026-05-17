"use client"

import { useState } from 'react'
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

function adaptOrMock(u: SentinelUpdate | null): CitizenData {
  if (!u) return CITIZEN_MOCK
  return {
    riskLevel: (u.riskLevel as ScreenRisk) ?? 'critical',
    user: CITIZEN_MOCK.user,
    fires: u.fires.map((f, i) => ({
      id: `F-${i + 1}`,
      lat: f.lat,
      lon: f.lon,
      frp: f.frp,
      dist_km: 0.74 + i * 0.57,
    })),
    weather: {
      wind_speed_kmh: (u.weather.speed ?? 10) * 3.6,
      wind_dir_deg: u.weather.deg ?? 215,
      humidity_pct: u.weather.humidity ?? 14,
      temp_c: u.weather.temp ?? 31,
    },
    naturalRoutes: u.naturalRoutes
      ? u.naturalRoutes.rutas.map((r, i) => ({
          id: r.nombre ?? `R-${i}`,
          label: r.nombre,
          destino: r.destino,
          distancia_km: r.distancia_km,
          bearing_deg: CITIZEN_MOCK.naturalRoutes[i]?.bearing_deg ?? 38,
          eta_min: r.tiempo_estimado_min,
          estado: r.estado === 'LIBRE' ? 'LIBRE' : r.estado === 'CONGESTIONADA' ? 'CONGESTIONADA' : 'BLOQUEADA',
          instrucciones: r.instrucciones?.split?.(/[→·,;]+/)?.map((s: string) => s.trim()).filter(Boolean),
        }))
      : CITIZEN_MOCK.naturalRoutes,
    expansion: u.expansion
      ? {
          direccion_principal_deg: (u.expansion as any).direccion_principal_deg ?? 41,
          velocidad_propagacion_kmh: u.expansion.velocidad_propagacion_kmh,
          eta_min: CITIZEN_MOCK.expansion.eta_min,
        }
      : CITIZEN_MOCK.expansion,
  }
}

export function CitizenApp() {
  const [screen, setScreen] = useState<ScreenState>('locating')
  const { sentinelUpdate } = useSentinel()
  const data = adaptOrMock(sentinelUpdate)
  const route = data.naturalRoutes[0] ?? CITIZEN_MOCK.naturalRoutes[0]

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      {screen === 'locating' && (
        <ScreenLocating
          riskLevel={data.riskLevel}
          onLocated={() => setScreen('alert')}
        />
      )}
      {screen === 'alert' && (
        <ScreenAlert
          riskLevel={data.riskLevel}
          route={route}
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
