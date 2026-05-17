"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { Map as MapboxMap, LngLatBoundsLike } from "mapbox-gl"

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

// ─── Risk colors ────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MODERATE: "#eab308",
  LOW:      "#22c55e",
}

const RISK_PRIORITY: Record<string, number> = {
  LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4,
}

// ─── Country bounding boxes [west, south, east, north] ──────────────────────

const COUNTRY_BBOX: Record<string, [number, number, number, number]> = {
  USA:[-125,24,-66,50],CAN:[-141,42,-52,72],MEX:[-118,14,-86,33],
  BRA:[-74,-34,-34,6],ARG:[-74,-56,-53,-21],CHL:[-76,-56,-66,-17],
  COL:[-80,-5,-66,13],VEN:[-73,0,-59,12],PER:[-82,-19,-68,0],
  ECU:[-81,-5,-75,2],BOL:[-70,-23,-57,-9],PRY:[-63,-28,-54,-19],
  URY:[-59,-35,-53,-30],GUY:[-62,1,-56,9],SUR:[-58,1,-53,6],
  CUB:[-85,19,-74,24],DOM:[-72,17,-68,20],HTI:[-75,18,-71,20],
  JAM:[-79,17,-76,19],TTO:[-62,10,-60,11],
  GTM:[-92,13,-88,18],BLZ:[-89,15,-87,19],HND:[-90,13,-83,16],
  SLV:[-91,13,-87,15],NIC:[-88,10,-83,15],CRI:[-86,8,-82,11],PAN:[-83,7,-77,10],
  GBR:[-9,49,2,61],FRA:[-5,42,9,51],ESP:[-10,36,4,44],PRT:[-10,37,-6,42],
  DEU:[5,47,15,55],ITA:[6,36,19,47],NLD:[3,50,8,54],BEL:[2,49,7,52],
  CHE:[5,45,11,48],AUT:[9,46,17,49],IRL:[-11,51,-5,56],
  NOR:[4,57,31,72],SWE:[10,55,25,70],FIN:[19,59,32,70],DNK:[8,54,13,58],
  POL:[14,49,25,55],UKR:[22,44,41,53],ROU:[20,43,30,48],
  HUN:[16,45,23,49],CZE:[12,48,19,52],BGR:[22,41,29,44],
  SRB:[18,42,23,47],HRV:[13,42,20,47],GRC:[19,34,30,42],
  TUR:[25,35,45,42],ALB:[19,39,22,43],
  RUS:[27,41,180,72],KAZ:[46,40,88,56],UZB:[56,37,74,46],TKM:[52,35,67,43],
  KGZ:[69,39,81,44],TJK:[67,36,75,41],
  IND:[68,6,98,36],PAK:[60,23,78,37],BGD:[88,20,93,27],
  NPL:[80,26,89,31],LKA:[79,5,82,10],MMR:[92,9,102,29],
  AFG:[60,29,75,39],IRN:[44,25,64,40],IRQ:[38,29,49,38],
  SYR:[35,32,42,38],JOR:[34,29,40,34],ISR:[34,29,36,34],
  SAU:[34,16,56,33],ARE:[51,22,57,27],OMN:[51,16,60,27],
  YEM:[42,12,54,19],KWT:[46,28,49,30],QAT:[50,24,52,27],
  LBN:[35,33,37,35],
  THA:[97,5,106,21],VNM:[102,8,110,24],KHM:[102,10,108,15],
  LAO:[100,13,108,23],MYS:[99,0,120,8],IDN:[95,-11,141,6],
  PHL:[116,4,127,21],SGP:[103,1,104,2],
  CHN:[73,18,135,54],JPN:[128,30,146,46],KOR:[124,33,132,39],MNG:[87,41,120,52],
  AUS:[112,-44,154,-10],NZL:[165,-48,179,-33],
  NGA:[-0,4,15,14],GHA:[-4,4,2,12],CIV:[-9,4,-2,11],
  SEN:[-18,12,-11,17],MLI:[-12,10,5,25],BFA:[-6,9,3,15],
  NER:[0,11,16,24],CMR:[8,1,17,13],TCD:[13,7,24,24],
  ETH:[33,3,48,15],KEN:[33,-5,42,5],TZA:[29,-12,41,0],
  UGA:[29,-2,35,5],RWA:[28,-3,31,0],SOM:[40,-2,52,12],
  SDN:[21,8,39,23],SSD:[24,3,36,13],
  ZAF:[16,-35,33,-22],BWA:[19,-27,30,-17],NAM:[11,-29,26,-17],
  ZMB:[21,-18,34,-8],ZWE:[25,-23,34,-15],MOZ:[30,-27,41,-10],
  MWI:[32,-17,36,-9],MDG:[43,-26,51,-11],AGO:[11,-18,24,-4],
  COD:[12,-14,32,6],COG:[11,-5,19,4],
  EGY:[24,22,37,32],LBY:[9,19,26,34],TUN:[7,30,12,38],
  MAR:[-13,27,-1,36],DZA:[-9,18,12,38],
}

