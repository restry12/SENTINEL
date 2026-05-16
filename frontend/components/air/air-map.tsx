"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { drawFrame } from "./smoke-engine"
import { MOCK_FIRES, MOCK_ENV, MAP_CENTER } from "./types"

function geoWindVec(fromDeg: number): { lat: number; lng: number } {
  const toRad = ((fromDeg + 180) % 360) * (Math.PI / 180)
  return { lat: Math.cos(toRad), lng: Math.sin(toRad) }
}

const FIRE_ICON_HTML = `
  <div style="position:relative;width:16px;height:16px">
    <div style="
      position:absolute;inset:0;border-radius:50%;
      background:radial-gradient(circle at 40% 40%,#ffcc00,#ff6600,#cc2200);
      box-shadow:0 0 10px 3px rgba(255,100,0,.85),0 0 28px 7px rgba(255,50,0,.45);
      animation:sentinelFirePulse 1.2s ease-in-out infinite alternate;
    "></div>
    <div style="
      position:absolute;inset:-10px;border-radius:50%;
      border:1.5px solid rgba(255,100,0,.45);
      animation:sentinelFireRing 2s ease-out infinite;
    "></div>
  </div>`

export function AirMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const rafRef       = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:             [MAP_CENTER.lat, MAP_CENTER.lng],
      zoom:               10,
      zoomControl:        true,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map)

    const wVec = geoWindVec(MOCK_ENV.wind.fromDeg)
    const zones = [
      { radiusKm:  8, color: "#ef4444", opacity: 0.14 },
      { radiusKm: 20, color: "#f97316", opacity: 0.09 },
      { radiusKm: 40, color: "#eab308", opacity: 0.06 },
      { radiusKm: 70, color: "#22c55e", opacity: 0.03 },
    ]

    MOCK_FIRES.forEach(fire => {
      zones.forEach(zone => {
        const offsetKm  = zone.radiusKm * 0.4
        const offsetLat = wVec.lat * offsetKm / 111
        const offsetLng = wVec.lng * offsetKm / (111 * Math.cos(fire.lat * Math.PI / 180))
        L.circle([fire.lat + offsetLat, fire.lng + offsetLng], {
          radius:      zone.radiusKm * 1000,
          color:       "transparent",
          fillColor:   zone.color,
          fillOpacity: zone.opacity * fire.intensity,
        }).addTo(map)
      })
    })

    const fireIcon = L.divIcon({
      html:       FIRE_ICON_HTML,
      className:  "",
      iconSize:   [16, 16],
      iconAnchor: [8, 8],
    })

    MOCK_FIRES.forEach(fire => {
      L.marker([fire.lat, fire.lng], { icon: fireIcon })
        .addTo(map)
        .bindTooltip(fire.name, {
          permanent:  true,
          direction:  "top",
          offset:     [0, -14],
          className:  "sentinel-tooltip",
        })
    })

    mapRef.current = map

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
      drawFrame(ctx, map, MOCK_FIRES, MOCK_ENV.wind, performance.now() - start)
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 450, filter: "blur(1.5px)" }}
      />
    </div>
  )
}
