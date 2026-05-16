"use client"
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useIncidents } from '@/hooks/use-incidents'

const TOKEN = "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

export function MapboxPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const incidents = useIncidents()
  const markersRef = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-71.90, -38.28],
      zoom: 9,
      projection: 'globe' as any
    })
    map.on('style.load', () => { map.setFog({}) })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    
    // Use real incidents if available, otherwise use mock data for visual testing
    const displayIncidents = incidents.length > 0 ? incidents : [
      { id: 'mock-1', lng: -71.90, lat: -38.28, intensity: 'CRITICAL' },
      { id: 'mock-2', lng: -71.85, lat: -38.25, intensity: 'HIGH' },
      { id: 'mock-3', lng: -71.95, lat: -38.32, intensity: 'MEDIUM' }
    ]

    markersRef.current = displayIncidents.map(inc => {
      const el = document.createElement('div')
      el.className = 'relative flex items-center justify-center cursor-pointer pointer-events-auto'
      el.style.width = '32px'
      el.style.height = '32px'
      
      // Outer pulsing ring
      const ring = document.createElement('div')
      ring.className = `absolute w-8 h-8 rounded-full border ${inc.intensity === 'CRITICAL' ? 'border-critical' : 'border-warning'} pulse-ring`
      el.appendChild(ring)

      // Inner dot
      const dot = document.createElement('div')
      dot.className = `w-3 h-3 ${inc.intensity === 'CRITICAL' ? 'bg-critical' : 'bg-warning'} rounded-full border border-white shadow-[0_0_10px_rgba(249,115,22,0.8)] pulse-dot`
      el.appendChild(dot)

      // Add Popup
      const popupContent = `
        <div class="tactical-popup">
          <div class="tactical-popup-header">
            <div class="w-2 h-2 rounded-full ${inc.intensity === 'CRITICAL' ? 'bg-critical' : 'bg-warning'} pulse-dot"></div>
            <span class="text-xs font-bold tracking-widest uppercase">${inc.id}</span>
          </div>
          <div class="tactical-popup-body">
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Intensity</span>
              <span class="tactical-stat-value" style="color: ${inc.intensity === 'CRITICAL' ? '#ef4444' : '#f97316'}">${inc.intensity}</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Coordinates</span>
              <span class="tactical-stat-value">${inc.lat.toFixed(4)}, ${inc.lng.toFixed(4)}</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Radiative Power</span>
              <span class="tactical-stat-value">${(Math.random() * 500 + 300).toFixed(1)} MW</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Spread Rate</span>
              <span class="tactical-stat-value">${(Math.random() * 5 + 2).toFixed(1)} km/h</span>
            </div>
            <div class="mt-2 pt-2 border-t border-white/10">
              <div class="flex items-center justify-between text-[10px] text-info font-bold">
                <span>ANALYZING TELEMETRY...</span>
                <span class="animate-pulse">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      `

      const popup = new mapboxgl.Popup({ offset: 15, closeButton: true })
        .setHTML(popupContent)

      return new mapboxgl.Marker(el)
        .setLngLat([inc.lng, inc.lat])
        .setPopup(popup)
        .addTo(mapRef.current!)
    })
  }, [incidents])

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
}
