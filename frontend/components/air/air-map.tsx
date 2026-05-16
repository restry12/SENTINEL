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
  const wrapperRef     = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const rafRef         = useRef<number>(0)

  useEffect(() => {
    if (!wrapperRef.current || !mapContainerRef.current || !canvasRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style:     "mapbox://styles/mapbox/satellite-streets-v12",
      center:    [-71.90, -38.28],
      zoom:      9,
      attributionControl: false,
    })

    const canvas = canvasRef.current
    const ctx    = canvas.getContext("2d")!
    const start  = performance.now()

    function resize() {
      canvas.width  = wrapperRef.current!.clientWidth
      canvas.height = wrapperRef.current!.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrapperRef.current!)

    function loop() {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const elapsed = performance.now() - start

      // AQI impact halos around each emission source
      SMOKE_SOURCES.forEach(src => {
        const px = map.project([src.lng, src.lat])
        const r  = 110 * src.intensity
        const g  = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, r * 2.8)
        g.addColorStop(0,   `rgba(239,68,68,${(0.13 * src.intensity).toFixed(3)})`)
        g.addColorStop(0.45,`rgba(249,115,22,${(0.08 * src.intensity).toFixed(3)})`)
        g.addColorStop(1,   "rgba(239,68,68,0)")
        ctx.beginPath()
        ctx.arc(px.x, px.y, r * 2.8, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      })

      // Smoke puffs (pixel coords derived from geo coords each frame)
      const sources = SMOKE_SOURCES.map(src => {
        const px = map.project([src.lng, src.lat])
        return { id: src.id, x: px.x, y: px.y, intensity: src.intensity }
      })
      drawFrame(ctx, sources, MOCK_ENV.wind, elapsed)

      rafRef.current = requestAnimationFrame(loop)
    }

    map.on("load", () => loop())

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      map.remove()
    }
  }, [])

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <div ref={mapContainerRef} className="absolute inset-0" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10, filter: "blur(1.5px)" }}
      />
    </div>
  )
}
