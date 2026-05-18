"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { Map as MapboxMap, LngLatBoundsLike } from "mapbox-gl"
import { RISK_PRIORITY, COUNTRY_BBOX, ISO_NAME, aggregatePointsByCountry } from "@/lib/tornado-utils"

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
  country_iso?: string | null
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

// ─── Risk colors ────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MODERATE: "#eab308",
  LOW:      "#22c55e",
}

// ─── Geometry helpers for point detail ──────────────────────────────────────

function makeEllipse(cx: number, cy: number, lengthDeg: number, widthDeg: number, bearingDeg = 0, n = 64): number[][] {
  const pts: number[][] = []
  const rad = (bearingDeg * Math.PI) / 180
  const sinB = Math.sin(rad)
  const cosB = Math.cos(rad)
  
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    const x = lengthDeg * Math.cos(a) 
    const y = widthDeg * Math.sin(a)
    
    // Rotate so local X aligns with bearing, local Y is orthogonal
    const rotX = x * sinB + y * cosB
    const rotY = x * cosB - y * sinB
    
    pts.push([cx + rotX, cy + rotY])
  }
  return pts
}

function generateRiskZones(point: GridPoint, bearingDeg = 0) {
  const { lon, lat, risk_level } = point
  const zones = []
  if (risk_level === "CRITICAL" || risk_level === "HIGH") {
    zones.push({ id: "low", coords: makeEllipse(lon, lat, 2.0, 1.3, bearingDeg), color: "#22c55e", opacity: 0.08, outlineOpacity: 0.30 })
    zones.push({ id: "moderate", coords: makeEllipse(lon, lat, 1.3, 0.8, bearingDeg), color: "#eab308", opacity: 0.12, outlineOpacity: 0.40 })
    zones.push({ id: "high", coords: makeEllipse(lon, lat, 0.7, 0.45, bearingDeg), color: "#f97316", opacity: 0.16, outlineOpacity: 0.55 })
  }
  if (risk_level === "CRITICAL") {
    zones.push({ id: "critical", coords: makeEllipse(lon, lat, 0.35, 0.22, bearingDeg), color: "#ef4444", opacity: 0.22, outlineOpacity: 0.70 })
  }
  return zones
}

function generateForecastCone(point: GridPoint, bearingDeg: number = 45, detail?: SevereWeatherDetail | null): { polygon: number[][]; centerPath: number[][] } {
  const { lon, lat } = point
  const rad = (bearingDeg * Math.PI) / 180
  const cosB = Math.cos(rad), sinB = Math.sin(rad)
  const cosP = Math.cos(rad + Math.PI / 2), sinP = Math.sin(rad + Math.PI / 2)
  
  let dist1 = 50, dist3 = 150, dist6 = 300 // default km
  if (detail?.forecast_risk?.[0]?.impact_corridor) {
    const ic = detail.forecast_risk[0].impact_corridor
    dist1 = ic.estimated_distance_km_1h || 50
    dist3 = ic.estimated_distance_km_3h || 150
    dist6 = ic.estimated_distance_km_6h || 300
  } else if (point.wind_gusts_10m) {
    dist1 = point.wind_gusts_10m * 1
    dist3 = point.wind_gusts_10m * 3
    dist6 = point.wind_gusts_10m * 6
  }

  // Convert km to degrees (roughly 111km per degree of latitude, approx locally for viz)
  const steps = [dist1 / 111, dist3 / 111, dist6 / 111, (dist6 * 1.3) / 111]
  const spreads = [steps[0] * 0.25, steps[1] * 0.25, steps[2] * 0.25, steps[3] * 0.3]

  const left: number[][] = [], right: number[][] = [], center: number[][] = [[lon, lat]]
  for (let i = 0; i < steps.length; i++) {
    const cx = lon + sinB * steps[i], cy = lat + cosB * steps[i]
    center.push([cx, cy])
    left.push([cx + sinP * spreads[i], cy + cosP * spreads[i]])
    right.push([cx - sinP * spreads[i], cy - cosP * spreads[i]])
  }
  return { polygon: [[lon, lat], ...left, ...right.reverse(), [lon, lat]], centerPath: center }
}

