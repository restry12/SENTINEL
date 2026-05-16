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
    
    map.on('style.load', () => { 
      map.setFog({
        color: 'rgb(7, 8, 10)', // Matches --background
        'high-color': 'rgb(16, 17, 21)', // Matches --surface
        'horizon-blend': 0.15,
        'space-color': 'rgb(2, 2, 3)',
        'star-intensity': 0.8 // More intense stars for that orbital feel
      })
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    
    const displayIncidents = incidents.length > 0 ? incidents : [
      { id: 'FIRE-001', lng: -71.90, lat: -38.28, intensity: 'CRITICAL', label: 'Cedar Ridge' },
      { id: 'FIRE-002', lng: -71.85, lat: -38.25, intensity: 'HIGH', label: 'Bío-Bío' },
      { id: 'FIRE-003', lng: -71.95, lat: -38.32, intensity: 'MEDIUM', label: 'Araucanía' }
    ]

    markersRef.current = displayIncidents.map(inc => {
      const el = document.createElement('div')
      el.className = 'relative flex items-center justify-center cursor-pointer group'
      el.style.width = '32px'
      el.style.height = '32px'
      
      const isCritical = inc.intensity === 'CRITICAL'
      const color = isCritical ? '#ef4444' : '#f97316'
      
      // Marker Glow (Atmospheric)
      const glow = document.createElement('div')
      glow.className = 'absolute inset-0 rounded-full blur-xl opacity-20'
      glow.style.backgroundColor = color
      el.appendChild(glow)

      // Outer pulsing rings (Tactical refined)
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

      // Fire Core (Flickering)
      const core = document.createElement('div')
      core.className = 'w-3 h-3 rounded-full z-10 flex items-center justify-center relative'
      core.style.backgroundColor = color
      core.style.boxShadow = `0 0 15px ${color}, inset 0 0 5px white`
      
      const flicker = document.createElement('div')
      flicker.className = 'absolute inset-0 rounded-full bg-white opacity-40'
      flicker.style.animation = 'flicker 0.15s ease-in-out infinite alternate'
      core.appendChild(flicker)
      
      el.appendChild(core)

      const popupContent = `
        <div class="tactical-popup">
          <div class="tactical-popup-header">
            <div class="w-1.5 h-1.5 rounded-full pulse-dot" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></div>
            <span class="text-[11px] font-bold tracking-[0.16em] uppercase text-[#f4f5f7]">${inc.id}</span>
          </div>
          <div class="tactical-popup-body">
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Intensity</span>
              <span class="tactical-stat-value" style="color: ${color}">${inc.intensity}</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Coordinates</span>
              <span class="tactical-stat-value num text-text-2">${inc.lat.toFixed(4)}°, ${inc.lng.toFixed(4)}°</span>
            </div>
            <div class="tactical-stat-row">
              <span class="tactical-stat-label">Power (MW)</span>
              <span class="tactical-stat-value num">${(Math.random() * 500 + 300).toFixed(1)}</span>
            </div>
            <div class="mt-2.5 pt-2 border-t border-border">
              <div class="flex items-center justify-between text-[9px] font-bold tracking-widest text-blue uppercase">
                <span>Telemetry Status</span>
                <span class="animate-pulse">Active</span>
              </div>
            </div>
          </div>
        </div>
      `

      const popup = new mapboxgl.Popup({ 
        offset: 12, 
        closeButton: false,
        anchor: 'bottom'
      }).setHTML(popupContent)

      return new mapboxgl.Marker(el)
        .setLngLat([inc.lng, inc.lat])
        .setPopup(popup)
        .addTo(mapRef.current!)
    })
  }, [incidents])

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
}
