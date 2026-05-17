"use client"

import { useEffect, useRef } from "react"
import type { Map as MapboxMap } from "mapbox-gl"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

export interface TornadoCell {
  id:          string
  name:        string
  code:        string
  lat:         number
  lng:         number
  risk:        'extreme' | 'confirmed' | 'high' | 'rotation' | 'moderate' | 'low'
  ef:          string
  prob:        number
  wind:        number
  eta:         number
  rotacion:    number
  description: string
  aiPrediction:string
}

export const TORNADO_CELLS: TornadoCell[] = [
  {
    id: 'northcell', name: 'Supercelda Norte', code: 'N1',
    lat: 39.42, lng: -95.18, risk: 'extreme', ef: 'EF2 – EF3',
    prob: 78, wind: 142, eta: 23, rotacion: 38,
    description: 'Mesociclón · Rotación · 38 kt',
    aiPrediction: 'Modelo HRRR-v4 estima descenso de nube embudo en 11–14 min con trayectoria NE hacia zona urbana. Confianza 0.83.',
  },
  {
    id: 'westfront', name: 'Frente Oeste', code: 'W2',
    lat: 37.85, lng: -98.50, risk: 'high', ef: 'EF1 – EF2',
    prob: 42, wind: 96, eta: 47, rotacion: 24,
    description: 'Línea de turbonada · 24 kt',
    aiPrediction: 'Línea de turbonada con tendencia a organización. Vigilar evolución de cizalladura vertical en próximos 30 min.',
  },
  {
    id: 'southcore', name: 'Núcleo Sur', code: 'S3',
    lat: 36.60, lng: -96.20, risk: 'rotation', ef: 'EF0 – EF1',
    prob: 35, wind: 78, eta: 61, rotacion: 18,
    description: 'Rotación detectada · 18 kt',
    aiPrediction: 'Rotación detectada en niveles medios. Sin signatura de tornado aún. Reevaluar en próxima pasada radar.',
  },
]

const RISK_COLOR: Record<string, string> = {
  extreme:  '#ef4444',
  confirmed:'#a855f7',
  high:     '#f97316',
  rotation: '#c4b5fd',
  moderate: '#eab308',
  low:      '#22c55e',
}

