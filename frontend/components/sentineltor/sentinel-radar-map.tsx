"use client"

import { useEffect, useRef } from "react"
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const COLORS = {
  user: "#3b82f6",
  tornado: "#ef4444",
  swath: "rgba(239, 68, 68, 0.2)",
  shelter: "#22c55e",
} as const

interface SentinelRadarMapProps {
  size?: number | string
  user: { lat: number; lon: number }
  tornado: {
    lat: number
    lon: number
    intensity: string
    speed_kmh: number
    bearing_deg: number
  }
  shelter: { lat: number; lon: number; name: string }
}

// Destination-point formula — given start, bearing and distance, returns the
// geographic point reached travelling along a great-circle path.
function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): { lat: number; lon: number } {
  const R = 6371
  const d = distanceKm / R
  const theta = (bearingDeg * Math.PI) / 180
  const phi1 = (lat * Math.PI) / 180
  const lambda1 = (lon * Math.PI) / 180

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(theta),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2),
    )

  return { lat: (phi2 * 180) / Math.PI, lon: (lambda2 * 180) / Math.PI }
}

// Swath polygon - projected path of the tornado. Creates a tapering/widening
// path along the bearing to represent the danger zone.
function createSwath(
  origin: { lat: number; lon: number },
  bearingDeg: number,
  lengthKm: number,
  widthKm: number,
): [number, number][] {
  const leftBearing = (bearingDeg - 90 + 360) % 360
  const rightBearing = (bearingDeg + 90) % 360

  const p1 = destinationPoint(origin.lat, origin.lon, leftBearing, widthKm / 2)
  const p2 = destinationPoint(origin.lat, origin.lon, rightBearing, widthKm / 2)

  const endCenter = destinationPoint(origin.lat, origin.lon, bearingDeg, lengthKm)
  const p3 = destinationPoint(endCenter.lat, endCenter.lon, rightBearing, widthKm / 0.7)
  const p4 = destinationPoint(endCenter.lat, endCenter.lon, leftBearing, widthKm / 0.7)

  return [
    [p1.lon, p1.lat],
    [p2.lon, p2.lat],
    [p3.lon, p3.lat],
    [p4.lon, p4.lat],
    [p1.lon, p1.lat],
  ]
}

function pointSource(lon: number, lat: number) {
  return {
    type: "geojson" as const,
    data: {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
    },
  }
}

function makeLabelEl(text: string, color: string): HTMLDivElement {
  const el = document.createElement("div")
  el.textContent = text
  Object.assign(el.style, {
    fontFamily: "monospace",
    fontSize: "9px",
    fontWeight: "700",
    letterSpacing: "0.1em",
    color,
    background: "rgba(10,10,10,0.85)",
    padding: "2px 6px",
    border: `1px solid ${color}66`,
    borderRadius: "2px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
  } as CSSStyleDeclaration)
  return el
}

