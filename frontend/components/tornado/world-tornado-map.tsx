"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { Map as MapboxMap } from "mapbox-gl"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GridPoint {
  lat: number
  lon: number
  score: number
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
  confidence: number
  wind_gusts_10m: number | null
  weather_code: number | null
}

export interface GridScanResult {
  timestamp: string
  refresh_interval_ms: number
  next_refresh: string
  points: GridPoint[]
  metadata: {
    total_points: number
    high_risk_count: number
    critical_risk_count: number
    source: string
    scan_duration_ms: number
    cached: boolean
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MODERATE: "#eab308",
  LOW:      "#22c55e",
}

const CLUSTER_COLORS = [
  { threshold: 30, color: "#ef4444" },  // many points → red
  { threshold: 10, color: "#f97316" },
  { threshold: 0,  color: "#eab308" },
]

// ─── Geometry helpers ────────────────────────────────────────────────────────

function makeEllipse(cx: number, cy: number, rx: number, ry: number, n = 64): number[][] {
  const pts: number[][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return pts
}

function generateRiskZones(point: GridPoint) {
  const { lon, lat, risk_level } = point
  const zones = []
  if (risk_level === "CRITICAL" || risk_level === "HIGH") {
    zones.push({ id: "low", coords: makeEllipse(lon, lat, 6.0, 4.0), color: "#22c55e", opacity: 0.08, outlineOpacity: 0.30 })
    zones.push({ id: "moderate", coords: makeEllipse(lon, lat, 4.0, 2.5), color: "#eab308", opacity: 0.10, outlineOpacity: 0.38 })
    zones.push({ id: "high", coords: makeEllipse(lon, lat, 2.2, 1.4), color: "#f97316", opacity: 0.14, outlineOpacity: 0.50 })
  }
  if (risk_level === "CRITICAL") {
    zones.push({ id: "critical", coords: makeEllipse(lon, lat, 1.0, 0.65), color: "#ef4444", opacity: 0.20, outlineOpacity: 0.70 })
    zones.push({ id: "core", coords: makeEllipse(lon, lat, 0.4, 0.28), color: "#a855f7", opacity: 0.26, outlineOpacity: 0.85 })
  }
  return zones
}

function generateWindFlows(point: GridPoint): number[][][] {
  const { lon, lat } = point
  const offsets = [
    [[-9, 5], [-6, 3.5], [-3, 1.8], [-1, 0.5]],
    [[-10, 1], [-7, 0.8], [-4, 0.5], [-1.5, 0.2]],
    [[-8, -3], [-5, -2], [-2.5, -1], [-0.8, -0.3]],
    [[5, 4], [3.5, 2.8], [2, 1.5], [0.7, 0.4]],
    [[7, -2], [5, -1.4], [3, -0.8], [1, -0.3]],
    [[3, -5], [2, -3.5], [1, -2], [0.3, -0.7]],
  ]
  return offsets.map(line => [...line.map(([dx, dy]) => [lon + dx, lat + dy]), [lon, lat]])
}

function generateForecastCone(point: GridPoint, bearingDeg: number = 45): { polygon: number[][]; centerPath: number[][] } {
  const { lon, lat } = point
  const rad = (bearingDeg * Math.PI) / 180
  const cosB = Math.cos(rad)
  const sinB = Math.sin(rad)
  const cosP = Math.cos(rad + Math.PI / 2)
  const sinP = Math.sin(rad + Math.PI / 2)

  const steps = [1.5, 3.0, 4.5, 5.5]
  const spreads = [0.4, 0.8, 1.2, 1.5]

  const left: number[][] = []
  const right: number[][] = []
  const center: number[][] = [[lon, lat]]

  for (let i = 0; i < steps.length; i++) {
    const cx = lon + sinB * steps[i]
    const cy = lat + cosB * steps[i]
    center.push([cx, cy])
    left.push([cx + sinP * spreads[i], cy + cosP * spreads[i]])
    right.push([cx - sinP * spreads[i], cy - cosP * spreads[i]])
  }

  return { polygon: [[lon, lat], ...left, ...right.reverse(), [lon, lat]], centerPath: center }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface SevereWeatherDetail {
  forecast_risk: Array<{
    window: string
    score: number
    risk_level: string
    impact_corridor: {
      direction_label: string
      bearing_degrees: number
      estimated_distance_km_1h: number
      estimated_distance_km_3h: number
      estimated_distance_km_6h: number
    }
  }>
}

interface Props {
  gridData: GridScanResult | null
  selectedPoint: GridPoint | null
  onPointSelect: (point: GridPoint) => void
  loading: boolean
  detail?: SevereWeatherDetail | null
}

export function WorldTornadoMap({ gridData, selectedPoint, onPointSelect, loading, detail }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const onPointRef = useRef(onPointSelect)
  const rafRef = useRef<number>(0)
  const markersRef = useRef<{ remove: () => void }[]>([])
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => { onPointRef.current = onPointSelect }, [onPointSelect])

  // ── Inject CSS for animations ──
  useEffect(() => {
    if (document.getElementById("sentinel-tornado-style")) return
    const style = document.createElement("style")
    style.id = "sentinel-tornado-style"
    style.textContent = `
      @keyframes waveExpand {
        0%   { r: 6;  opacity: 0.7; stroke-width: 2.5; }
        100% { r: 55; opacity: 0;   stroke-width: 0.3; }
      }
      .wave { animation: waveExpand 3s ease-out infinite; }
      .wave2 { animation: waveExpand 3s ease-out 1s infinite; }
      .wave3 { animation: waveExpand 3s ease-out 2s infinite; }
    `
    document.head.appendChild(style)
  }, [])

  // ── Initialize map ──
  useEffect(() => {
    if (!document.getElementById("mbgl-css")) {
      const link = document.createElement("link")
      link.id = "mbgl-css"; link.rel = "stylesheet"
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
      document.head.appendChild(link)
    }
    const el = containerRef.current
    if (!el || mapRef.current) return
    let cancelled = false

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return
      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-40, 20],
        zoom: 2.2,
        minZoom: 1.5,
        maxZoom: 12,
        projection: "globe" as never,
        attributionControl: false,
      })
      mapRef.current = map

      map.on("style.load", () => {
        map.setFog({
          "color":          "rgba(56, 189, 248, 0.15)",
          "high-color":     "rgba(10, 11, 14, 0.8)",
          "horizon-blend":  0.2,
          "space-color":    "rgb(2, 2, 5)",
          "star-intensity": 0.9,
        } as never)
      })

      map.on("load", () => {
        if (cancelled) return

        // White labels
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type !== "symbol") return
          try { map.setPaintProperty(layer.id, "text-color", "#ffffff") } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.75)") } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, "text-halo-width", 1.5) } catch { /* skip */ }
        })

        // ── Overlay sources (populated on select) ──
        map.addSource("risk-zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        map.addLayer({ id: "risk-fill", type: "fill", source: "risk-zones",
          paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
        })
        map.addLayer({ id: "risk-outline", type: "line", source: "risk-zones",
          paint: { "line-color": ["get", "color"], "line-opacity": ["get", "outlineOpacity"], "line-width": 1.2, "line-dasharray": [4, 4] },
        })

        map.addSource("forecast-cone", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[]] } } as never })
        map.addLayer({ id: "cone-fill", type: "fill", source: "forecast-cone", paint: { "fill-color": "#a855f7", "fill-opacity": 0.10 } })
        map.addLayer({ id: "cone-outline", type: "line", source: "forecast-cone", paint: { "line-color": "#a855f7", "line-opacity": 0.55, "line-width": 1.0, "line-dasharray": [5, 4] } })

        map.addSource("cone-path", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } as never })
        map.addLayer({ id: "cone-path", type: "line", source: "cone-path", paint: { "line-color": "#e9d5ff", "line-opacity": 0.80, "line-width": 1.4, "line-dasharray": [6, 4] } })

        map.addSource("wind-flows", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        map.addLayer({ id: "wind-flow", type: "line", source: "wind-flows", paint: { "line-color": "#67e8f9", "line-opacity": 0.55, "line-width": 1.4, "line-dasharray": [2, 3] } })

        // Animate wind dash
        let dashOffset = 0
        function animateDash() {
          if (!mapRef.current) return
          dashOffset -= 0.4
          try { (map as any).setPaintProperty("wind-flow", "line-dash-offset", dashOffset) } catch { /* skip */ }
          rafRef.current = requestAnimationFrame(animateDash)
        }
        rafRef.current = requestAnimationFrame(animateDash)

        // ── Points source WITH CLUSTERING (like fire dashboard) ──
        map.addSource("severe-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 7,
          clusterRadius: 45,
        })

        // Cluster circles
        map.addLayer({
          id: "severe-clusters", type: "circle", source: "severe-points",
          filter: ["has", "point_count"],
          paint: {
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
            "circle-color": [
              "step", ["get", "point_count"],
              "#eab308", 10, "#f97316", 30, "#ef4444",
            ],
            "circle-opacity": 0.75,
            "circle-stroke-width": 2,
            "circle-stroke-color": "rgba(255,255,255,0.3)",
          },
        })

        // Cluster count labels
        map.addLayer({
          id: "severe-cluster-count", type: "symbol", source: "severe-points",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 11,
          },
          paint: { "text-color": "#ffffff" },
        })

        // Unclustered: halo (pulsing via requestAnimationFrame like fire)
        map.addLayer({
          id: "severe-halo", type: "circle", source: "severe-points",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 18,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.25,
            "circle-blur": 0.8,
          },
        })

        // Unclustered: main point
        map.addLayer({
          id: "severe-circle", type: "circle", source: "severe-points",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              2, 3.5,
              5, 5,
              8, 8,
              12, 12,
            ],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.9,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.6,
          },
        })

        // Score labels — only show when zoomed in enough
        map.addLayer({
          id: "severe-label", type: "symbol", source: "severe-points",
          filter: ["all",
            ["!", ["has", "point_count"]],
            ["in", ["get", "risk_level"], ["literal", ["HIGH", "CRITICAL"]]],
          ],
          minzoom: 4,
          layout: {
            "text-field": ["get", "score"],
            "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 10,
            "text-offset": [0, -1.6],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.8)",
            "text-halo-width": 1.5,
          },
        })

        // ── Pulsing halo animation (like fire dashboard) ──
        let pulsePhase = 0
        function animateHalo() {
          if (!mapRef.current) return
          pulsePhase += 0.04
          const pulse = Math.sin(pulsePhase)
          const radius = 14 + pulse * 8     // 6..22
          const opacity = 0.25 - pulse * 0.12 // 0.37..0.13
          try {
            map.setPaintProperty("severe-halo", "circle-radius", radius)
            map.setPaintProperty("severe-halo", "circle-opacity", Math.max(0.05, opacity))
          } catch { /* skip */ }
          requestAnimationFrame(animateHalo)
        }
        requestAnimationFrame(animateHalo)

        // ── Click handlers ──
        // Click on cluster → zoom in
        map.on("click", "severe-clusters", (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["severe-clusters"] })
          if (!features[0]) return
          const clusterId = features[0].properties?.cluster_id
          const source = map.getSource("severe-points") as any
          source?.getClusterExpansionZoom?.(clusterId, (err: Error | null, zoom: number) => {
            if (err) return
            const geom = features[0].geometry as unknown as { coordinates: [number, number] }
            map.flyTo({ center: geom.coordinates, zoom: zoom + 1, duration: 1200 })
          })
        })

        // Click on individual point → select
        map.on("click", "severe-circle", (e) => {
          const feat = e.features?.[0]
          if (!feat || !feat.properties) return
          const point: GridPoint = {
            lat: feat.properties.lat,
            lon: feat.properties.lon,
            score: feat.properties.score,
            risk_level: feat.properties.risk_level,
            confidence: feat.properties.confidence,
            wind_gusts_10m: feat.properties.wind_gusts_10m ?? null,
            weather_code: feat.properties.weather_code ?? null,
          }
          onPointRef.current(point)
        })

        map.on("mouseenter", "severe-circle", () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "severe-circle", () => { map.getCanvas().style.cursor = "" })
        map.on("mouseenter", "severe-clusters", () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "severe-clusters", () => { map.getCanvas().style.cursor = "" })

        setMapReady(true)
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // ── Update data when gridData changes or map becomes ready ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !gridData) return

    const source = map.getSource("severe-points") as { setData?: (d: unknown) => void } | undefined
    if (!source?.setData) return

    const features = gridData.points.map(p => ({
      type: "Feature" as const,
      properties: {
        lat: p.lat,
        lon: p.lon,
        score: p.score,
        risk_level: p.risk_level,
        confidence: p.confidence,
        wind_gusts_10m: p.wind_gusts_10m,
        weather_code: p.weather_code,
        color: RISK_COLOR[p.risk_level] ?? "#22c55e",
      },
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
    }))

    source.setData({ type: "FeatureCollection", features })
  }, [gridData, mapReady])

  // ── Update cone bearing when detail arrives ──
  useEffect(() => {
    if (!selectedPoint || !detail?.forecast_risk?.[0]?.impact_corridor) return
    updateOverlays(selectedPoint)
  }, [detail])

  // ── Update overlays for selected point (zoomed view) ──
  const updateOverlays = useCallback((point: GridPoint) => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    // Risk zones
    const zones = generateRiskZones(point)
    const zoneSource = map.getSource("risk-zones") as { setData?: (d: unknown) => void } | undefined
    if (zoneSource?.setData) {
      zoneSource.setData({
        type: "FeatureCollection",
        features: zones.map(z => ({
          type: "Feature",
          properties: { zone: z.id, color: z.color, opacity: z.opacity, outlineOpacity: z.outlineOpacity },
          geometry: { type: "Polygon", coordinates: [z.coords] },
        })),
      })
    }

    // Wind flows
    const flows = generateWindFlows(point)
    const windSource = map.getSource("wind-flows") as { setData?: (d: unknown) => void } | undefined
    if (windSource?.setData) {
      windSource.setData({
        type: "FeatureCollection",
        features: flows.map(coords => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } })),
      })
    }

    // Forecast cone with real bearing
    const bearing = detail?.forecast_risk?.[0]?.impact_corridor?.bearing_degrees ?? 45
    const { polygon, centerPath } = generateForecastCone(point, bearing)
    const coneSource = map.getSource("forecast-cone") as { setData?: (d: unknown) => void } | undefined
    if (coneSource?.setData) {
      coneSource.setData({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [polygon] } })
    }
    const pathSource = map.getSource("cone-path") as { setData?: (d: unknown) => void } | undefined
    if (pathSource?.setData) {
      pathSource.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: centerPath } })
    }

    // Expanding waves marker on selected point
    clearMarkers()
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!mapRef.current) return

      const color = RISK_COLOR[point.risk_level] || "#eab308"
      const waveEl = document.createElement("div")
      waveEl.style.cssText = "width:120px;height:120px;pointer-events:none;transform:translate(-50%,-50%);"
      waveEl.innerHTML = `
        <svg width="120" height="120" viewBox="0 0 120 120" style="overflow:visible">
          <circle class="wave"  cx="60" cy="60" fill="none" stroke="${color}"/>
          <circle class="wave2" cx="60" cy="60" fill="none" stroke="${color}"/>
          <circle class="wave3" cx="60" cy="60" fill="none" stroke="${color}"/>
          <circle cx="60" cy="60" r="5" fill="${color}" opacity="0.9"/>
          <circle cx="60" cy="60" r="2.5" fill="#fff"/>
        </svg>
      `
      const marker = new mapboxgl.Marker({ element: waveEl, anchor: "center" })
        .setLngLat([point.lon, point.lat])
        .addTo(mapRef.current!)
      markersRef.current.push(marker)
    })
  }, [detail])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  const clearOverlays = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    clearMarkers()
    const empty = { type: "FeatureCollection", features: [] }
    const emptyLine = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } }
    const emptyPoly = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[]] } }
    ;(["risk-zones", "wind-flows"] as const).forEach(id => {
      const s = map.getSource(id) as { setData?: (d: unknown) => void } | undefined
      s?.setData?.(empty)
    })
    ;(["forecast-cone"] as const).forEach(id => {
      const s = map.getSource(id) as { setData?: (d: unknown) => void } | undefined
      s?.setData?.(emptyPoly)
    })
    ;(["cone-path"] as const).forEach(id => {
      const s = map.getSource(id) as { setData?: (d: unknown) => void } | undefined
      s?.setData?.(emptyLine)
    })
  }, [clearMarkers])

  // ── Fly to selected point + overlays ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (selectedPoint) {
      // Fly to with offset like fire dashboard
      map.flyTo({
        center: [selectedPoint.lon + 0.12, selectedPoint.lat],
        zoom: 6,
        duration: 1500,
        essential: true,
      })
      updateOverlays(selectedPoint)
    } else {
      // Deselected → clear ALL overlays + markers, zoom back to global view
      clearOverlays()
      map.flyTo({ center: [-40, 20], zoom: 2.2, duration: 1200 })
    }
  }, [selectedPoint, mapReady, updateOverlays, clearOverlays])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {loading && !gridData && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0a0b0e]/90 backdrop-blur-md border border-cyan-500/20 rounded-full px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">Loading severe weather data...</span>
        </div>
      )}
    </div>
  )
}
