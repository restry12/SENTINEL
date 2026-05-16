"use client"

import { useEffect, useRef } from "react"
import { drawFrame, type SmokeSource } from "./smoke-engine"
import { MOCK_ENV } from "./types"

// Visual positions as fractions of container (0–1)
const SOURCE_FRACS = [
  { id: "src-a", xFrac: 0.35, yFrac: 0.30, intensity: 0.75 },
  { id: "src-b", xFrac: 0.57, yFrac: 0.47, intensity: 1.00 },
]

export function AirMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return

    const canvas = canvasRef.current!
    const ctx    = canvas.getContext("2d")!
    const start  = performance.now()

    function resize() {
      canvas.width  = containerRef.current!.clientWidth
      canvas.height = containerRef.current!.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(containerRef.current!)

    function loop() {
      const { width, height } = canvas
      const sources: SmokeSource[] = SOURCE_FRACS.map(s => ({
        id:        s.id,
        x:         s.xFrac * width,
        y:         s.yFrac * height,
        intensity: s.intensity,
      }))
      drawFrame(ctx, sources, MOCK_ENV.wind, performance.now() - start)
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">

      {/* ── Tactical grid background ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="air-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f1f1f" strokeWidth="0.5" />
          </pattern>
          <pattern id="air-grid-lg" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#2a2a2a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#air-grid)" />
        <rect width="100%" height="100%" fill="url(#air-grid-lg)" />

        {/* AQI impact zones — drifted SE (wind from NW) */}
        <ellipse cx="52%" cy="42%" rx="30%" ry="18%" fill="#ef4444" fillOpacity="0.06" />
        <ellipse cx="48%" cy="39%" rx="22%" ry="13%" fill="#f97316" fillOpacity="0.07" />
        <ellipse cx="43%" cy="36%" rx="14%" ry="8%"  fill="#ef4444" fillOpacity="0.09" />

        {/* Emission source markers */}
        <circle cx="35%" cy="30%" r="4" fill="none" stroke="#737373" strokeWidth="0.8" strokeDasharray="2,2" />
        <circle cx="35%" cy="30%" r="1.5" fill="#737373" />
        <circle cx="57%" cy="47%" r="5" fill="none" stroke="#737373" strokeWidth="0.8" strokeDasharray="2,2" />
        <circle cx="57%" cy="47%" r="2" fill="#737373" />
      </svg>

      {/* Zone label */}
      <div className="absolute top-4 left-4 z-10">
        <div className="px-2 py-1 bg-card/80 border border-border rounded text-xs font-mono text-muted-foreground">
          ZONA AQI — MONITOREO ACTIVO
        </div>
      </div>

      {/* Scale */}
      <div className="absolute bottom-16 right-4 z-10">
        <div className="px-3 py-2 bg-card/90 border border-border rounded">
          <div className="flex items-center gap-2">
            <div className="w-16 h-0.5 bg-foreground" />
            <span className="text-xs font-mono text-foreground">5 km</span>
          </div>
        </div>
      </div>

      {/* Smoke canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10, filter: "blur(1.5px)" }}
      />
    </div>
  )
}
