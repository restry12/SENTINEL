"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSentinel } from '@/contexts/sentinel-context'
import { CITIZEN_MOCK, type CitizenData, type NaturalRoute, type ScreenRisk } from '@/lib/citizen-mock-data'
import type { SentinelUpdate, NaturalRoutes } from '@/hooks/use-socket'
import {
  ScreenLocating,
  ScreenAlert,
  ScreenTrappedConfirm,
  ScreenTrappedLive,
  ScreenSafe,
} from './screens'
import { SentinelCompass } from './sentinel-compass'

type ScreenState = 'locating' | 'alert' | 'compass' | 'trapped_confirm' | 'trapped_live' | 'safe'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestFireKm(
  userLoc: { lat: number; lon: number },
  fires: { lat: number; lon: number }[],
): number {
  if (fires.length === 0) return Infinity
  return Math.min(...fires.map((f) => haversineKm(userLoc.lat, userLoc.lon, f.lat, f.lon)))
}

const CITIZEN_ALERT_RADIUS_KM = 3.0

// TEMP: Mock fire for testing (disabled for production)
const INJECT_TEST_FIRE = false 

function compassToDeg(s: string): number {
  const map: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSO: 202.5, SO: 225, OSO: 247.5, O: 270, ONO: 292.5, NO: 315, NNO: 337.5,
    SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5, SSW: 202.5,
  }
  return map[s.trim().toUpperCase()] ?? 0
}

// Builds the citizen scene from real sentinelUpdate data when available,
// falling back to mock data field-by-field so the UI always has something to show.
function buildScene(
  userLoc: { lat: number; lon: number } | null,
  u: SentinelUpdate | null,
  citizenRoutes: NaturalRoutes | null = null,
): CitizenData {
  const riskLevel = (u?.riskLevel as ScreenRisk) ?? 'low'
  const user = userLoc
    ? { ...CITIZEN_MOCK.user, lat: userLoc.lat, lon: userLoc.lon }
    : CITIZEN_MOCK.user

  if (!u) {
    return {
      ...CITIZEN_MOCK,
      riskLevel,
      user,
      fires: [], // No mock fires by default
      naturalRoutes: [],
    }
  }

  // Real fires — empty if none found
  let fires = u.fires.map((f, i) => ({
    id: `F-${String(i + 1).padStart(4, '0')}`,
    lat: f.lat,
    lon: f.lon,
    frp: f.frp,
    dist_km: userLoc ? haversineKm(userLoc.lat, userLoc.lon, f.lat, f.lon) : 0,
  }))

  if (INJECT_TEST_FIRE && userLoc) {
    // Inject a fire 0.5km to the North
    const testFire = {
      id: 'F-TEST',
      lat: userLoc.lat + 0.0045, // approx 0.5km
      lon: userLoc.lon,
      frp: 50.0,
      dist_km: 0.5
    }
    fires = [testFire, ...fires]
  }

  // Real escape routes
  const backendRoutes = citizenRoutes?.rutas ?? u?.naturalRoutes?.rutas ?? []
  const naturalRoutes: NaturalRoute[] = backendRoutes.map((r, i) => ({
    id: `R-${String(i + 1).padStart(2, '0')}`,
    label: r.nombre,
    destino: r.destino,
    distancia_km: r.distancia_km,
    bearing_deg: r.bearing_deg ?? u.weather?.deg ?? 0,
    eta_min: r.tiempo_estimado_min,
    estado: r.estado,
    instrucciones: r.instrucciones ? [r.instrucciones] : undefined,
  }))

  // Real expansion data
  const expansion = u.expansion
    ? {
        direccion_principal_deg: compassToDeg(u.expansion.direccion_principal),
        velocidad_propagacion_kmh: u.expansion.velocidad_propagacion_kmh,
        eta_min: 0,
      }
    : { direccion_principal_deg: 0, velocidad_propagacion_kmh: 0, eta_min: 0 }

  // Real weather — prioritize local weather from the routes agent
  const rawWeather = citizenRoutes?.weather ?? u?.weather
  const weather = rawWeather
    ? {
        wind_speed_kmh: Math.round((rawWeather.speed ?? 0) * 3.6),
        wind_dir_deg: rawWeather.deg ?? 0,
        humidity_pct: rawWeather.humidity ?? 0,
        temp_c: rawWeather.temp ?? 20,
      }
    : { wind_speed_kmh: 0, wind_dir_deg: 0, humidity_pct: 0, temp_c: 20 }

  return { riskLevel, user, fires, naturalRoutes, expansion, weather }
}

export function CitizenApp() {
  const [screen, setScreen] = useState<ScreenState>('locating')
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null)
  const demoActiveRef = useRef(false)
  const { sentinelUpdate, connected, triggerCitizen, citizenRoutes } = useSentinel()
  const data = useMemo(
    () => buildScene(userLoc, sentinelUpdate, citizenRoutes),
    [userLoc, sentinelUpdate, citizenRoutes],
  )

  const handleLocated = useCallback((coords?: { lat: number; lon: number }) => {
    if (coords) {
      setUserLoc(coords)
      triggerCitizen(coords.lat, coords.lon)
      if (!connected) {
        console.warn('[CitizenApp] socket not connected — trigger-citizen not sent')
      }
      // Screen decision will be handled by the useEffect below
    } else {
      setScreen('safe')
    }
  }, [triggerCitizen, connected])

  const handleDemo = useCallback(async (): Promise<string> => {
    let phone: string | undefined
    try {
      const raw = localStorage.getItem('sentinel_user')
      if (raw) phone = (JSON.parse(raw) as { phone?: string }).phone
    } catch { /* ignore */ }
    if (!phone) return 'no_phone'
    try {
      await fetch('/api/trigger/citizen-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, lat: -38.5, lon: -72.0 }),
      })
    } catch { /* backend responds via SMS */ }
    demoActiveRef.current = true
    setScreen('alert')
    return 'ok'
  }, [])

  useEffect(() => {
    if (demoActiveRef.current) return
    if (screen !== 'alert' && screen !== 'safe' && screen !== 'locating') return
    if (!userLoc) return

    const nearest = nearestFireKm(userLoc, data.fires)
    const nextScreen = nearest <= CITIZEN_ALERT_RADIUS_KM ? 'alert' : 'safe'
    if (nextScreen !== screen) setScreen(nextScreen)
  }, [data.fires, userLoc, screen])

  const route = data.naturalRoutes[0] ?? {
    id: 'R-00',
    label: 'Calculando ruta...',
    destino: 'Esperando datos del sistema',
    distancia_km: 0,
    bearing_deg: 0,
    eta_min: 0,
    estado: 'LIBRE'
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      {screen === 'locating' && (
        <ScreenLocating
          riskLevel={data.riskLevel}
          onLocated={handleLocated}
          onDemo={handleDemo}
        />
      )}
      {screen === 'alert' && (
        <ScreenAlert
          riskLevel={data.riskLevel}
          route={route}
          user={data.user}
          fires={data.fires}
          expansion={data.expansion}
          weather={data.weather}
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
          user={data.user}
          onRecall={() => setScreen('alert')}
        />
      )}
      {screen === 'safe' && (
        <ScreenSafe
          nearestKm={userLoc && data.fires.length > 0
            ? nearestFireKm(userLoc, data.fires)
            : null}
          weather={data.weather}
          onRefresh={() => setScreen('locating')}
          onDemo={handleDemo}
        />
      )}
    </div>
  )
}
