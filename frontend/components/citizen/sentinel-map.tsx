"use client"

import { useEffect, useRef } from "react"
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

const COLORS = { user: "#3b82f6", fire: "#ef4444", safe: "#22c55e" } as const

interface SentinelMapProps {
  size?: number
  user: { lat: number; lon: number }
  fires: { id: string; lat: number; lon: number; frp: number }[]
  route: { bearing_deg: number; distancia_km: number; destino: string; label: string }
  expansion: { direccion_principal_deg: number; velocidad_propagacion_kmh: number }
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

// Teardrop propagation ring — a closed polygon around the fire that reaches
// fully downwind (along `dirDeg`) and tapers upwind. Conveys spread direction.
function propagationRing(
  origin: { lat: number; lon: number },
  dirDeg: number,
  reachKm: number,
): [number, number][] {
  const ring: [number, number][] = []
  const N = 64
  for (let i = 0; i <= N; i++) {
    const bearing = (i / N) * 360
    const align = (Math.cos(((bearing - dirDeg) * Math.PI) / 180) + 1) / 2
    const radius = reachKm * (0.34 + 0.66 * align)
    const p = destinationPoint(origin.lat, origin.lon, bearing, radius)
    ring.push([p.lon, p.lat])
  }
  return ring
}

// A GeoJSON Point source descriptor.
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

// Small text-only label. Placed via a DOM marker with a pixel offset — text
// does not need pixel-perfect anchoring, so a DOM marker is fine here.
function makeLabelEl(text: string, color: string): HTMLDivElement {
  const el = document.createElement("div")
  el.textContent = text
  Object.assign(el.style, {
    fontFamily: "monospace",
    fontSize: "8.5px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    color,
    background: "rgba(10,10,10,0.7)",
    padding: "1px 4px",
    borderRadius: "3px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
  } as CSSStyleDeclaration)
  return el
}

export function SentinelMap({ size = 360, user, fires, route, expansion }: SentinelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<MapboxMarker[]>([])
  const pulseRafRef = useRef<number>(0)

  useEffect(() => {
    // Inject Mapbox CSS from CDN — bypasses any Turbopack resolution issues
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

    const dest = destinationPoint(
      user.lat,
      user.lon,
      route.bearing_deg,
      route.distancia_km,
    )

    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled) return

        mapboxgl.accessToken = TOKEN

        const map = new mapboxgl.Map({
          container: el,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [user.lon, user.lat],
          zoom: 14,
          attributionControl: false,
        })
        mapRef.current = map

        map.on("load", () => {
          if (cancelled) return

          // ── Fire propagation alert zones (+2H / +6H / +12H) ──────────────
          // Teardrop shapes oriented along the real propagation bearing.
          const fire0 = fires[0]
          if (fire0) {
            const dir = expansion.direccion_principal_deg
            const zones = [
              { id: "exp-12h", reach: 0.98, fill: "rgba(239,68,68,0.10)", line: "rgba(239,68,68,0.32)", label: "+12H" },
              { id: "exp-6h",  reach: 0.62, fill: "rgba(239,68,68,0.17)", line: "rgba(239,68,68,0.50)", label: "+6H"  },
              { id: "exp-2h",  reach: 0.32, fill: "rgba(239,68,68,0.32)", line: "#ef4444",              label: "+2H"  },
            ]
            zones.forEach((z) => {
              const ring = propagationRing(fire0, dir, z.reach)
              map.addSource(z.id, {
                type: "geojson",
                data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } },
              })
              map.addLayer({ id: `${z.id}-fill`, type: "fill", source: z.id, paint: { "fill-color": z.fill } })
              map.addLayer({
                id: `${z.id}-line`, type: "line", source: z.id,
                paint: { "line-color": z.line, "line-width": 1, "line-dasharray": [2, 2] },
              })
              const tip = destinationPoint(fire0.lat, fire0.lon, dir, z.reach)
              markersRef.current.push(
                new mapboxgl.Marker({ element: makeLabelEl(z.label, "rgba(252,165,165,0.95)") })
                  .setLngLat([tip.lon, tip.lat])
                  .addTo(map),
              )
            })
          }

          // ── Escape route line: user → safe destination ───────────────────
          map.addSource("escape-route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: [[user.lon, user.lat], [dest.lon, dest.lat]] },
            },
          })
          map.addLayer({
            id: "escape-route-glow", type: "line", source: "escape-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": COLORS.safe, "line-width": 10, "line-opacity": 0.25, "line-blur": 4 },
          })
          map.addLayer({
            id: "escape-route-line", type: "line", source: "escape-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": COLORS.safe, "line-width": 3 },
          })

          // ── Points as GL circle layers ───────────────────────────────────
          // Rendered by the same WebGL pipeline as the route line, so they
          // align pixel-perfectly with it (no DOM-marker anchor drift).

          // Fire foci — glow + pulsing ring + core
          fires.forEach((f, i) => {
            map.addSource(`fire-${i}`, pointSource(f.lon, f.lat))
            map.addLayer({
              id: `fire-${i}-glow`, type: "circle", source: `fire-${i}`,
              paint: { "circle-radius": 22, "circle-color": COLORS.fire, "circle-opacity": 0.22, "circle-blur": 1 },
            })
            map.addLayer({
              id: `fire-${i}-pulse`, type: "circle", source: `fire-${i}`,
              paint: {
                "circle-radius": 9, "circle-color": COLORS.fire, "circle-opacity": 0,
                "circle-stroke-width": 2, "circle-stroke-color": COLORS.fire, "circle-stroke-opacity": 0.7,
              },
            })
            map.addLayer({
              id: `fire-${i}-core`, type: "circle", source: `fire-${i}`,
              paint: {
                "circle-radius": 8, "circle-color": COLORS.fire,
                "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.9)",
              },
            })
          })

          // User position
          map.addSource("pt-user", pointSource(user.lon, user.lat))
          map.addLayer({
            id: "pt-user", type: "circle", source: "pt-user",
            paint: {
              "circle-radius": 7, "circle-color": COLORS.user,
              "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.9)",
            },
          })

          // Safe zone
          map.addSource("pt-safe", pointSource(dest.lon, dest.lat))
          map.addLayer({
            id: "pt-safe", type: "circle", source: "pt-safe",
            paint: {
              "circle-radius": 7, "circle-color": COLORS.safe,
              "circle-stroke-width": 2, "circle-stroke-color": "rgba(255,255,255,0.9)",
            },
          })

          // Pulsing alert ring on the fire foci
          const pulseStart = performance.now()
          const PULSE_MS = 1800
          const animatePulse = () => {
            if (cancelled || !mapRef.current) return
            const t = ((performance.now() - pulseStart) % PULSE_MS) / PULSE_MS
            const radius = 9 + t * 24
            const opacity = 0.7 * (1 - t)
            fires.forEach((_, i) => {
              const id = `fire-${i}-pulse`
              if (map.getLayer(id)) {
                map.setPaintProperty(id, "circle-radius", radius)
                map.setPaintProperty(id, "circle-stroke-opacity", opacity)
              }
            })
            pulseRafRef.current = requestAnimationFrame(animatePulse)
          }
          animatePulse()

          // ── Text labels (DOM markers, offset below their point) ──────────
          markersRef.current.push(
            new mapboxgl.Marker({ element: makeLabelEl("TÚ", "#dbeafe"), offset: [0, 16] })
              .setLngLat([user.lon, user.lat]).addTo(map),
          )
          fires.forEach((f) => {
            markersRef.current.push(
              new mapboxgl.Marker({ element: makeLabelEl(`FRP ${Math.round(f.frp)}`, "#fca5a5"), offset: [0, 18] })
                .setLngLat([f.lon, f.lat]).addTo(map),
            )
          })
          markersRef.current.push(
            new mapboxgl.Marker({ element: makeLabelEl(route.label, "#bbf7d0"), offset: [0, 18] })
              .setLngLat([dest.lon, dest.lat]).addTo(map),
          )

          map.setMinZoom(12)
        })
      })
      .catch((err) => console.error("[SentinelMap] mapbox-gl load failed:", err))

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
  }, [user, fires, route, expansion])

  return (
    <div
      ref={mapContainerRef}
      style={{ width: size, height: size, display: "block", background: "#0a0a0a" }}
    />
  )
}