function makeEllipse(cx: number, cy: number, rx: number, ry: number, n = 64): number[][] {
  const pts: number[][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return pts
}

interface Props {
  selectedCell:  TornadoCell | null
  onCellSelect:  (cell: TornadoCell) => void
}

export function WorldTornadoMap({ selectedCell, onCellSelect }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<MapboxMap | null>(null)
  const onCellRef      = useRef(onCellSelect)
  const rafRef         = useRef<number>(0)
  const markersRef     = useRef<{ remove: () => void }[]>([])

  useEffect(() => { onCellRef.current = onCellSelect }, [onCellSelect])

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
        style:  "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-97, 38.5],
        zoom:   4.8,
        minZoom: 2,
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

        // White text labels (same as WorldAirMap)
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type !== "symbol") return
          try { map.setPaintProperty(layer.id, "text-color", "#ffffff") } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.75)") } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, "text-halo-width", 1.5) } catch { /* skip */ }
        })

        // ── Risk zone polygons ──
        const zones = [
          { id: 'low',      coords: makeEllipse(-97.5, 38.2, 9.5, 6.0),  color: '#22c55e', opacity: 0.10, outlineOpacity: 0.35 },
          { id: 'moderate', coords: makeEllipse(-97.0, 38.6, 6.5, 4.0),  color: '#eab308', opacity: 0.12, outlineOpacity: 0.42 },
          { id: 'high',     coords: makeEllipse(-96.2, 39.0, 4.0, 2.5),  color: '#f97316', opacity: 0.16, outlineOpacity: 0.55 },
          { id: 'extreme',  coords: makeEllipse(-95.7, 39.2, 2.2, 1.5),  color: '#ef4444', opacity: 0.22, outlineOpacity: 0.70 },
          { id: 'confirmed',coords: makeEllipse(-95.22, 39.42, 0.8, 0.55), color: '#a855f7', opacity: 0.28, outlineOpacity: 0.90 },
        ]

        map.addSource("risk-zones", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: zones.map(z => ({
              type: "Feature",
              properties: { zone: z.id, color: z.color, opacity: z.opacity, outlineOpacity: z.outlineOpacity },
              geometry: { type: "Polygon", coordinates: [z.coords] },
            })),
          } as never,
        })

        map.addLayer({ id: "risk-fill", type: "fill", source: "risk-zones",
          paint: {
            "fill-color":   ["get", "color"],
            "fill-opacity": ["get", "opacity"],
          },
        })
        map.addLayer({ id: "risk-outline", type: "line", source: "risk-zones",
          paint: {
            "line-color":   ["get", "color"],
            "line-opacity": ["get", "outlineOpacity"],
            "line-width":   1.2,
            "line-dasharray": [4, 4],
          },
        })

        // ── Forecast cone ──
        map.addSource("forecast-cone", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [[
                [-95.18, 39.42], [-94.3, 40.1], [-93.2, 40.7],
                [-92.2, 41.2],   [-91.4, 41.6], [-91.2, 41.0],
                [-92.0, 40.3],   [-93.4, 39.8], [-94.5, 39.5],
                [-95.18, 39.42],
              ]],
            },
          } as never,
        })
        map.addLayer({ id: "cone-fill", type: "fill", source: "forecast-cone",
          paint: { "fill-color": "#a855f7", "fill-opacity": 0.10 },
        })
        map.addLayer({ id: "cone-outline", type: "line", source: "forecast-cone",
          paint: {
            "line-color": "#a855f7", "line-opacity": 0.55,
            "line-width": 1.0, "line-dasharray": [5, 4],
          },
        })

        // Forecast cone center path
        map.addSource("cone-path", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [[-95.18, 39.42], [-93.8, 40.4], [-92.5, 41.0], [-91.4, 41.4]],
            },
          } as never,
        })
        map.addLayer({ id: "cone-path", type: "line", source: "cone-path",
          paint: { "line-color": "#e9d5ff", "line-opacity": 0.80, "line-width": 1.4, "line-dasharray": [6, 4] },
        })

        // ── Wind flow lines (converging at primary cell) ──
        map.addSource("wind-flows", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:[[-104,44],[-101,42.5],[-98,41.2],[-96,40.1],[-95.18,39.42]] } },
              { type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:[[-106,40.5],[-103,40],[-99.5,39.8],[-96.5,39.6],[-95.18,39.42]] } },
              { type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:[[-103,36.5],[-100,37.2],[-97.5,38.0],[-96,38.7],[-95.18,39.42]] } },
              { type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:[[-97.5,33.5],[-97,35.2],[-96.5,37.0],[-95.8,38.5],[-95.18,39.42]] } },
              { type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:[[-90.5,37.5],[-91.5,38],[-93,38.6],[-94.2,39.0],[-95.18,39.42]] } },
              { type:"Feature", properties:{}, geometry:{ type:"LineString", coordinates:[[-88.5,40.5],[-90.5,40],[-92.5,39.8],[-94,39.5],[-95.18,39.42]] } },
            ],
          } as never,
        })
        map.addLayer({ id: "wind-flow", type: "line", source: "wind-flows",
          paint: {
            "line-color": "#67e8f9",
            "line-opacity": 0.55,
            "line-width":   1.4,
            "line-dasharray": [2, 3],
          },
        })

        // Animate wind dash offset
        let dashOffset = 0
        function animateDash() {
          if (!mapRef.current) return
          dashOffset -= 0.4
          try { (map as any).setPaintProperty("wind-flow", "line-dash-offset", dashOffset) } catch { /* skip */ }
          rafRef.current = requestAnimationFrame(animateDash)
        }
        rafRef.current = requestAnimationFrame(animateDash)

        // ── Tornado cells as GeoJSON circles ──
        map.addSource("tornado-cells", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: TORNADO_CELLS.map(c => ({
              type: "Feature",
              properties: { id: c.id, code: c.code, name: c.name, risk: c.risk },
              geometry: { type: "Point", coordinates: [c.lng, c.lat] },
            })),
          } as never,
        })

        // Outer glow ring
        map.addLayer({ id: "cells-glow", type: "circle", source: "tornado-cells",
          paint: {
            "circle-radius": 28,
            "circle-color":  ["match", ["get", "risk"],
              "extreme", "#ef4444", "confirmed", "#a855f7",
              "high",    "#f97316", "rotation",  "#c4b5fd",
              "#eab308"
            ],
            "circle-opacity": 0.12,
            "circle-blur":    1.0,
          },
        })
        // Main circle
        map.addLayer({ id: "cells-circle", type: "circle", source: "tornado-cells",
          paint: {
            "circle-radius": 10,
            "circle-color":  ["match", ["get", "risk"],
              "extreme", "#ef4444", "confirmed", "#a855f7",
              "high",    "#f97316", "rotation",  "#c4b5fd",
              "#eab308"
            ],
            "circle-opacity": 0.85,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": 0.6,
          },
        })
        // Code labels (N1, W2, S3)
        map.addLayer({ id: "cells-label", type: "symbol", source: "tornado-cells",
          layout: {
            "text-field": ["get", "code"],
            "text-font":  ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
            "text-size":  10,
            "text-offset": [0, -1.8],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color":       "#ffffff",
            "text-halo-color":  "rgba(0,0,0,0.8)",
            "text-halo-width":  1.5,
          },
        })

        // ── Click handler ──
        map.on("click", "cells-circle", (e) => {
          const feat = e.features?.[0]
          if (!feat) return
          const id = feat.properties?.id as string
          const cell = TORNADO_CELLS.find(c => c.id === id)
          if (cell) onCellRef.current(cell)
        })
        map.on("mouseenter", "cells-circle", () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "cells-circle", () => { map.getCanvas().style.cursor = "" })
        map.on("mouseenter", "cells-glow",   () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "cells-glow",   () => { map.getCanvas().style.cursor = "" })

        // ── Radar scan DOM overlay on primary cell ──
        const radarEl = document.createElement("div")
        radarEl.style.cssText = [
          "width:220px;height:220px;position:relative;pointer-events:none;",
          "transform:translate(-50%,-50%);",
        ].join("")

        const style = document.createElement("style")
        style.textContent = `
          @keyframes sentinelSpin { to { transform: rotate(360deg); } }
          @keyframes sentinelPing { 0%{r:8;opacity:.9} 80%{r:40;opacity:0} 100%{r:40;opacity:0} }
          .sr { animation: sentinelSpin linear infinite; transform-origin: center; }
          .sp { animation: sentinelPing 2.8s cubic-bezier(0,0,.2,1) infinite; }
        `
        if (!document.getElementById("sentinel-tornado-style")) {
          style.id = "sentinel-tornado-style"
          document.head.appendChild(style)
        }

        radarEl.innerHTML = `
          <svg width="220" height="220" viewBox="0 0 220 220" style="overflow:visible">
            <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(34,211,238,0.12)" stroke-width="0.7"/>
            <circle cx="110" cy="110" r="70"  fill="none" stroke="rgba(34,211,238,0.15)" stroke-width="0.7"/>
            <circle cx="110" cy="110" r="42"  fill="none" stroke="rgba(34,211,238,0.18)" stroke-width="0.7"/>
            <line x1="10" y1="110" x2="210" y2="110" stroke="rgba(34,211,238,0.12)" stroke-width="0.5"/>
            <line x1="110" y1="10" x2="110" y2="210" stroke="rgba(34,211,238,0.12)" stroke-width="0.5"/>
            <g class="sr" style="animation-duration:6s">
              <path d="M110 110 L210 110 A100 100 0 0 1 160 196.6 Z" fill="url(#scanGrad)" opacity="0.9"/>
              <defs>
                <radialGradient id="scanGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stop-color="rgba(34,211,238,0.55)"/>
                  <stop offset="0.7" stop-color="rgba(34,211,238,0.08)"/>
                  <stop offset="1" stop-color="rgba(34,211,238,0)"/>
                </radialGradient>
              </defs>
            </g>
            <g class="sr" style="animation-duration:8s;animation-direction:reverse" opacity="0.6">
              <path d="M110 110 Q124 96 138 110 Q124 124 110 110 Q96 96 82 110 Q96 124 110 110" stroke="#c4b5fd" stroke-width="1.4" fill="none"/>
              <path d="M110 110 Q86 124 82 110 Q96 86 110 110 Q124 86 138 110 Q124 134 110 110" stroke="#a78bfa" stroke-width="1.4" fill="none" opacity="0.8"/>
            </g>
            <circle cx="110" cy="110" r="5" fill="#fff" filter="url(#gw)"/>
            <circle cx="110" cy="110" r="2.5" fill="#fff"/>
            <defs>
              <filter id="gw"><feGaussianBlur stdDeviation="3" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <circle class="sp" cx="110" cy="110" fill="none" stroke="#a855f7" stroke-width="1.5"/>
          </svg>
        `

        const radarMarker = new mapboxgl.Marker({ element: radarEl, anchor: "center" })
          .setLngLat([-95.18, 39.42])
          .addTo(map)
        markersRef.current.push(radarMarker)

        // Secondary cell spirals
        const secondaryCells = [
          { lng: -98.50, lat: 37.85, color: "#fdba74" },
          { lng: -96.20, lat: 36.60, color: "#c4b5fd" },
        ]
        secondaryCells.forEach(({ lng, lat, color }) => {
          const el = document.createElement("div")
          el.style.cssText = "width:60px;height:60px;pointer-events:none;transform:translate(-50%,-50%)"
          el.innerHTML = `
            <svg width="60" height="60" viewBox="0 0 60 60" style="overflow:visible">
              <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
              <g class="sr" style="animation-duration:10s" opacity="0.7">
                <path d="M30 30 Q38 22 46 30 Q38 38 30 30 Q22 22 14 30 Q22 38 30 30" stroke="${color}" stroke-width="1.2" fill="none"/>
              </g>
              <circle cx="30" cy="30" r="3" fill="${color}"/>
              <circle class="sp" cx="30" cy="30" fill="none" stroke="${color}" stroke-width="1.2"/>
            </svg>
          `
          const m = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map)
          markersRef.current.push(m)
        })
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

  // Update selected cell visual highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const cellId = selectedCell?.id ?? "__none__"
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const widthExpr: any = ["match", ["get", "id"], cellId, 4, 2]
    const colorExpr: any = ["match", ["get", "id"], cellId, "#ffffff", "rgba(255,255,255,0.6)"]
    /* eslint-enable @typescript-eslint/no-explicit-any */
    try {
      map.setPaintProperty("cells-circle", "circle-stroke-width", widthExpr)
      map.setPaintProperty("cells-circle", "circle-stroke-color", colorExpr)
    } catch { /* map not ready */ }
  }, [selectedCell])

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />
}
