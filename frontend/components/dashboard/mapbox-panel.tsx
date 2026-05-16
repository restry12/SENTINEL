"use client"
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { ArrowUp } from 'lucide-react'
import { useSentinel } from '@/contexts/sentinel-context'
import { degToCompass } from '@/lib/utils'

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const FALLBACK_FIRES = [
  { lat: -38.28, lon: -71.90, frp: 480, intensity: 'critical' as const, id: 'FIRE-001' },
  { lat: -38.25, lon: -71.85, frp: 210, intensity: 'high' as const, id: 'FIRE-002' },
  { lat: -38.32, lon: -71.95, frp: 95, intensity: 'medium' as const, id: 'FIRE-003' },
]

type ExpansionKey = '2h' | '6h' | '12h'
interface SelectedFire { lat: number; lon: number; id: string }

// Elliptical fire spread model (simplified Rothermel).
// Fire origin sits at the REAR of the ellipse — spread is clearly one-directional.
// windDegFrom: meteorological bearing fire comes FROM (0=N, 90=E…)
function makeFireSpreadPolygon(
  lat: number, lon: number,
  windDegFrom: number, windSpeedMs: number,
  hours: number
) {
  const windKmh = windSpeedMs * 3.6
  const spreadRad = ((windDegFrom + 180) % 360) * (Math.PI / 180)
  const sinS = Math.sin(spreadRad)  // east component of spread direction
  const cosS = Math.cos(spreadRad)  // north component of spread direction

  // Rate of spread (km/h)
  const ros_forward = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_backing = 0.3
  const ros_flank = Math.sqrt(ros_forward * ros_backing)

  // Distances after `hours`
  const d_forward = ros_forward * hours
  const d_backing = ros_backing * hours
  const d_flank = Math.max(ros_flank * hours, 0.3)

  // Ellipse axes — fire origin at rear focus, not center
  const a = (d_forward + d_backing) / 2
  const b = d_flank
  const center_offset = (d_forward - d_backing) / 2

  const cosLat = Math.cos(lat * Math.PI / 180)
  const kmToDegLat = 1 / 111
  const kmToDegLon = 1 / (111 * cosLat)

  // Shift ellipse center downwind from fire origin
  const centerLat = lat + cosS * center_offset * kmToDegLat
  const centerLon = lon + sinS * center_offset * kmToDegLon

  const coords: number[][] = []
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    const localAlong = a * Math.cos(angle)   // along spread axis
    const localPerp = b * Math.sin(angle)    // perpendicular to spread
    // Rotate to geographic spread direction
    const east = localAlong * sinS + localPerp * (-cosS)
    const north = localAlong * cosS + localPerp * sinS
    coords.push([centerLon + east * kmToDegLon, centerLat + north * kmToDegLat])
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

// Area of spread ellipse in km² (π·a·b), 1 ha = 0.01 km²
function computeFireSpreadArea(windSpeedMs: number, hours: number) {
  const windKmh = windSpeedMs * 3.6
  const ros_f = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_b = 0.3
  const ros_l = Math.sqrt(ros_f * ros_b)
  const a = (ros_f * hours + ros_b * hours) / 2
  const b = Math.max(ros_l * hours, 0.3)
  const km2 = Math.PI * a * b
  return { km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) }
}

const EXP_CONFIG: Record<ExpansionKey, {
  hours: number
  colorCore: string; colorMid: string; colorOuter: string
}> = {
  '2h':  { hours: 2,  colorCore: '#dc2626', colorMid: '#ef4444', colorOuter: '#f87171' },
  '6h':  { hours: 6,  colorCore: '#c2410c', colorMid: '#ea580c', colorOuter: '#fb923c' },
  '12h': { hours: 12, colorCore: '#b45309', colorMid: '#d97706', colorOuter: '#fbbf24' },
}

