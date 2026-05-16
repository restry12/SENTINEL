"use client"

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import { drawFrame } from "./smoke-engine"
import { MOCK_ENV } from "./types"

mapboxgl.accessToken =
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const SMOKE_SOURCES = [
  { id: "src-a", lng: -71.73, lat: -38.14, intensity: 0.75 },
  { id: "src-b", lng: -72.08, lat: -38.42, intensity: 1.00 },
]

export function AirMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const rafRef          = useRef<number>(0)

  useEffect(() => {
    // Capture DOM nodes early — refs go null on unmount but the nodes stay valid
    const el  = mapContainerRef.current
    const cvs = canvasRef.current
    if (!el || !cvs) return

    const ctx   = cvs.getContext("2d")!
    const start = performance.now()

    const map = new mapboxgl.Map({
      container: el,
      style:     "mapbox://styles/mapbox/satellite-streets-v12",
      center:    [-71.90, -38.28],
      zoom:      9,
      attributionControl: false,
    })

    // Use the canvas element's own CSS dimensions (w-full h-full)
    function syncSize() {
      cvs.width  = cvs.offsetWidth
      cvs.height = cvs.offsetHeight
    }
    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(cvs)

    function loop() {
      const w = cvs.width
      const h = cvs.height
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const elapsed = performance.now() - start
      ctx.clearRect(0, 0, w, h)

      // AQI halo around each emission source
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

      const sources = SMOKE_SOURCES.map(src => {
        const px = map.project([src.lng, src.lat])
        return { id: src.id, x: px.x, y: px.y, intensity: src.intensity }
      })
      drawFrame(ctx, sources, MOCK_ENV.wind, elapsed)

      rafRef.current = requestAnimationFrame(loop)
    }

    // Start immediately — map.project() works as soon as the map is instantiated
    loop()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      map.remove()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="absolute inset-0" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 10, filter: "blur(1.5px)" }}
      />
    </div>
  )
}
