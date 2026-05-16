"use client"
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useSentinel } from '@/contexts/sentinel-context'

const TOKEN = "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const FALLBACK_FIRES = [
  { lat: -38.28, lon: -71.90, frp: 480, intensity: 'critical' as const, id: 'FIRE-001' },
  { lat: -38.25, lon: -71.85, frp: 210, intensity: 'high' as const, id: 'FIRE-002' },
  { lat: -38.32, lon: -71.95, frp: 95, intensity: 'medium' as const, id: 'FIRE-003' },
]

export function MapboxPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const { sentinelUpdate } = useSentinel()

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
          lat: f.lat,
          lon: f.lon,
          frp: f.frp,
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

      return new mapboxgl.Marker(el)
        .setLngLat([inc.lon, inc.lat])
        .setPopup(popup)
        .addTo(map)
    })

    // Recenter on the fires
    if (fires.length > 0) {
      const avgLon = fires.reduce((s, f) => s + f.lon, 0) / fires.length
      const avgLat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
      map.easeTo({ center: [avgLon, avgLat], duration: 1200 })
    }
  }, [sentinelUpdate])

  // Fire polygon + expansion polygons + evacuation routes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sentinelUpdate) return

    const apply = () => {
      // Current perimeter
      const polyId = 'sentinel-polygon'
      if (map.getLayer(polyId + '-fill')) map.removeLayer(polyId + '-fill')
      if (map.getLayer(polyId + '-line')) map.removeLayer(polyId + '-line')
      if (map.getSource(polyId)) map.removeSource(polyId)
      if (sentinelUpdate.polygon?.geometry) {
        map.addSource(polyId, { type: 'geojson', data: sentinelUpdate.polygon as any })
        map.addLayer({ id: polyId + '-fill', type: 'fill', source: polyId, paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.18 } })
        map.addLayer({ id: polyId + '-line', type: 'line', source: polyId, paint: { 'line-color': '#ef4444', 'line-width': 2 } })
      }

      // Expansion forecast (2h / 6h / 12h)
      const exp = sentinelUpdate.expansion
      const expLayers: Array<[string, { coordinates: number[][][] } | undefined, string]> = [
        ['exp-12h', exp?.expansion_12h, '#fbbf24'],
        ['exp-6h', exp?.expansion_6h, '#fb923c'],
        ['exp-2h', exp?.expansion_2h, '#f97316'],
      ]
      for (const [id, poly, color] of expLayers) {
        if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(id)) map.removeSource(id)
        if (poly?.coordinates) {
          map.addSource(id, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: poly.coordinates } } as any,
          })
          map.addLayer({ id, type: 'line', source: id, paint: { 'line-color': color, 'line-width': 1.5, 'line-dasharray': [2, 2] } })
        }
      }

      // Evacuation routes
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

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
}