export function SentinelRadarMap({ user, tornado, shelter }: SentinelRadarMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<MapboxMarker[]>([])
  const pulseRafRef = useRef<number>(0)

  useEffect(() => {
    if (!document.getElementById("mbgl-css")) {
      const link = document.createElement("link")
      link.id = "mbgl-css"
      link.rel = "stylesheet"
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
      document.head.appendChild(link)
    }

    const el = mapContainerRef.current
    if (!el) return
    if (mapRef.current) return

    let cancelled = false

    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled) return

        mapboxgl.accessToken = TOKEN

        const map = new mapboxgl.Map({
          container: el,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [user.lon, user.lat],
          zoom: 12.5,
          pitch: 40,
          attributionControl: false,
        })
        mapRef.current = map

        map.on("load", () => {
          if (cancelled) return

          // ── Tornado Swath (Projected Path) ───────────────────────────────
          const swath = createSwath(tornado, tornado.bearing_deg, 8, 1.5)
          map.addSource("tornado-swath", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [swath] },
            },
          })
          map.addLayer({
            id: "tornado-swath-fill",
            type: "fill",
            source: "tornado-swath",
            paint: {
              "fill-color": COLORS.tornado,
              "fill-opacity": 0.12,
            },
          })
          map.addLayer({
            id: "tornado-swath-outline",
            type: "line",
            source: "tornado-swath",
            paint: {
              "line-color": COLORS.tornado,
              "line-width": 1.5,
              "line-dasharray": [3, 2],
              "line-opacity": 0.4,
            },
          })

          // ── Tornado Visuals ──────────────────────────────────────────────
          map.addSource("pt-tornado", pointSource(tornado.lon, tornado.lat))
          map.addLayer({
            id: "tornado-glow",
            type: "circle",
            source: "pt-tornado",
            paint: {
              "circle-radius": 45,
              "circle-color": COLORS.tornado,
              "circle-opacity": 0.15,
              "circle-blur": 2,
            },
          })
          map.addLayer({
            id: "tornado-pulse",
            type: "circle",
            source: "pt-tornado",
            paint: {
              "circle-radius": 12,
              "circle-color": COLORS.tornado,
              "circle-opacity": 0,
              "circle-stroke-width": 2.5,
              "circle-stroke-color": COLORS.tornado,
              "circle-stroke-opacity": 0.8,
            },
          })
          map.addLayer({
            id: "tornado-core",
            type: "circle",
            source: "pt-tornado",
            paint: {
              "circle-radius": 10,
              "circle-color": COLORS.tornado,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          })

          // ── User Position ────────────────────────────────────────────────
          map.addSource("pt-user", pointSource(user.lon, user.lat))
          map.addLayer({
            id: "pt-user",
            type: "circle",
            source: "pt-user",
            paint: {
              "circle-radius": 8,
              "circle-color": COLORS.user,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          })

          // ── Shelter Position ─────────────────────────────────────────────
          map.addSource("pt-shelter", pointSource(shelter.lon, shelter.lat))
          map.addLayer({
            id: "pt-shelter",
            type: "circle",
            source: "pt-shelter",
            paint: {
              "circle-radius": 8,
              "circle-color": COLORS.shelter,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          })

          // Pulse animation loop
          const pulseStart = performance.now()
          const animatePulse = () => {
            if (cancelled || !mapRef.current) return
            const t = ((performance.now() - pulseStart) % 2000) / 2000
            const radius = 12 + t * 50
            const opacity = 0.8 * (1 - t)
            if (map.getLayer("tornado-pulse")) {
              map.setPaintProperty("tornado-pulse", "circle-radius", radius)
              map.setPaintProperty("tornado-pulse", "circle-stroke-opacity", opacity)
            }
            pulseRafRef.current = requestAnimationFrame(animatePulse)
          }
          animatePulse()

          // ── Labels ───────────────────────────────────────────────────────
          markersRef.current.push(
            new mapboxgl.Marker({ element: makeLabelEl("YO", COLORS.user), offset: [0, 20] })
              .setLngLat([user.lon, user.lat])
              .addTo(map),
          )
          markersRef.current.push(
            new mapboxgl.Marker({
              element: makeLabelEl(`${tornado.intensity}`, COLORS.tornado),
              offset: [0, -32],
            })
              .setLngLat([tornado.lon, tornado.lat])
              .addTo(map),
          )
          markersRef.current.push(
            new mapboxgl.Marker({ element: makeLabelEl("REFUGIO", COLORS.shelter), offset: [0, 20] })
              .setLngLat([shelter.lon, shelter.lat])
              .addTo(map),
          )
        })
      })
      .catch((err) => console.error("[SentinelRadarMap] Mapbox load failed:", err))

    return () => {
      cancelled = true
      cancelAnimationFrame(pulseRafRef.current)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [user, tornado, shelter])

  if (!user || !tornado || !shelter) {
    return (
      <div 
        className="flex items-center justify-center bg-[#0a0a0a] rounded-xl border border-white/10 text-zinc-500 font-mono text-xs uppercase tracking-widest" 
        style={{ width: "100%", height: "100%", minHeight: "400px" }}
      >
        Waiting for telemetry...
      </div>
    )
  }

  return (
    <div
      ref={mapContainerRef}
      className="rounded-xl overflow-hidden border border-white/10 shadow-2xl relative"
      style={{ width: "100%", height: "100%", minHeight: "400px", background: "#0a0a0a" }}
    >
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-white/20">
        <div className="text-[10px] font-bold text-white/50 uppercase tracking-tighter mb-0.5">Radar Mode</div>
        <div className="text-xs font-mono text-emerald-400">ACTIVE_SCAN</div>
      </div>
    </div>
  )
}