export function MapboxPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const { sentinelUpdate } = useSentinel()
  const [activeExpansion, setActiveExpansion] = useState<ExpansionKey | null>(null)
  const [selectedFire, setSelectedFire] = useState<SelectedFire | null>(null)

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-71.90, -38.28],
      zoom: 9,
      projection: 'globe' as any,
    })
    map.on('style.load', () => {
      map.setFog({
        'color': 'rgba(56, 189, 248, 0.15)',
        'high-color': 'rgba(10, 11, 14, 0.8)',
        'horizon-blend': 0.2,
        'space-color': 'rgb(2, 2, 5)',
        'star-intensity': 0.9,
      })
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Fire markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(m => m.remove())

    const fires = sentinelUpdate
      ? sentinelUpdate.fires.map((f, i) => ({
          id: `FIRE-${String(i + 1).padStart(3, '0')}`,
          lat: f.lat, lon: f.lon, frp: f.frp,
          intensity: sentinelUpdate.riskLevel,
        }))
      : FALLBACK_FIRES

    markersRef.current = fires.map(inc => {
      const el = document.createElement('div')
      el.className = 'relative flex items-center justify-center cursor-pointer group'
      el.style.width = '32px'
      el.style.height = '32px'

      const isCritical = inc.intensity === 'critical' || inc.frp >= 300
      const color = isCritical ? '#ef4444' : '#f97316'

      const glow = document.createElement('div')
      glow.className = 'absolute inset-0 rounded-full blur-xl opacity-20'
      glow.style.backgroundColor = color
      el.appendChild(glow)

      const ring1 = document.createElement('div')
      ring1.className = 'absolute inset-0 rounded-full border border-current opacity-60'
      ring1.style.color = color
      ring1.style.animation = 'pulse-ring 3s ease-out infinite'
      el.appendChild(ring1)

      const ring2 = document.createElement('div')
      ring2.className = 'absolute inset-0 rounded-full border border-current opacity-40'
      ring2.style.color = color
      ring2.style.animation = 'pulse-ring 3s ease-out 1.5s infinite'
      el.appendChild(ring2)

      const core = document.createElement('div')
      core.className = 'w-3 h-3 rounded-full z-10 flex items-center justify-center relative'
      core.style.backgroundColor = color
      core.style.boxShadow = `0 0 15px ${color}, inset 0 0 5px white`
      const flicker = document.createElement('div')
      flicker.className = 'absolute inset-0 rounded-full bg-white opacity-40'
      flicker.style.animation = 'flicker 0.15s ease-in-out infinite alternate'
      core.appendChild(flicker)
      el.appendChild(core)

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false, anchor: 'bottom' }).setHTML(`
        <div class="tactical-popup">
          <div class="tactical-popup-header">
            <div class="w-1.5 h-1.5 rounded-full pulse-dot" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></div>
            <span class="text-[11px] font-bold tracking-[0.16em] uppercase text-[#f4f5f7]">${inc.id}</span>
          </div>
          <div class="tactical-popup-body">
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Intensity</span>
              <span class="tactical-stat-value" style="color: ${color}">${String(inc.intensity).toUpperCase()}</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Coordinates</span>
              <span class="tactical-stat-value num text-text-2">${inc.lat.toFixed(4)}°, ${inc.lon.toFixed(4)}°</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Power (MW)</span>
              <span class="tactical-stat-value num">${inc.frp.toFixed(1)}</span>
            </div>
          </div>
        </div>
      `)

      el.addEventListener('click', () => {
        map.flyTo({ center: [inc.lon, inc.lat], zoom: 12, duration: 1200, essential: true })
        setSelectedFire({ lat: inc.lat, lon: inc.lon, id: inc.id })
        setActiveExpansion('2h')
      })

      return new mapboxgl.Marker(el)
        .setLngLat([inc.lon, inc.lat])
        .setPopup(popup)
        .addTo(map)
    })

    if (fires.length > 0) {
      const avgLon = fires.reduce((s, f) => s + f.lon, 0) / fires.length
      const avgLat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
      map.easeTo({ center: [avgLon, avgLat], duration: 1200 })
    }
  }, [sentinelUpdate])

  // Fire perimeter + evacuation routes from backend
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sentinelUpdate) return

    const apply = () => {
      const polyId = 'sentinel-polygon'
      if (map.getLayer(polyId + '-fill')) map.removeLayer(polyId + '-fill')
      if (map.getLayer(polyId + '-line')) map.removeLayer(polyId + '-line')
      if (map.getSource(polyId)) map.removeSource(polyId)
      if (sentinelUpdate.polygon?.geometry) {
        map.addSource(polyId, { type: 'geojson', data: sentinelUpdate.polygon as any })
        map.addLayer({ id: polyId + '-fill', type: 'fill', source: polyId, paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.18 } })
        map.addLayer({ id: polyId + '-line', type: 'line', source: polyId, paint: { 'line-color': '#ef4444', 'line-width': 2 } })
      }

      const routeId = 'sentinel-routes'
      if (map.getLayer(routeId)) map.removeLayer(routeId)
      if (map.getSource(routeId)) map.removeSource(routeId)
      const routes = sentinelUpdate.routes ?? []
      if (routes.length > 0) {
        map.addSource(routeId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: routes.map(r => ({ type: 'Feature', properties: {}, geometry: r.geometry })),
          } as any,
        })
        map.addLayer({ id: routeId, type: 'line', source: routeId, paint: { 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.8 } })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [sentinelUpdate])

  // Draw expansion — 3 concentric danger zones + glowing border + direction arrow
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const EXP_LAYER_IDS = [
      'exp-outer-fill', 'exp-outer-glow', 'exp-outer-line',
      'exp-mid-fill',
      'exp-core-fill', 'exp-core-line',
      'exp-arrow',
    ]
    const EXP_SOURCE_IDS = ['exp-outer', 'exp-mid', 'exp-core', 'exp-arrow-src']

    const drawExpansion = () => {
      EXP_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
      EXP_SOURCE_IDS.forEach(id => { if (map.getSource(id)) map.removeSource(id) })

      if (!selectedFire || !activeExpansion) return

      const cfg = EXP_CONFIG[activeExpansion]
      const windDeg = sentinelUpdate?.weather?.deg ?? 315
      const windSpeedMs = sentinelUpdate?.weather?.speed ?? 6.7
      const exp = sentinelUpdate?.expansion
      const backendPoly = activeExpansion === '2h' ? exp?.expansion_2h
        : activeExpansion === '6h' ? exp?.expansion_6h
        : exp?.expansion_12h

      // Outer polygon = full timeframe (or backend data)
      const outerGeo = backendPoly?.coordinates
        ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: backendPoly.coordinates } }
        : makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeedMs, cfg.hours)

      // Mid and core = 55% / 25% of hours (same shape, smaller)
      const midGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeedMs, cfg.hours * 0.55)
      const coreGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeedMs, cfg.hours * 0.25)

      // Direction arrow: fire origin → downwind tip of outer polygon
      const spreadRad = ((windDeg + 180) % 360) * Math.PI / 180
      const sinS = Math.sin(spreadRad)
      const cosS = Math.cos(spreadRad)
      const windKmhVal = windSpeedMs * 3.6
      const ros_f = 0.5 + windKmhVal * 0.15 + windKmhVal * windKmhVal * 0.002
      const tipKm = ros_f * cfg.hours
      const cosLat = Math.cos(selectedFire.lat * Math.PI / 180)
      const tipLon = selectedFire.lon + sinS * tipKm / (111 * cosLat)
      const tipLat = selectedFire.lat + cosS * tipKm / 111

      // Sources
      map.addSource('exp-outer', { type: 'geojson', data: outerGeo as any })
      map.addSource('exp-mid',   { type: 'geojson', data: midGeo   as any })
      map.addSource('exp-core',  { type: 'geojson', data: coreGeo  as any })
      map.addSource('exp-arrow-src', {
        type: 'geojson',
        data: {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [[selectedFire.lon, selectedFire.lat], [tipLon, tipLat]] },
        } as any,
      })

      // Outer glow (wide dim line for bloom effect)
      map.addLayer({ id: 'exp-outer-glow', type: 'line', source: 'exp-outer',
        paint: { 'line-color': cfg.colorOuter, 'line-width': 14, 'line-opacity': 0.08, 'line-blur': 4 } })
      // Outer fill — low opacity danger zone
      map.addLayer({ id: 'exp-outer-fill', type: 'fill', source: 'exp-outer',
        paint: { 'fill-color': cfg.colorOuter, 'fill-opacity': 0.07 } })
      // Outer dashed border
      map.addLayer({ id: 'exp-outer-line', type: 'line', source: 'exp-outer',
        paint: { 'line-color': cfg.colorOuter, 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } })

      // Mid fill — medium intensity
      map.addLayer({ id: 'exp-mid-fill', type: 'fill', source: 'exp-mid',
        paint: { 'fill-color': cfg.colorMid, 'fill-opacity': 0.14 } })

      // Core fill — hottest / most dangerous zone
      map.addLayer({ id: 'exp-core-fill', type: 'fill', source: 'exp-core',
        paint: { 'fill-color': cfg.colorCore, 'fill-opacity': 0.28 } })
      // Core solid glowing border
      map.addLayer({ id: 'exp-core-line', type: 'line', source: 'exp-core',
        paint: { 'line-color': cfg.colorCore, 'line-width': 2.5, 'line-opacity': 0.9 } })

      // Direction arrow — bold line from fire origin to downwind tip
      map.addLayer({ id: 'exp-arrow', type: 'line', source: 'exp-arrow-src',
        paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [6, 4] } })
    }

    if (map.isStyleLoaded()) drawExpansion()
    else map.once('style.load', drawExpansion)
  }, [selectedFire, activeExpansion, sentinelUpdate])

  const expansionOptions: Array<{ key: ExpansionKey; label: string; color: string }> = [
    { key: '2h',  label: '2H',  color: '#ef4444' },
    { key: '6h',  label: '6H',  color: '#ea580c' },
    { key: '12h', label: '12H', color: '#d97706' },
  ]

  // Wind display values
  const windDeg = sentinelUpdate?.weather?.deg ?? 315
  const windSpeed = sentinelUpdate?.weather?.speed ?? 6.7
  const windKmh = Math.round(windSpeed * 3.6)
  const spreadDeg = (windDeg + 180) % 360
  const spreadCardinal = degToCompass(spreadDeg)

  // Pre-compute areas for all timeframes (use backend area_km2 if available, else calculated)
  const exp = sentinelUpdate?.expansion
  const areas: Record<ExpansionKey, { km2: number; ha: number }> = {
    '2h':  exp?.expansion_2h?.area_km2
      ? { km2: exp.expansion_2h.area_km2, ha: Math.round(exp.expansion_2h.area_km2 * 100) }
      : computeFireSpreadArea(windSpeed, 2),
    '6h':  exp?.expansion_6h?.area_km2
      ? { km2: exp.expansion_6h.area_km2, ha: Math.round(exp.expansion_6h.area_km2 * 100) }
      : computeFireSpreadArea(windSpeed, 6),
    '12h': exp?.expansion_12h?.area_km2
      ? { km2: exp.expansion_12h.area_km2, ha: Math.round(exp.expansion_12h.area_km2 * 100) }
      : computeFireSpreadArea(windSpeed, 12),
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Wind indicator */}
      {selectedFire && (
        <div className="absolute top-4 right-4 z-20 flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl backdrop-blur-md"
          style={{
            background: 'rgba(0,0,0,0.78)',
            border: '1px solid rgba(251,146,60,0.25)',
            boxShadow: '0 0 24px rgba(251,146,60,0.08)',
          }}
        >
          <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-white/30 uppercase">Viento</span>
          <ArrowUp
            className="w-7 h-7 text-orange-400"
            style={{ transform: `rotate(${spreadDeg}deg)`, filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.7))' }}
          />
          <span className="text-[13px] font-mono font-black text-orange-400 tracking-widest">{spreadCardinal}</span>
          <span className="text-[11px] font-mono text-white/50">{windKmh} km/h</span>
        </div>
      )}

      {/* Expansion projection toggle */}
      {selectedFire && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl backdrop-blur-md"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.88) 0%, rgba(18,4,4,0.92) 100%)',
            border: '1px solid rgba(239,68,68,0.3)',
            boxShadow: '0 0 40px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Fire badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-mono font-black tracking-[0.18em] text-red-400 uppercase">{selectedFire.id}</span>
              <span className="text-[9px] font-mono text-orange-400/80 mt-0.5">▶ {spreadCardinal} · {windKmh} km/h</span>
            </div>
          </div>

          <div className="w-px h-8 bg-white/10" />

          {/* Timeframe cards */}
          {expansionOptions.map(({ key, label, color }) => {
            const isActive = activeExpansion === key
            const area = areas[key]
            const km2Str = area.km2 >= 1000
              ? `${(area.km2 / 1000).toFixed(1)}k km²`
              : `${area.km2} km²`
            const haStr = area.ha >= 10000
              ? `${Math.round(area.ha / 1000)}k ha`
              : `${area.ha.toLocaleString()} ha`

            return (
              <button
                key={key}
                onClick={() => setActiveExpansion(prev => prev === key ? null : key)}
                className="relative rounded-xl transition-all duration-200 overflow-hidden"
                style={{
                  background: isActive ? `linear-gradient(135deg, ${color}bb, ${color}77)` : 'transparent',
                  border: `1px solid ${isActive ? color : `${color}35`}`,
                  boxShadow: isActive ? `0 0 24px ${color}50, inset 0 1px 0 rgba(255,255,255,0.12)` : 'none',
                  minWidth: isActive ? 140 : 52,
                }}
              >
                {isActive ? (
                  /* Expanded active state — all info visible */
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[15px] font-mono font-black text-white tracking-wider" style={{ textShadow: `0 0 16px ${color}` }}>
                      {label}
                    </span>
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-[11px] font-mono font-black text-white">{km2Str}</span>
                      <span className="text-[10px] font-mono text-white/60">{haStr}</span>
                    </div>
                  </div>
                ) : (
                  /* Compact inactive */
                  <div className="flex items-center justify-center px-4 py-2.5">
                    <span className="text-[13px] font-mono font-black tracking-wider" style={{ color: `${color}99` }}>{label}</span>
                  </div>
                )}
              </button>
            )
          })}

          <div className="w-px h-8 bg-white/10" />

          <button
            onClick={() => { setSelectedFire(null); setActiveExpansion(null) }}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[11px] font-mono text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
