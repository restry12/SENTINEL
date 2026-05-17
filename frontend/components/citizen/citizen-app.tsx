"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSentinel } from '@/contexts/sentinel-context'
import { CITIZEN_MOCK, type CitizenData, type NaturalRoute, type ScreenRisk } from '@/lib/citizen-mock-data'
import type { SentinelUpdate } from '@/hooks/use-socket'
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

const CITIZEN_ALERT_RADIUS_KM = 0.8

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
): CitizenData {
  const riskLevel = (u?.riskLevel as ScreenRisk) ?? CITIZEN_MOCK.riskLevel
  const user = userLoc
    ? { ...CITIZEN_MOCK.user, lat: userLoc.lat, lon: userLoc.lon }
    : CITIZEN_MOCK.user

  if (!u) {
    const dLat = userLoc ? userLoc.lat - CITIZEN_MOCK.user.lat : 0
    const dLon = userLoc ? userLoc.lon - CITIZEN_MOCK.user.lon : 0
    return {
      ...CITIZEN_MOCK,
      riskLevel,
      user,
      fires: CITIZEN_MOCK.fires.map((f) => ({ ...f, lat: f.lat + dLat, lon: f.lon + dLon })),
    }
  }

  // Real fires — compute distance from user's actual position
  const fires = u.fires.length > 0
    ? u.fires.slice(0, 5).map((f, i) => ({
        id: `F-${String(i + 1).padStart(4, '0')}`,
        lat: f.lat,
        lon: f.lon,
        frp: f.frp,
        dist_km: userLoc ? haversineKm(userLoc.lat, userLoc.lon, f.lat, f.lon) : 0,
      }))
    : CITIZEN_MOCK.fires

  // Real escape routes from the routes agent
  const backendRoutes = u.naturalRoutes?.rutas ?? []
  const naturalRoutes: NaturalRoute[] = backendRoutes.length > 0
    ? backendRoutes.map((r, i) => ({
        id: `R-${String(i + 1).padStart(2, '0')}`,
        label: r.nombre,
        destino: r.destino,
        distancia_km: r.distancia_km,
        bearing_deg: r.bearing_deg ?? u.weather?.deg ?? 0,
        eta_min: r.tiempo_estimado_min,
        estado: r.estado,
        instrucciones: r.instrucciones ? [r.instrucciones] : undefined,
      }))
    : CITIZEN_MOCK.naturalRoutes

  // Real expansion data
  const expansion = u.expansion
    ? {
        direccion_principal_deg: compassToDeg(u.expansion.direccion_principal),
        velocidad_propagacion_kmh: u.expansion.velocidad_propagacion_kmh,
        eta_min: CITIZEN_MOCK.expansion.eta_min,
      }
    : CITIZEN_MOCK.expansion

  // Real weather
  const weather = u.weather
    ? {
        wind_speed_kmh: Math.round(u.weather.speed * 3.6),
        wind_dir_deg: u.weather.deg,
        humidity_pct: u.weather.humidity,
        temp_c: u.weather.temp ?? CITIZEN_MOCK.weather.temp_c,
      }
    : CITIZEN_MOCK.weather

  return { riskLevel, user, fires, naturalRoutes, expansion, weather }
}

export function CitizenApp() {
  const [screen, setScreen] = useState<ScreenState>('locating')
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null)
  const { sentinelUpdate, connected, triggerCitizen } = useSentinel()
  const data = useMemo(() => buildScene(userLoc, sentinelUpdate), [userLoc, sentinelUpdate])

  const handleLocated = useCallback((coords?: { lat: number; lon: number }) => {
    if (coords) {
      setUserLoc(coords)
      triggerCitizen(coords.lat, coords.lon)
      if (!connected) {
        console.warn('[CitizenApp] socket not connected — trigger-citizen not sent')
      }
      if (sentinelUpdate && sentinelUpdate.fires.length > 0) {
        const nearest = nearestFireKm(coords, sentinelUpdate.fires)
        setScreen(nearest <= CITIZEN_ALERT_RADIUS_KM ? 'alert' : 'safe')
      } else {
        setScreen('alert')
      }
    } else {
      setScreen('alert')
    }
  }, [triggerCitizen, connected, sentinelUpdate])

  useEffect(() => {
    if (screen !== 'alert' && screen !== 'safe') return
    if (!userLoc || !sentinelUpdate || sentinelUpdate.fires.length === 0) return
    const nearest = nearestFireKm(userLoc, sentinelUpdate.fires)
    setScreen(nearest <= CITIZEN_ALERT_RADIUS_KM ? 'alert' : 'safe')
  }, [sentinelUpdate, userLoc, screen])

  const route = data.naturalRoutes[0] ?? CITIZEN_MOCK.naturalRoutes[0]

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      {screen === 'locating' && (
        <ScreenLocating
          riskLevel={data.riskLevel}
          onLocated={handleLocated}
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
      {screen === 'safe' && (
        <ScreenSafe
          nearestKm={userLoc && data.fires.length > 0
            ? nearestFireKm(userLoc, data.fires)
            : null}
          weather={data.weather}
          onRefresh={() => setScreen('locating')}
        />
      )}
    </div>
  )
}
