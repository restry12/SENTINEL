'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import type { Glacier } from '@/lib/glacier-types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  'pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg'

function riskColor(riesgo: number): string {
  if (riesgo >= 76) return '#ff3333'
  if (riesgo >= 51) return '#f97316'
  if (riesgo >= 26) return '#38bdf8'
  return '#10b981'
}

interface Props {
  glaciers: Glacier[]
  selected: Glacier | null
  onSelect: (g: Glacier) => void
}

export function GlacierMap({ glaciers, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<{ remove: () => void }[]>([])
  const onSelectRef = useRef(onSelect)
  const [showBasins, setShowBasins] = useState(true)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return
    let cancelled = false

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled) return
      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-71, -38],
        zoom: 4.2,
        minZoom: 3,
        maxZoom: 14,
        attributionControl: false,
      })
      mapRef.current = map

      map.on('style.load', () => {
        map.setFog({
          'color': 'rgba(56, 189, 248, 0.1)',
          'high-color': 'rgba(10, 11, 14, 0.9)',
          'horizon-blend': 0.15,
          'space-color': 'rgb(2, 2, 5)',
          'star-intensity': 0.8,
        } as never)

        map.getStyle().layers?.forEach(layer => {
          if (layer.type !== 'symbol') return
          try { map.setPaintProperty(layer.id, 'text-color', '#ffffff') } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0,0,0,0.7)') } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, 'text-halo-width', 1.5) } catch { /* skip */ }
        })
      })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || glaciers.length === 0) return

    const waitForLoad = () => {
      if (!map.loaded()) {
        map.once('load', waitForLoad)
        return
      }
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      import('mapbox-gl').then(({ default: mapboxgl }) => {
        glaciers.forEach(g => {
          const color = riskColor(g.riesgo)
          const isSelected = selected?.id === g.id

          const el = document.createElement('div')
          el.style.cssText = 'cursor:pointer;position:relative;'
          el.innerHTML = `
            <svg width="28" height="28" viewBox="-14 -14 28 28" style="overflow:visible;filter:drop-shadow(0 0 ${isSelected ? 8 : 4}px ${color}${isSelected ? '' : '88'})">
              ${isSelected ? `<circle r="14" fill="${color}" opacity="0.2"/>` : ''}
              <rect x="-7" y="-7" width="14" height="14" rx="1" transform="rotate(45)" fill="${color}" opacity="${isSelected ? 1 : 0.85}" stroke="#fff" stroke-width="${isSelected ? 1.5 : 0.8}"/>
            </svg>
            <div style="position:absolute;top:16px;left:14px;white-space:nowrap;font-family:'Geist Mono',monospace;font-size:9px;font-weight:700;color:${color};text-shadow:0 1px 3px #000;letter-spacing:0.06em;pointer-events:none;">
              ${g.name.replace('Glaciar ', '').toUpperCase()}
            </div>
          `

          el.addEventListener('click', () => onSelectRef.current(g))

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([g.lon, g.lat])
            .addTo(map)

          markersRef.current.push(marker)
        })
      })
    }

    waitForLoad()
  }, [glaciers, selected?.id])

  useEffect(() => {
    if (!selected || !mapRef.current) return
    mapRef.current.flyTo({
      center: [selected.lon, selected.lat],
      zoom: 9,
      duration: 1800,
      essential: true,
    })
  }, [selected?.id])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0a0d14]/90 backdrop-blur border border-white/10 text-[9px] font-bold tracking-widest text-blue uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" />
          Criosfera · Chile
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <button
          onClick={() => setShowBasins(s => !s)}
          className={`px-2.5 py-1 rounded-full backdrop-blur border text-[9px] font-bold tracking-widest uppercase transition-colors ${showBasins ? 'bg-blue/10 border-blue/30 text-blue' : 'bg-[#0a0d14]/80 border-white/10 text-white/40'}`}
        >
          Cuencas
        </button>
        <span className="px-2.5 py-1 rounded-full bg-[#0a0d14]/80 backdrop-blur border border-white/10 text-[9px] font-mono text-white/40">
          SAT · SENTINEL-2
        </span>
      </div>

      <div className="absolute bottom-4 left-3 z-10 bg-[#0a0d14]/90 backdrop-blur border border-white/10 rounded-lg p-3">
        <p className="text-[8px] font-bold tracking-widest text-white/40 uppercase mb-2">Índice de Riesgo</p>
        {[
          { color: '#10b981', label: '0–25 · Estable' },
          { color: '#38bdf8', label: '26–50 · Observación' },
          { color: '#f97316', label: '51–75 · Riesgo Alto' },
          { color: '#ff3333', label: '76–100 · Crítico' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="w-2 h-2 rounded-sm rotate-45 inline-block" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono text-white/60">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
