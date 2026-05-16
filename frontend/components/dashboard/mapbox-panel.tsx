"use client"
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useSentinel } from '@/contexts/sentinel-context'

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

// Generate fire expansion ellipse GeoJSON offset in downwind direction.
// windDegFrom: meteorological (wind comes FROM this bearing, 0=N, 90=E...)
// Polygon elongated downwind, center shifts downwind over time.
function makeExpansionPolygon(lat: number, lon: number, windDegFrom: number, windSpeedMs: number, hours: number) {
  const spreadRad = ((windDegFrom + 180) % 360) * (Math.PI / 180)
  const sinD = Math.sin(spreadRad)
  const cosD = Math.cos(spreadRad)
  const cosLat = Math.cos(lat * Math.PI / 180)

  // km → deg: lat 1°≈111km, lon 1°≈111km*cosLat
  const kmToDegLat = 1 / 111
  const kmToDegLon = 1 / (111 * cosLat)

  const windKmh = windSpeedMs * 3.6
  const spreadKm = 1.5 + hours * (1.2 + windKmh * 0.03)
  const offsetKm = hours * windKmh * 0.05

  const centerLat = lat + cosD * offsetKm * kmToDegLat
  const centerLon = lon + sinD * offsetKm * kmToDegLon

  const elongation = 1.8
  const aKm = spreadKm * elongation
  const bKm = spreadKm

  const pts = 48
  const coords: number[][] = []
  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * Math.PI * 2
    const localX = aKm * Math.cos(angle)
    const localY = bKm * Math.sin(angle)
    const rotX = localX * sinD - localY * cosD
    const rotY = localX * cosD + localY * sinD
    coords.push([centerLon + rotX * kmToDegLon, centerLat + rotY * kmToDegLat])
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

const EXP_CONFIG: Record<ExpansionKey, { hours: number; color: string; fillOpacity: number }> = {
  '2h':  { hours: 2,  color: '#f97316', fillOpacity: 0.12 },
  '6h':  { hours: 6,  color: '#fb923c', fillOpacity: 0.09 },
  '12h': { hours: 12, color: '#fbbf24', fillOpacity: 0.06 },
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
        map.flyTo({ center: [inc.lon, inc.lat], zoom: 13, duration: 1200, essential: true })
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

  // Draw expansion polygon for selected fire + active timeframe
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const drawExpansion = () => {
      // Clear previous layer
      if (map.getLayer('exp-active-fill')) map.removeLayer('exp-active-fill')
      if (map.getLayer('exp-active-line')) map.removeLayer('exp-active-line')
      if (map.getSource('exp-active')) map.removeSource('exp-active')

      if (!selectedFire || !activeExpansion) return

      const cfg = EXP_CONFIG[activeExpansion]

      // Prefer backend expansion data if available, otherwise generate from fire coords + wind
      let geoJson: ReturnType<typeof makeExpansionPolygon> | null = null
      const exp = sentinelUpdate?.expansion
      const backendPoly = activeExpansion === '2h' ? exp?.expansion_2h
        : activeExpansion === '6h' ? exp?.expansion_6h
        : exp?.expansion_12h

      if (backendPoly?.coordinates) {
        geoJson = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: backendPoly.coordinates },
        }
      } else {
        const windDeg = sentinelUpdate?.weather?.deg ?? 315
        const windSpeed = sentinelUpdate?.weather?.speed ?? 5
        geoJson = makeExpansionPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeed, cfg.hours)
      }

      map.addSource('exp-active', { type: 'geojson', data: geoJson as any })
      map.addLayer({
        id: 'exp-active-fill', type: 'fill', source: 'exp-active',
        paint: { 'fill-color': cfg.color, 'fill-opacity': cfg.fillOpacity },
      })
      map.addLayer({
        id: 'exp-active-line', type: 'line', source: 'exp-active',
        paint: { 'line-color': cfg.color, 'line-width': 2, 'line-dasharray': [3, 2] },
      })
    }

    if (map.isStyleLoaded()) drawExpansion()
    else map.once('style.load', drawExpansion)
  }, [selectedFire, activeExpansion, sentinelUpdate])

  const expansionOptions: Array<{ key: ExpansionKey; label: string; color: string }> = [
    { key: '2h',  label: '2H',  color: '#f97316' },
    { key: '6h',  label: '6H',  color: '#fb923c' },
    { key: '12h', label: '12H', color: '#fbbf24' },
  ]

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {selectedFire && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md shadow-2xl">
          <span className="px-3 text-[9px] font-mono font-bold tracking-[0.2em] text-white/40 uppercase whitespace-nowrap">
            Expansión {selectedFire.id}
          </span>
          {expansionOptions.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setActiveExpansion(prev => prev === key ? null : key)}
              className="relative px-4 py-2 rounded-lg text-[11px] font-mono font-black tracking-[0.15em] uppercase transition-all duration-200"
              style={{
                color: activeExpansion === key ? '#000' : color,
                background: activeExpansion === key ? color : `${color}15`,
                border: `1px solid ${color}${activeExpansion === key ? 'ff' : '50'}`,
                boxShadow: activeExpansion === key ? `0 0 16px ${color}80` : 'none',
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { setSelectedFire(null); setActiveExpansion(null) }}
            className="ml-1 px-2 py-2 rounded-lg text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
