"use client"

import { useEffect, useRef } from "react"
import { drawFrame } from "./smoke-engine"
import { MOCK_ENV } from "./types"

const TOKEN =
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const SMOKE_SOURCES = [
  { id: "src-a", lng: -71.73, lat: -38.14, intensity: 0.75 },
  { id: "src-b", lng: -72.08, lat: -38.42, intensity: 1.00 },
]

export function AirMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const mapRef          = useRef<any>(null)
  const rafRef          = useRef<number>(0)

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
    // React Strict Mode fires the effect twice; skip second run if map exists
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

    // Lazy-import mapbox-gl so module-level errors don't break the page
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

      function loop() {
        if (cancelled) return

        const { width: w, height: h } = cvs
        const elapsed = performance.now() - start
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
          drawFrame(ctx, sources, MOCK_ENV.wind, elapsed)
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

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        ref={mapContainerRef}
        style={{ position: "absolute", inset: 0 }}
      />
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
