"use client"

import { useEffect, useRef } from "react"
import type { Map as MapboxMap } from "mapbox-gl"
import { drawFrame }         from "./smoke-engine"
import { MOCK_INFRASTRUCTURE, type WindData } from "./types"

const TOKEN =
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const SMOKE_SOURCES = [
  { id: "src-a", lng: -71.73, lat: -38.14, intensity: 0.75 },
  { id: "src-b", lng: -72.08, lat: -38.42, intensity: 1.00 },
]

const INFRA_COLORS = { hospital: "#ef4444", school: "#f97316", emergency: "#3b82f6" } as const

interface Props { wind: WindData }

export function AirMap({ wind }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const mapRef          = useRef<MapboxMap | null>(null)
  const rafRef          = useRef<number>(0)
  const windRef         = useRef<WindData>(wind)

  // Keep wind ref current so the RAF loop always uses latest wind
  useEffect(() => { windRef.current = wind }, [wind])

  useEffect(() => {
    // Inject Mapbox CSS from CDN — bypasses any Turbopack resolution issues
    if (!document.getElementById("mbgl-css")) {
      const link = document.createElement("link")
      link.id   = "mbgl-css"
      link.rel  = "stylesheet"
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
      document.head.appendChild(link)
    }

    const el  = mapContainerRef.current
    const cvs = canvasRef.current
    if (!el || !cvs) return
    if (mapRef.current) return

    let cancelled = false
    const ctx     = cvs.getContext("2d")!
    const start   = performance.now()

    cvs.width  = window.innerWidth
    cvs.height = window.innerHeight

    const onResize = () => {
      cvs.width  = window.innerWidth
      cvs.height = window.innerHeight
    }
    window.addEventListener("resize", onResize)

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return

      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style:     "mapbox://styles/mapbox/satellite-streets-v12",
        center:    [-71.90, -38.28],
        zoom:      9,
        attributionControl: false,
      })
      mapRef.current = map

      // Add infrastructure markers when map style loads
      map.on("load", () => {
        MOCK_INFRASTRUCTURE.forEach(infra => {
          const dot = document.createElement("div")
          const col = INFRA_COLORS[infra.type]
          Object.assign(dot.style, {
            width:           "10px",
            height:          "10px",
            backgroundColor: col,
            border:          "1.5px solid rgba(255,255,255,0.8)",
            borderRadius:    "50%",
            boxShadow:       `0 0 8px ${col}90, 0 0 2px ${col}`,
            cursor:          "pointer",
          })
          new mapboxgl.Marker({ element: dot })
            .setLngLat([infra.lng, infra.lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 12, closeButton: false })
                .setHTML(
                  `<div style="font-family:monospace;font-size:10px;color:#e8e6e0;background:#0a0a0a;padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1)">${infra.name}</div>`
                )
            )
            .addTo(map)
        })
      })

      function loop() {
        if (cancelled) return

        const w           = cvs!.width
        const h           = cvs!.height
        const elapsed     = performance.now() - start
        const currentWind = windRef.current

        ctx.clearRect(0, 0, w, h)

        if (map.loaded()) {
          // AQI impact halos
          SMOKE_SOURCES.forEach(src => {
            const px = map.project([src.lng, src.lat])
            const r  = 110 * src.intensity
            const g  = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, r * 2.8)
            g.addColorStop(0,    `rgba(239,68,68,${(0.13 * src.intensity).toFixed(3)})`)
            g.addColorStop(0.45, `rgba(249,115,22,${(0.08 * src.intensity).toFixed(3)})`)
            g.addColorStop(1,    "rgba(239,68,68,0)")
            ctx.beginPath()
            ctx.arc(px.x, px.y, r * 2.8, 0, Math.PI * 2)
            ctx.fillStyle = g
            ctx.fill()
          })

          // Smoke puffs
          const sources = SMOKE_SOURCES.map(src => {
            const px = map.project([src.lng, src.lat])
            return { id: src.id, x: px.x, y: px.y, intensity: src.intensity }
          })
          drawFrame(ctx, sources, currentWind, elapsed)
        }

        rafRef.current = requestAnimationFrame(loop)
      }

      loop()
    }).catch(err => console.error("[AirMap] mapbox-gl load failed:", err))

    return () => {
      cancelled = true
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(rafRef.current)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const hospitals = MOCK_INFRASTRUCTURE.filter(i => i.type === "hospital").length
  const schools   = MOCK_INFRASTRUCTURE.filter(i => i.type === "school").length

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Infrastructure at-risk count overlay */}
      <div
        className="absolute font-mono flex flex-col gap-1.5"
        style={{ bottom: 56, left: 16, zIndex: 20 }}
      >
        <div className="px-2 py-1 bg-black/75 backdrop-blur-sm border border-red-500/40 rounded-sm text-[10px] text-red-400 whitespace-nowrap">
          ⚠ {hospitals} Hospital — AQI impact zone
        </div>
        <div className="px-2 py-1 bg-black/75 backdrop-blur-sm border border-orange-500/40 rounded-sm text-[10px] text-orange-400 whitespace-nowrap">
          ⚠ {schools} Schools — elevated AQI
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          position:      "absolute",
          inset:         0,
          width:         "100%",
          height:        "100%",
          zIndex:        10,
          filter:        "blur(1.5px)",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