// ISO alpha-3 → display name
const ISO_NAME: Record<string, string> = {
  USA:"United States",CAN:"Canada",MEX:"Mexico",BRA:"Brazil",ARG:"Argentina",
  CHL:"Chile",COL:"Colombia",VEN:"Venezuela",PER:"Peru",ECU:"Ecuador",
  BOL:"Bolivia",PRY:"Paraguay",URY:"Uruguay",GUY:"Guyana",SUR:"Suriname",
  CUB:"Cuba",DOM:"Dominican Rep.",HTI:"Haiti",JAM:"Jamaica",TTO:"Trinidad",
  GTM:"Guatemala",BLZ:"Belize",HND:"Honduras",SLV:"El Salvador",
  NIC:"Nicaragua",CRI:"Costa Rica",PAN:"Panama",
  GBR:"United Kingdom",FRA:"France",ESP:"Spain",PRT:"Portugal",
  DEU:"Germany",ITA:"Italy",NLD:"Netherlands",BEL:"Belgium",
  CHE:"Switzerland",AUT:"Austria",IRL:"Ireland",NOR:"Norway",SWE:"Sweden",
  FIN:"Finland",DNK:"Denmark",POL:"Poland",UKR:"Ukraine",ROU:"Romania",
  HUN:"Hungary",CZE:"Czechia",BGR:"Bulgaria",SRB:"Serbia",HRV:"Croatia",
  GRC:"Greece",TUR:"Turkey",ALB:"Albania",
  RUS:"Russia",KAZ:"Kazakhstan",UZB:"Uzbekistan",TKM:"Turkmenistan",
  KGZ:"Kyrgyzstan",TJK:"Tajikistan",
  IND:"India",PAK:"Pakistan",BGD:"Bangladesh",NPL:"Nepal",LKA:"Sri Lanka",
  MMR:"Myanmar",AFG:"Afghanistan",IRN:"Iran",IRQ:"Iraq",SYR:"Syria",
  JOR:"Jordan",ISR:"Israel",SAU:"Saudi Arabia",ARE:"UAE",OMN:"Oman",
  YEM:"Yemen",KWT:"Kuwait",QAT:"Qatar",LBN:"Lebanon",
  THA:"Thailand",VNM:"Vietnam",KHM:"Cambodia",LAO:"Laos",MYS:"Malaysia",
  IDN:"Indonesia",PHL:"Philippines",SGP:"Singapore",
  CHN:"China",JPN:"Japan",KOR:"South Korea",MNG:"Mongolia",
  AUS:"Australia",NZL:"New Zealand",
  NGA:"Nigeria",GHA:"Ghana",CIV:"Ivory Coast",SEN:"Senegal",MLI:"Mali",
  BFA:"Burkina Faso",NER:"Niger",CMR:"Cameroon",TCD:"Chad",
  ETH:"Ethiopia",KEN:"Kenya",TZA:"Tanzania",UGA:"Uganda",RWA:"Rwanda",
  SOM:"Somalia",SDN:"Sudan",SSD:"South Sudan",
  ZAF:"South Africa",BWA:"Botswana",NAM:"Namibia",ZMB:"Zambia",
  ZWE:"Zimbabwe",MOZ:"Mozambique",MWI:"Malawi",MDG:"Madagascar",
  AGO:"Angola",COD:"DR Congo",COG:"Congo",
  EGY:"Egypt",LBY:"Libya",TUN:"Tunisia",MAR:"Morocco",DZA:"Algeria",
}

