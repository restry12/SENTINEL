"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl"
import type { GlacierInfo, AgentResponse } from "@sentinel/types"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

interface Props {
  glaciers: GlacierInfo[]
  selectedGlacierId: string | null
  onGlacierSelect: (id: string) => void
}

export function GlacierMap({ glaciers, selectedGlacierId, onGlacierSelect }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const markersRef = useRef<{ [id: string]: MapboxMarker }>({})
  const mapboxglRef = useRef<any>(null)

  useEffect(() => {
    // Inject Mapbox CSS from CDN
    if (!document.getElementById("mbgl-css")) {
      const link = document.createElement("link")
      link.id = "mbgl-css"
      link.rel = "stylesheet"
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
      document.head.appendChild(link)
    }

    if (!mapContainerRef.current) return
    if (mapRef.current) return

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = TOKEN
      mapboxglRef.current = mapboxgl

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-72.4, -46.5], // Patagonia Central
        zoom: 5,
        attributionControl: false,
      })

      map.on("load", async () => {
        setMapReady(true)
        
        try {
          const res = await fetch("http://localhost:3006/glaciers/risk-grid")
          const result: AgentResponse<any> = await res.json()
          
          if (result.success && result.data) {
            map.addSource("risk-grid", {
              type: "geojson",
              data: result.data
            })

            map.addLayer({
              id: "risk-heatmap",
              type: "heatmap",
              source: "risk-grid",
              maxzoom: 9,
              paint: {
                "heatmap-weight": [
                  "interpolate",
                  ["linear"],
                  ["get", "lastMassChange"],
                  -2000, 1,
                  0, 0
                ],
                "heatmap-intensity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0, 1,
                  9, 3
                ],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "rgba(0,0,255,0)",
                  0.2, "rgba(0,242,255,0.2)",
                  0.4, "rgba(0,242,255,0.5)",
                  0.6, "rgba(255,165,0,0.7)",
                  0.8, "rgba(239,68,68,0.8)",
                  1, "rgba(239,68,68,1)"
                ],
                "heatmap-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0, 5,
                  9, 30
                ],
                "heatmap-opacity": 0.4
              }
            })
          }
        } catch (err) {
          console.error("Error loading risk-grid:", err)
        }
      })

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Handle selectedGlacierId change (flyTo)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedGlacierId) return

    const glacier = glaciers.find(g => g.id === selectedGlacierId)
    if (glacier) {
      map.flyTo({
        center: [glacier.lon, glacier.lat],
        zoom: 11,
        essential: true,
        duration: 2000
      })
    }
  }, [selectedGlacierId, glaciers, mapReady])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxglRef.current
    if (!map || !mapReady || !mapboxgl) return

    // Clear existing markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    glaciers.forEach(g => {
      const isSelected = g.id === selectedGlacierId
      
      const el = document.createElement("div")
      el.className = "glacier-marker"
      
      // Use styles consistent with SENTINEL UI
      Object.assign(el.style, {
        width: isSelected ? "16px" : "10px",
        height: isSelected ? "16px" : "10px",
        borderRadius: "50%",
        backgroundColor: isSelected ? "#00f2ff" : "rgba(0, 242, 255, 0.4)",
        border: "1.5px solid rgba(255,255,255,0.8)",
        boxShadow: isSelected 
          ? "0 0 15px #00f2ff, 0 0 5px #00f2ff" 
          : "0 0 8px rgba(0,242,255,0.3)",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: isSelected ? "10" : "1"
      })

      el.onclick = (e) => {
        e.stopPropagation()
        onGlacierSelect(g.id)
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([g.lon, g.lat])
        .addTo(map)

      markersRef.current[g.id] = marker
    })
  }, [glaciers, mapReady, selectedGlacierId, onGlacierSelect])

  return (
    <div className="absolute inset-0 bg-[#050505]">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Map Overlay for context */}
      <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded flex flex-col gap-1">
          <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Capa de Riesgo</div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500 rounded-full opacity-70" />
            <span className="text-[8px] font-mono text-white/40">Retroceso</span>
          </div>
        </div>
      </div>
    </div>
  )
}