function getGeometryBbox(geometry: { coordinates?: unknown } | undefined): [number, number, number, number] | null {
  if (!geometry?.coordinates) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  const visit = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      const lng = coords[0]
      const lat = coords[1]
      west = Math.min(west, lng)
      south = Math.min(south, lat)
      east = Math.max(east, lng)
      north = Math.max(north, lat)
      return
    }
    coords.forEach(visit)
  }

  visit(geometry.coordinates)
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }
  return [west, south, east, north]
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
  selectedCountryIso?: string | null
  selectedPoint: GridPoint | null
  onCountrySelect?: (iso: string) => void
  onPointSelect: (point: GridPoint) => void
  onPointsCountryResolve?: (points: GridPoint[]) => void
  onBack: () => void
  loading: boolean
  detail?: SevereWeatherDetail | null
}

export function WorldTornadoMap({ gridData, selectedCountryIso, selectedPoint, onCountrySelect, onPointSelect, onPointsCountryResolve, onBack, loading, detail }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const onCountryRef = useRef(onCountrySelect)
  const onPointRef = useRef(onPointSelect)
  const onPointsCountryResolveRef = useRef(onPointsCountryResolve)
  const onBackRef = useRef(onBack)
  const markersRef = useRef<{ remove: () => void }[]>([])
  const rafRef = useRef<number>(0)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const countryBoundsRef = useRef<Record<string, [number, number, number, number]>>({})

  const [mapReady, setMapReady] = useState(false)
  const countryDataRef = useRef<Record<string, { risk: string; points: GridPoint[] }>>({})
  const prevSelectedPointRef = useRef<GridPoint | null>(null)
  
  const viewMode = selectedPoint ? "point" : (selectedCountryIso ? "country" : "world")
  const viewModeRef = useRef<"world" | "country" | "point">(viewMode)

  useEffect(() => { onCountryRef.current = onCountrySelect }, [onCountrySelect])
  useEffect(() => { onPointRef.current = onPointSelect }, [onPointSelect])
  useEffect(() => { onPointsCountryResolveRef.current = onPointsCountryResolve }, [onPointsCountryResolve])
  useEffect(() => { onBackRef.current = onBack }, [onBack])
  useEffect(() => { viewModeRef.current = viewMode }, [viewMode])

  const resolvePointCountriesFromRenderedMap = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapReady || !gridData?.points.length || !map.getLayer("country-fills")) return

    let changed = false
    const resolved = gridData.points.map(point => {
      const screenPoint = map.project([point.lon, point.lat])
      if (
        screenPoint.x < 0 ||
        screenPoint.y < 0 ||
        screenPoint.x > map.getCanvas().clientWidth ||
        screenPoint.y > map.getCanvas().clientHeight
      ) {
        return point
      }

      const features = map.queryRenderedFeatures(screenPoint, { layers: ["country-fills"] })
      const iso = features[0]?.properties?.iso_3166_1_alpha_3 as string | undefined
      if (!iso || iso === point.country_iso) return point

      changed = true
      return { ...point, country_iso: iso }
    })

    if (changed) {
      onPointsCountryResolveRef.current?.(resolved)
    }
  }, [gridData, mapReady])

  // ── CSS animations ──
  useEffect(() => {
    if (document.getElementById("sentinel-sw-style")) return
    const style = document.createElement("style")
    style.id = "sentinel-sw-style"
    style.textContent = `
      @keyframes swWave {
        0%   { r: 3;  opacity: 0.8; stroke-width: 2; }
        100% { r: 20; opacity: 0;   stroke-width: 0.3; }
      }
      .sw-wave1 { animation: swWave 2.5s ease-out infinite; }
      .sw-wave2 { animation: swWave 2.5s ease-out 0.8s infinite; }
      .sw-wave3 { animation: swWave 2.5s ease-out 1.6s infinite; }
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

    // Tooltip element
    const tip = document.createElement("div")
    Object.assign(tip.style, {
      position: "absolute", pointerEvents: "none", zIndex: "30", display: "none",
      background: "rgba(4,6,10,0.95)", border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "10px", padding: "10px 14px", fontFamily: "'Geist Mono', monospace",
      fontSize: "11px", color: "#e2e8f0", backdropFilter: "blur(12px)",
      whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", lineHeight: "1.7",
    })
    el.appendChild(tip)
    tooltipRef.current = tip

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return
      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-20, 20],
        zoom: 2,
        minZoom: 1.5,
        maxZoom: 12,
        projection: "globe" as never,
        attributionControl: false,
      })
      mapRef.current = map

      map.on("style.load", () => {
        map.setFog({
          "color":          "rgba(56, 189, 248, 0.12)",
          "high-color":     "rgba(10, 11, 14, 0.85)",
          "horizon-blend":  0.15,
          "space-color":    "rgb(2, 2, 5)",
          "star-intensity": 0.8,
        } as never)
      })

      map.on("load", () => {
        if (cancelled) return

        // White labels
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type !== "symbol") return
          try { map.setPaintProperty(layer.id, "text-color", "#ffffff") } catch {}
          try { map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.8)") } catch {}
          try { map.setPaintProperty(layer.id, "text-halo-width", 1.5) } catch {}
        })

        // ─── Country choropleth source ───
        map.addSource("countries", {
          type: "vector",
          url: "mapbox://mapbox.country-boundaries-v1",
        })

        // Base country fill (choropleth) — starts green, colored with risk data once grid arrives
        const initialColorMatch: unknown[] = ["match", ["get", "iso_3166_1_alpha_3"]]
        for (const iso of Object.keys(ISO_NAME)) {
          initialColorMatch.push(iso, "#22c55e")
        }
        initialColorMatch.push("#22c55e") // fallback

        map.addLayer({
          id: "country-fills",
          type: "fill",
          source: "countries",
          "source-layer": "country_boundaries",
          paint: {
            "fill-color": initialColorMatch as never,
            "fill-opacity": 0.75,
          },
        })

        // Country borders
        map.addLayer({
          id: "country-borders",
          type: "line",
          source: "countries",
          "source-layer": "country_boundaries",
          paint: {
            "line-color": "rgba(255,255,255,0.15)",
            "line-width": 0.7,
          },
        })

        // Selected country highlight fill
        map.addLayer({
          id: "country-highlight",
          type: "fill",
          source: "countries",
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "___"],
          paint: { "fill-color": "#ffffff", "fill-opacity": 0.85 },
        })

        // Selected country border
        map.addLayer({
          id: "country-highlight-border",
          type: "line",
          source: "countries",
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "___"],
          paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.9 },
        })

        // ─── Points layer (shown in country mode) ───
        map.addSource("weather-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        })

        map.addLayer({
          id: "points-glow", type: "circle", source: "weather-points",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 12, 7, 18, 10, 22],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.3,
            "circle-blur": 0.7,
          },
        })

        map.addLayer({
          id: "points-circle", type: "circle", source: "weather-points",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 7, 8, 10, 12],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.95,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.8,
          },
        })

        map.addLayer({
          id: "points-label", type: "symbol", source: "weather-points",
          minzoom: 5,
          layout: {
            "text-field": ["concat", ["get", "score"], ""],
            "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 10,
            "text-offset": [0, -1.8],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.9)",
            "text-halo-width": 1.5,
          },
        })

        // ─── Point detail overlays ───
        map.addSource("risk-zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        map.addLayer({ id: "risk-fill", type: "fill", source: "risk-zones",
          paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] } })
        map.addLayer({ id: "risk-outline", type: "line", source: "risk-zones",
          paint: { "line-color": ["get", "color"], "line-opacity": ["get", "outlineOpacity"], "line-width": 1.2, "line-dasharray": [4, 4] } })

        map.addSource("forecast-cone", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        map.addLayer({ id: "cone-fill", type: "fill", source: "forecast-cone", paint: { "fill-color": "#a855f7", "fill-opacity": 0.12 } })
        map.addLayer({ id: "cone-outline", type: "line", source: "forecast-cone", paint: { "line-color": "#a855f7", "line-opacity": 0.6, "line-width": 1.2, "line-dasharray": [5, 4] } })

        map.addSource("cone-path", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        map.addLayer({ id: "cone-center", type: "line", source: "cone-path", paint: { "line-color": "#e9d5ff", "line-opacity": 0.7, "line-width": 1.4, "line-dasharray": [6, 4] } })

        // ─── Pulsing glow animation ───
        let pulse = 0
        function animateGlow() {
          if (!mapRef.current) return
          pulse += 0.04
          const s = Math.sin(pulse)
          try {
            map.setPaintProperty("points-glow", "circle-opacity", 0.2 + s * 0.15)
          } catch {}
          rafRef.current = requestAnimationFrame(animateGlow)
        }
        rafRef.current = requestAnimationFrame(animateGlow)

        // ─── Zoom listener for auto-dismiss ───
        map.on("zoomend", () => {
          if (viewModeRef.current === "point" && map.getZoom() < 5) {
            onBackRef.current()
          }
        })

        // ─── Hover tooltip on countries ───
        map.on("mousemove", "country-fills", (e) => {
          if (viewModeRef.current !== "world") return
          if (!e.features?.length) return
          const iso = e.features[0].properties?.iso_3166_1_alpha_3 as string
          const info = countryDataRef.current[iso]
          const tEl = tooltipRef.current!
          const countryName =
            ISO_NAME[iso] ??
            (e.features[0].properties?.name_en as string | undefined) ??
            (e.features[0].properties?.name as string | undefined) ??
            iso

          if (iso) {
            const color = info ? (RISK_COLOR[info.risk] || "#22c55e") : "#22c55e"
            const labels: Record<string, string> = { LOW: "Bajo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" }
            const riskLabel = info ? (labels[info.risk] ?? "—") : "Bajo"
            const ptsLen = info ? info.points.length : 0
            
            tEl.innerHTML = `
              <div style="font-weight:800;font-size:13px;color:#f8fafc;margin-bottom:4px">${countryName}</div>
              <div style="display:flex;align-items:center;gap:7px">
                <div style="width:9px;height:9px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}"></div>
                <span style="color:${color};font-weight:700;font-size:11px">${riskLabel}</span>
                <span style="color:#94a3b8;font-size:10px">· ${ptsLen} foco${ptsLen !== 1 ? "s" : ""}</span>
              </div>
              <div style="color:#64748b;font-size:9px;margin-top:5px">▸ Clic para explorar</div>
            `
            tEl.style.display = "block"
            map.getCanvas().style.cursor = "pointer"
          } else {
            tEl.style.display = "none"
            map.getCanvas().style.cursor = ""
          }
          tEl.style.left = `${e.point.x + 16}px`
          tEl.style.top = `${e.point.y - 10}px`
        })
        map.on("mouseleave", "country-fills", () => {
          if (tooltipRef.current) tooltipRef.current.style.display = "none"
          map.getCanvas().style.cursor = ""
        })

        // ─── Click country → select ───
        map.on("click", "country-fills", (e) => {
          if (!e.features?.length) return
          e.originalEvent.stopPropagation()
          const iso = e.features[0].properties?.iso_3166_1_alpha_3 as string
          if (!iso) return
          const bbox = getGeometryBbox(e.features[0].geometry as { coordinates?: unknown } | undefined)
          if (bbox) countryBoundsRef.current[iso] = bbox
          if (tooltipRef.current) tooltipRef.current.style.display = "none"
          if (onCountryRef.current) {
            onCountryRef.current(iso)
          }
        })

        // ─── Click point → select ───
        map.on("click", "points-circle", (e) => {
          e.originalEvent.stopPropagation()
          const feat = e.features?.[0]
          if (!feat?.properties) return
          const p: GridPoint = {
            lat: feat.properties.lat, lon: feat.properties.lon,
            score: feat.properties.score, risk_level: feat.properties.risk_level,
            confidence: feat.properties.confidence,
            wind_gusts_10m: feat.properties.wind_gusts_10m ?? null,
            weather_code: feat.properties.weather_code ?? null,
          }
          onPointRef.current(p)
        })

        // ─── Click empty → back to world ───
        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: ["points-circle", "country-fills"] })
          if (hits.length === 0 && viewModeRef.current !== "world") {
            onBackRef.current()
          }
        })

        map.on("mouseenter", "points-circle", () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "points-circle", () => { map.getCanvas().style.cursor = "" })

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

  // ── Color choropleth when grid data arrives ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !gridData || gridData.points.length === 0) return

    // Aggregate immediately using bbox lookup (no async dependency)
    const countryAgg = aggregatePointsByCountry(gridData.points)
    countryDataRef.current = countryAgg

    // Build Mapbox match expression for fill-color
    const expr: unknown[] = ["match", ["get", "iso_3166_1_alpha_3"]]
    // Ensure ALL known countries from ISO_NAME are explicitly listed with a fallback color
    for (const iso of Object.keys(ISO_NAME)) {
      const riskColor = countryAgg[iso] ? RISK_COLOR[countryAgg[iso].risk] : "#22c55e"
      expr.push(iso, riskColor ?? "#22c55e")
    }
    expr.push("#22c55e") // final fallback for unknown countries

    // Apply once the style is ready
    const apply = () => {
      if (!map.getLayer("country-fills")) {
        // If layer isn't mounted yet, retry shortly
        setTimeout(apply, 100)
        return
      }
      try {
        map.setPaintProperty("country-fills", "fill-color", expr as never)
        map.once("idle", resolvePointCountriesFromRenderedMap)
      } catch (err) {
        console.error("Mapbox paint error on country-fills:", err)
      }
    }

    apply()
  }, [gridData, mapReady, resolvePointCountriesFromRenderedMap])

  // ── View mode transitions ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!map.getLayer("country-fills")) return

    const hide: unknown[] = ["==", ["get", "iso_3166_1_alpha_3"], "___"]

    if (viewMode === "world") {
      // Restore full choropleth
      map.setPaintProperty("country-fills", "fill-opacity", 0.75)
      map.setPaintProperty("country-borders", "line-opacity", 1)
      map.setFilter("country-highlight", hide as never)
      map.setFilter("country-highlight-border", hide as never)

      // Hide points
      const src = map.getSource("weather-points") as { setData?: (d: unknown) => void } | undefined
      src?.setData?.({ type: "FeatureCollection", features: [] })

      clearAllOverlays()
      
      // If we came from country/point mode, fly back to center
      if (prevSelectedPointRef.current || selectedCountryIso === null) {
        map.flyTo({ center: [-20, 20], zoom: 2, duration: 1200 })
      }

    } else if (viewMode === "country" && selectedCountryIso) {
      const info = countryDataRef.current[selectedCountryIso]
      const color = info ? (RISK_COLOR[info.risk] ?? "#22c55e") : "#22c55e"
      const filter: unknown[] = ["==", ["get", "iso_3166_1_alpha_3"], selectedCountryIso]

      // Dim others, highlight selected
      map.setPaintProperty("country-fills", "fill-opacity", 0.28)
      map.setPaintProperty("country-borders", "line-opacity", 0.3)
      map.setPaintProperty("country-highlight", "fill-color", color)
      map.setPaintProperty("country-highlight", "fill-opacity", 1.0)
      map.setFilter("country-highlight", filter as never)
      map.setFilter("country-highlight-border", filter as never)

      // Show points for this country
      if (info) {
        const features = info.points.map(p => ({
          type: "Feature" as const,
          properties: {
            lat: p.lat, lon: p.lon, score: p.score,
            risk_level: p.risk_level, confidence: p.confidence,
            wind_gusts_10m: p.wind_gusts_10m, weather_code: p.weather_code,
            color: RISK_COLOR[p.risk_level] ?? "#22c55e",
          },
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        }))
        const src = map.getSource("weather-points") as { setData?: (d: unknown) => void } | undefined
        src?.setData?.({ type: "FeatureCollection", features })
      } else {
        const src = map.getSource("weather-points") as { setData?: (d: unknown) => void } | undefined
        src?.setData?.({ type: "FeatureCollection", features: [] })
      }

      clearAllOverlays()

      // Zoom to country if coming from world view
      if (!selectedPoint) {
          const bbox = COUNTRY_BBOX[selectedCountryIso] ?? countryBoundsRef.current[selectedCountryIso]
        if (bbox) {
          const [w, s, e, n] = bbox
          const padLng = Math.max((e - w) * 0.15, 2)
          const padLat = Math.max((n - s) * 0.15, 1)
          map.fitBounds(
            [[w - padLng, s - padLat], [e + padLng, n + padLat]] as LngLatBoundsLike,
            { duration: 1200, padding: { top: 80, bottom: 80, left: 380, right: 380 } }
          )
          map.once("idle", resolvePointCountriesFromRenderedMap)
        }
      }
    }
  }, [viewMode, selectedCountryIso, mapReady, resolvePointCountriesFromRenderedMap])

  // ── Selected point (from props) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const prev = prevSelectedPointRef.current
    prevSelectedPointRef.current = selectedPoint

    if (selectedPoint) {
      map.flyTo({ center: [selectedPoint.lon, selectedPoint.lat], zoom: 7, duration: 1200 })
      showPointOverlays(selectedPoint)
    } else if (prev && !selectedPoint) {
      clearAllOverlays()
    }
  }, [selectedPoint, mapReady])

  // ── Update overlays when detail (bearing) arrives ──
  useEffect(() => {
    if (!selectedPoint || !detail?.forecast_risk?.[0]?.impact_corridor) return
    showPointOverlays(selectedPoint)
  }, [detail])

  // ── Overlay helpers ──
  const showPointOverlays = useCallback((point: GridPoint) => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    const bearing = detail?.forecast_risk?.[0]?.impact_corridor?.bearing_degrees ?? 45

    // Risk zones
    const zones = generateRiskZones(point, bearing)
    const zSrc = map.getSource("risk-zones") as { setData?: (d: unknown) => void } | undefined
    zSrc?.setData?.({
      type: "FeatureCollection",
      features: zones.map(z => ({
        type: "Feature", properties: { color: z.color, opacity: z.opacity, outlineOpacity: z.outlineOpacity },
        geometry: { type: "Polygon", coordinates: [z.coords] },
      })),
    })

    // Forecast cone - ONLY SHOW IF DETAIL IS LOADED (don't show fallback)
    const cSrc = map.getSource("forecast-cone") as { setData?: (d: unknown) => void } | undefined
    const pSrc = map.getSource("cone-path") as { setData?: (d: unknown) => void } | undefined
    
    if (!detail) {
      cSrc?.setData?.({ type: "FeatureCollection", features: [] })
      pSrc?.setData?.({ type: "FeatureCollection", features: [] })
    } else {
      const { polygon, centerPath } = generateForecastCone(point, bearing, detail)
      cSrc?.setData?.({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [polygon] } })
      pSrc?.setData?.({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: centerPath } })
    }

    // Small wave marker
    clearMarkers()
    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (!mapRef.current) return
      const color = RISK_COLOR[point.risk_level] || "#eab308"
      const el = document.createElement("div")
      el.style.cssText = "width:50px;height:50px;pointer-events:none;"
      el.innerHTML = `
        <svg width="50" height="50" viewBox="0 0 50 50" style="overflow:visible">
          <circle class="sw-wave1" cx="25" cy="25" fill="none" stroke="${color}"/>
          <circle class="sw-wave2" cx="25" cy="25" fill="none" stroke="${color}"/>
          <circle class="sw-wave3" cx="25" cy="25" fill="none" stroke="${color}"/>
          <circle cx="25" cy="25" r="4" fill="${color}" opacity="0.95"/>
          <circle cx="25" cy="25" r="2" fill="#fff"/>
        </svg>
      `
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([point.lon, point.lat])
        .addTo(mapRef.current!)
      markersRef.current.push(marker)
    })
  }, [detail])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  const clearAllOverlays = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    clearMarkers()
    const empty = { type: "FeatureCollection", features: [] }
    ;(["risk-zones"] as const).forEach(id => {
      (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(empty)
    })
    ;(["forecast-cone"] as const).forEach(id => {
      (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(empty)
    })
    ;(["cone-path"] as const).forEach(id => {
      (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(empty)
    })
  }, [clearMarkers])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading */}
      {loading && !gridData && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0a0b0e]/90 backdrop-blur-md border border-cyan-500/20 rounded-full px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">Cargando datos meteorológicos...</span>
        </div>
      )}

      {/* Back button */}
      {viewMode !== "world" && (
        <button
          onClick={() => {
            onBackRef.current()
          }}
          className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-[#0a0b0e]/85 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 hover:bg-[#0a0b0e]/95 hover:border-white/30 transition-all cursor-pointer shadow-lg"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            {viewMode === "point" && selectedCountryIso
              ? `← ${ISO_NAME[selectedCountryIso] ?? "País"}`
              : "← Vista Global"
            }
          </span>
        </button>
      )}

      {/* Country info badge (country mode) */}
      {viewMode === "country" && selectedCountryIso && countryDataRef.current[selectedCountryIso] && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0a0b0e]/85 backdrop-blur-md border border-white/10 rounded-full px-5 py-2 shadow-lg">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: RISK_COLOR[countryDataRef.current[selectedCountryIso]!.risk] || "#22c55e",
              boxShadow: `0 0 8px ${RISK_COLOR[countryDataRef.current[selectedCountryIso]!.risk] || "#22c55e"}`,
            }}
          />
          <span className="text-[12px] font-bold text-white">
            {ISO_NAME[selectedCountryIso] ?? selectedCountryIso}
          </span>
          <span className="text-[10px] text-white/50">
            {countryDataRef.current[selectedCountryIso]!.points.length} foco{countryDataRef.current[selectedCountryIso]!.points.length !== 1 ? "s" : ""} detectado{countryDataRef.current[selectedCountryIso]!.points.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