// ─── Map point → country (bbox lookup, instant, no async) ───────────────────

function findCountryForPoint(lat: number, lon: number): string | null {
  // Check smaller/more specific countries first (priority order)
  const prioritized = ["SGP","QAT","KWT","LBN","JOR","ISR","BLZ","SLV","JAM","TTO","RWA",
    "HRV","SVN","CHE","AUT","BEL","NLD","DNK","ALB","BGR","SRB","HUN","CZE",
    "DOM","HTI","CUB","CRI","PAN","NIC","HND","GTM","SUR","GUY","URY","PRY","ECU","BOL",
    "KOR","JPN","NPL","BGD","LKA","KHM","LAO","VNM","THA","PHL","MYS",
    "NZL","GBR","IRL","PRT","ESP","FRA","DEU","ITA","NOR","SWE","FIN","POL",
    "UKR","ROU","GRC","TUR","IRQ","SYR","AFG","PAK","IRN","SAU","ARE","OMN","YEM",
    "EGY","LBY","TUN","MAR","DZA","SEN","MLI","GHA","NGA","CMR","NER","BFA","CIV",
    "TCD","ETH","KEN","TZA","UGA","SOM","SDN","SSD",
    "ZAF","BWA","NAM","ZMB","ZWE","MOZ","MWI","MDG","AGO","COD","COG",
    "MEX","COL","VEN","PER","CHL","ARG","BRA",
    "IND","CHN","MNG","IDN","AUS","KAZ","UZB","TKM","KGZ","TJK","RUS",
    "USA","CAN","MMR","LBN"]

  for (const iso of prioritized) {
    const bbox = COUNTRY_BBOX[iso]
    if (!bbox) continue
    const [w, s, e, n] = bbox
    if (lat >= s && lat <= n && lon >= w && lon <= e) return iso
  }
  return null
}

function aggregatePointsByCountry(points: GridPoint[]): Record<string, { risk: string; points: GridPoint[] }> {
  const result: Record<string, { risk: string; points: GridPoint[] }> = {}
  for (const p of points) {
    const iso = findCountryForPoint(p.lat, p.lon)
    if (!iso) continue
    if (!result[iso]) result[iso] = { risk: p.risk_level, points: [] }
    result[iso].points.push(p)
    if (RISK_PRIORITY[p.risk_level] > RISK_PRIORITY[result[iso].risk]) {
      result[iso].risk = p.risk_level
    }
  }
  return result
}

// ─── Geometry helpers for point detail ──────────────────────────────────────

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
    zones.push({ id: "low", coords: makeEllipse(lon, lat, 2.0, 1.3), color: "#22c55e", opacity: 0.08, outlineOpacity: 0.30 })
    zones.push({ id: "moderate", coords: makeEllipse(lon, lat, 1.3, 0.8), color: "#eab308", opacity: 0.12, outlineOpacity: 0.40 })
    zones.push({ id: "high", coords: makeEllipse(lon, lat, 0.7, 0.45), color: "#f97316", opacity: 0.16, outlineOpacity: 0.55 })
  }
  if (risk_level === "CRITICAL") {
    zones.push({ id: "critical", coords: makeEllipse(lon, lat, 0.35, 0.22), color: "#ef4444", opacity: 0.22, outlineOpacity: 0.70 })
  }
  return zones
}

function generateWindFlows(point: GridPoint): number[][][] {
  const { lon, lat } = point
  const offsets = [
    [[-3.5, 1.8], [-2.3, 1.2], [-1.1, 0.6], [-0.3, 0.15]],
    [[-3.8, 0.3], [-2.5, 0.2], [-1.4, 0.1], [-0.5, 0.05]],
    [[-3, -1.1], [-2, -0.7], [-1, -0.35], [-0.3, -0.1]],
    [[2, 1.5], [1.3, 1], [0.7, 0.5], [0.2, 0.15]],
    [[2.5, -0.7], [1.7, -0.5], [1, -0.3], [0.3, -0.1]],
    [[1.2, -1.8], [0.8, -1.2], [0.4, -0.7], [0.1, -0.2]],
  ]
  return offsets.map(line => [...line.map(([dx, dy]) => [lon + dx, lat + dy]), [lon, lat]])
}

function generateForecastCone(point: GridPoint, bearingDeg: number = 45): { polygon: number[][]; centerPath: number[][] } {
  const { lon, lat } = point
  const rad = (bearingDeg * Math.PI) / 180
  const cosB = Math.cos(rad), sinB = Math.sin(rad)
  const cosP = Math.cos(rad + Math.PI / 2), sinP = Math.sin(rad + Math.PI / 2)
  const steps = [0.6, 1.2, 1.8, 2.4]
  const spreads = [0.15, 0.3, 0.5, 0.7]
  const left: number[][] = [], right: number[][] = [], center: number[][] = [[lon, lat]]
  for (let i = 0; i < steps.length; i++) {
    const cx = lon + sinB * steps[i], cy = lat + cosB * steps[i]
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
  onBack: () => void
  loading: boolean
  detail?: SevereWeatherDetail | null
}

export function WorldTornadoMap({ gridData, selectedPoint, onPointSelect, onBack, loading, detail }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const onPointRef = useRef(onPointSelect)
  const onBackRef = useRef(onBack)
  const markersRef = useRef<{ remove: () => void }[]>([])
  const rafRef = useRef<number>(0)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [viewMode, setViewMode] = useState<"world" | "country" | "point">("world")
  const [activeCountryIso, setActiveCountryIso] = useState<string | null>(null)
  const viewModeRef = useRef<"world" | "country" | "point">("world")
  const countryDataRef = useRef<Record<string, { risk: string; points: GridPoint[] }>>({})
  const prevSelectedPointRef = useRef<GridPoint | null>(null)

  useEffect(() => { onPointRef.current = onPointSelect }, [onPointSelect])
  useEffect(() => { onBackRef.current = onBack }, [onBack])
  useEffect(() => { viewModeRef.current = viewMode }, [viewMode])

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
        style: "mapbox://styles/mapbox/satellite-streets-v12",
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

        // Base country fill (choropleth) — starts transparent, colored once data arrives
        map.addLayer({
          id: "country-fills",
          type: "fill",
          source: "countries",
          "source-layer": "country_boundaries",
          paint: {
            "fill-color": "#1a1f2e",
            "fill-opacity": 0.6,
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

        // Selected country glow
        map.addLayer({
          id: "country-glow",
          type: "fill",
          source: "countries",
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "___"],
          paint: { "fill-color": "#ffffff", "fill-opacity": 0.10 },
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

        map.addSource("forecast-cone", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[]] } } as never })
        map.addLayer({ id: "cone-fill", type: "fill", source: "forecast-cone", paint: { "fill-color": "#a855f7", "fill-opacity": 0.12 } })
        map.addLayer({ id: "cone-outline", type: "line", source: "forecast-cone", paint: { "line-color": "#a855f7", "line-opacity": 0.6, "line-width": 1.2, "line-dasharray": [5, 4] } })

        map.addSource("cone-path", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } as never })
        map.addLayer({ id: "cone-center", type: "line", source: "cone-path", paint: { "line-color": "#e9d5ff", "line-opacity": 0.7, "line-width": 1.4, "line-dasharray": [6, 4] } })

        map.addSource("wind-flows", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        map.addLayer({ id: "wind-lines", type: "line", source: "wind-flows", paint: { "line-color": "#67e8f9", "line-opacity": 0.5, "line-width": 1.3, "line-dasharray": [2, 3] } })

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

        // ─── Hover tooltip on countries ───
        map.on("mousemove", "country-fills", (e) => {
          if (viewModeRef.current !== "world") return
          if (!e.features?.length) return
          const iso = e.features[0].properties?.iso_3166_1_alpha_3 as string
          const info = countryDataRef.current[iso]
          const tEl = tooltipRef.current!
          if (info && ISO_NAME[iso]) {
            const color = RISK_COLOR[info.risk] || "#22c55e"
            const labels: Record<string, string> = { LOW: "Bajo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" }
            tEl.innerHTML = `
              <div style="font-weight:800;font-size:13px;color:#f8fafc;margin-bottom:4px">${ISO_NAME[iso]}</div>
              <div style="display:flex;align-items:center;gap:7px">
                <div style="width:9px;height:9px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}"></div>
                <span style="color:${color};font-weight:700;font-size:11px">${labels[info.risk] ?? "—"}</span>
                <span style="color:#94a3b8;font-size:10px">· ${info.points.length} foco${info.points.length !== 1 ? "s" : ""}</span>
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
          if (!iso || !countryDataRef.current[iso]) return
          if (tooltipRef.current) tooltipRef.current.style.display = "none"
          // If in point mode, clear point first
          if (viewModeRef.current === "point") onBackRef.current()
          setActiveCountryIso(iso)
          setViewMode("country")
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
          setViewMode("point")
          onPointRef.current(p)
        })

        // ─── Click empty → back to world ───
        map.on("click", (e) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: ["points-circle", "country-fills"] })
          if (hits.length === 0 && viewModeRef.current !== "world") {
            setActiveCountryIso(null)
            setViewMode("world")
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
    for (const [iso, info] of Object.entries(countryAgg)) {
      expr.push(iso, RISK_COLOR[info.risk] ?? "#1a1f2e")
    }
    expr.push("#1a1f2e") // fallback for countries without data

    // Apply once the style is ready
    const apply = () => {
      try {
        map.setPaintProperty("country-fills", "fill-color", expr as never)
        map.setPaintProperty("country-fills", "fill-opacity", 0.75)
      } catch {}
    }

    if (map.isStyleLoaded()) apply()
    else map.once("idle", apply)
  }, [gridData, mapReady])

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
      map.setFilter("country-glow", hide as never)
      map.setFilter("country-highlight-border", hide as never)

      // Hide points
      const src = map.getSource("weather-points") as { setData?: (d: unknown) => void } | undefined
      src?.setData?.({ type: "FeatureCollection", features: [] })

      clearAllOverlays()
      map.flyTo({ center: [-20, 20], zoom: 2, duration: 1200 })

    } else if (viewMode === "country" && activeCountryIso) {
      const info = countryDataRef.current[activeCountryIso]
      const color = info ? (RISK_COLOR[info.risk] ?? "#1a1f2e") : "#1a1f2e"
      const filter: unknown[] = ["==", ["get", "iso_3166_1_alpha_3"], activeCountryIso]

      // Dim others, highlight selected
      map.setPaintProperty("country-fills", "fill-opacity", 0.2)
      map.setPaintProperty("country-borders", "line-opacity", 0.25)
      map.setPaintProperty("country-highlight", "fill-color", color)
      map.setPaintProperty("country-highlight", "fill-opacity", 0.55)
      map.setFilter("country-highlight", filter as never)
      map.setFilter("country-glow", filter as never)
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
      }

      clearAllOverlays()

      // Zoom to country
      const bbox = COUNTRY_BBOX[activeCountryIso]
      if (bbox) {
        const [w, s, e, n] = bbox
        const padLng = Math.max((e - w) * 0.15, 2)
        const padLat = Math.max((n - s) * 0.15, 1)
        map.fitBounds(
          [[w - padLng, s - padLat], [e + padLng, n + padLat]] as LngLatBoundsLike,
          { duration: 1200, padding: { top: 80, bottom: 80, left: 380, right: 380 } }
        )
      }
    }
  }, [viewMode, activeCountryIso, mapReady])

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
      if (activeCountryIso) {
        setViewMode("country")
      } else {
        setViewMode("world")
      }
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

    // Risk zones
    const zones = generateRiskZones(point)
    const zSrc = map.getSource("risk-zones") as { setData?: (d: unknown) => void } | undefined
    zSrc?.setData?.({
      type: "FeatureCollection",
      features: zones.map(z => ({
        type: "Feature", properties: { color: z.color, opacity: z.opacity, outlineOpacity: z.outlineOpacity },
        geometry: { type: "Polygon", coordinates: [z.coords] },
      })),
    })

    // Wind flows
    const flows = generateWindFlows(point)
    const wSrc = map.getSource("wind-flows") as { setData?: (d: unknown) => void } | undefined
    wSrc?.setData?.({
      type: "FeatureCollection",
      features: flows.map(c => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })),
    })

    // Forecast cone
    const bearing = detail?.forecast_risk?.[0]?.impact_corridor?.bearing_degrees ?? 45
    const { polygon, centerPath } = generateForecastCone(point, bearing)
    const cSrc = map.getSource("forecast-cone") as { setData?: (d: unknown) => void } | undefined
    cSrc?.setData?.({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [polygon] } })
    const pSrc = map.getSource("cone-path") as { setData?: (d: unknown) => void } | undefined
    pSrc?.setData?.({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: centerPath } })

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
    const eLine = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } }
    const ePoly = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[]] } }
    ;(["risk-zones", "wind-flows"] as const).forEach(id => {
      (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(empty)
    })
    ;(["forecast-cone"] as const).forEach(id => {
      (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(ePoly)
    })
    ;(["cone-path"] as const).forEach(id => {
      (map.getSource(id) as { setData?: (d: unknown) => void } | undefined)?.setData?.(eLine)
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
            if (viewMode === "point") {
              onBackRef.current()
            } else {
              setActiveCountryIso(null)
              setViewMode("world")
              onBackRef.current()
            }
          }}
          className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-[#0a0b0e]/85 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 hover:bg-[#0a0b0e]/95 hover:border-white/30 transition-all cursor-pointer shadow-lg"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            {viewMode === "point" && activeCountryIso
              ? `← ${ISO_NAME[activeCountryIso] ?? "País"}`
              : "← Vista Global"
            }
          </span>
        </button>
      )}

      {/* Country info badge (country mode) */}
      {viewMode === "country" && activeCountryIso && countryDataRef.current[activeCountryIso] && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0a0b0e]/85 backdrop-blur-md border border-white/10 rounded-full px-5 py-2 shadow-lg">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: RISK_COLOR[countryDataRef.current[activeCountryIso]!.risk] || "#22c55e",
              boxShadow: `0 0 8px ${RISK_COLOR[countryDataRef.current[activeCountryIso]!.risk] || "#22c55e"}`,
            }}
          />
          <span className="text-[12px] font-bold text-white">
            {ISO_NAME[activeCountryIso] ?? activeCountryIso}
          </span>
          <span className="text-[10px] text-white/50">
            {countryDataRef.current[activeCountryIso]!.points.length} foco{countryDataRef.current[activeCountryIso]!.points.length !== 1 ? "s" : ""} detectado{countryDataRef.current[activeCountryIso]!.points.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
