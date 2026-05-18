"use client"

import { useEffect, useRef } from "react"
import type { Map as MapboxMap, LngLatBoundsLike } from "mapbox-gl"

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"

// ── ISO alpha-3 → country name
export const ISO_TO_COUNTRY: Record<string, string> = {
  AFG:"Afghanistan",ALB:"Albania",DZA:"Algeria",AND:"Andorra",AGO:"Angola",
  ARG:"Argentina",ARM:"Armenia",ABW:"Aruba",AUS:"Australia",AUT:"Austria",
  AZE:"Azerbaijan",BHR:"Bahrain",BGD:"Bangladesh",BRB:"Barbados",BLR:"Belarus",
  BEL:"Belgium",BLZ:"Belize",BEN:"Benin",BTN:"Bhutan",
  BOL:"Bolivia (Plurinational State of)",BIH:"Bosnia and Herzegovina",
  BWA:"Botswana",BRA:"Brazil",BGR:"Bulgaria",BFA:"Burkina Faso",BDI:"Burundi",
  CPV:"Cabo Verde",KHM:"Cambodia",CMR:"Cameroon",CAN:"Canada",
  CAF:"Central African Republic",TCD:"Chad",CHL:"Chile",CHN:"China",
  COL:"Colombia",COM:"Comoros",COG:"Congo",CRI:"Costa Rica",HRV:"Croatia",
  CUB:"Cuba",CYP:"Cyprus",CZE:"Czechia",CIV:"Côte d'Ivoire",
  COD:"Democratic Republic of the Congo",DNK:"Denmark",DOM:"Dominican Republic",
  ECU:"Ecuador",EGY:"Egypt",SLV:"El Salvador",GNQ:"Equatorial Guinea",
  ERI:"Eritrea",EST:"Estonia",ETH:"Ethiopia",FIN:"Finland",FRA:"France",
  GAB:"Gabon",GMB:"Gambia",GEO:"Georgia",DEU:"Germany",GHA:"Ghana",
  GRC:"Greece",GTM:"Guatemala",GIN:"Guinea",GNB:"Guinea-Bissau",GUY:"Guyana",
  HTI:"Haiti",HND:"Honduras",HUN:"Hungary",ISL:"Iceland",IND:"India",
  IDN:"Indonesia",IRN:"Iran (Islamic Republic of)",IRQ:"Iraq",IRL:"Ireland",
  ISR:"Israel",ITA:"Italy",JAM:"Jamaica",JPN:"Japan",JOR:"Jordan",
  KAZ:"Kazakhstan",KEN:"Kenya",SWZ:"Kingdom of Eswatini",KWT:"Kuwait",
  KGZ:"Kyrgyzstan",LAO:"Lao People's Democratic Republic",LVA:"Latvia",
  LBN:"Lebanon",LSO:"Lesotho",LBR:"Liberia",LBY:"Libya",LTU:"Lithuania",
  LUX:"Luxembourg",MDG:"Madagascar",MWI:"Malawi",MYS:"Malaysia",MDV:"Maldives",
  MLI:"Mali",MLT:"Malta",MRT:"Mauritania",MUS:"Mauritius",MEX:"Mexico",
  MCO:"Monaco",MNG:"Mongolia",MNE:"Montenegro",MAR:"Morocco",MOZ:"Mozambique",
  MMR:"Myanmar",NAM:"Namibia",NPL:"Nepal",NLD:"Netherlands",NZL:"New Zealand",
  NIC:"Nicaragua",NER:"Niger",NGA:"Nigeria",NOR:"Norway",OMN:"Oman",
  PAK:"Pakistan",PLW:"Palau",PAN:"Panama",PNG:"Papua New Guinea",PRY:"Paraguay",
  PER:"Peru",PHL:"Philippines",POL:"Poland",PRT:"Portugal",QAT:"Qatar",
  KOR:"Republic of Korea",MDA:"Republic of Moldova",MKD:"Republic of North Macedonia",
  ROU:"Romania",RUS:"Russian Federation",RWA:"Rwanda",KNA:"Saint Kitts and Nevis",
  LCA:"Saint Lucia",SAU:"Saudi Arabia",SEN:"Senegal",SRB:"Serbia",SYC:"Seychelles",
  SLE:"Sierra Leone",SGP:"Singapore",SVK:"Slovakia",SVN:"Slovenia",
  SLB:"Solomon Islands",SOM:"Somalia",ZAF:"South Africa",SSD:"South Sudan",
  ESP:"Spain",LKA:"Sri Lanka",PSE:"State of Palestine",SDN:"Sudan",SUR:"Suriname",
  SWE:"Sweden",CHE:"Switzerland",SYR:"Syrian Arab Republic",TJK:"Tajikistan",
  THA:"Thailand",TGO:"Togo",TTO:"Trinidad and Tobago",TUN:"Tunisia",TUR:"Turkey",
  TKM:"Turkmenistan",UGA:"Uganda",UKR:"Ukraine",ARE:"United Arab Emirates",
  GBR:"United Kingdom of Great Britain and Northern Ireland",
  TZA:"United Republic of Tanzania",USA:"United States of America",
  URY:"Uruguay",UZB:"Uzbekistan",VUT:"Vanuatu",
  VEN:"Venezuela (Bolivarian Republic of)",VNM:"Viet Nam",
  YEM:"Yemen",ZMB:"Zambia",ZWE:"Zimbabwe",
}
export const COUNTRY_TO_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_TO_COUNTRY).map(([k, v]) => [v, k])
)

export type AQICategory = "good" | "semi-good" | "semi-bad" | "bad" | "none"

export const CATEGORY_COLORS: Record<string, string> = {
  good: "#00ff7f", "semi-good": "#ffd700", "semi-bad": "#ff6600", bad: "#ff1a1a",
}

export interface CountryData {
  avgAQI: number; maxAQI: number; minAQI: number; records: number; cities: number
  co: number|null; ozone: number|null; no2: number|null; pm25: number|null
  score: number; category: AQICategory; dominant: string; vsGlobal: number
  bbox?: [number, number, number, number]
}

export interface CityFeature {
  city: string; country: string; hasData: boolean
  avgAQI: number|null; score: number|null; category: AQICategory; color: string
  pm25: number|null; ozone: number|null; no2: number|null; co: number|null
  dominant: string|null; records: number
  lng: number; lat: number
}

interface Props {
  countryData:     Record<string, CountryData>
  selectedCountry: string | null
  onCountrySelect: (country: string) => void
}

export function WorldAirMap({ countryData, selectedCountry, onCountrySelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<MapboxMap | null>(null)
  const tooltipRef   = useRef<HTMLDivElement | null>(null)
  const modeRef      = useRef<"world" | "country">("world")

  const onCountryRef = useRef(onCountrySelect)
  useEffect(() => { onCountryRef.current = onCountrySelect }, [onCountrySelect])

  // ── Init map once ──
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

    // tooltip
    const tip = document.createElement("div")
    Object.assign(tip.style, {
      position:"absolute", pointerEvents:"none", zIndex:"30", display:"none",
      background:"rgba(4,6,10,0.96)", border:"1px solid rgba(255,255,255,0.15)",
      borderRadius:"8px", padding:"8px 12px", fontFamily:"'Geist Mono',monospace",
      fontSize:"11px", color:"#e2e8f0", backdropFilter:"blur(12px)",
      whiteSpace:"nowrap", boxShadow:"0 4px 24px rgba(0,0,0,0.7)", lineHeight:"1.6",
    })
    el.appendChild(tip)
    tooltipRef.current = tip

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return
      mapboxgl.accessToken = TOKEN

      const map = new mapboxgl.Map({
        container: el,
        style:  "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-20, 20],
        zoom:   2,
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

        // ── White text labels ──
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type !== "symbol") return
          try { map.setPaintProperty(layer.id, "text-color", "#ffffff") } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.75)") } catch { /* skip */ }
          try { map.setPaintProperty(layer.id, "text-halo-width", 1.5) } catch { /* skip */ }
        })

        // ── Country boundaries source ──
        map.addSource("country-fills", {
          type: "vector",
          url:  "mapbox://mapbox.country-boundaries-v1",
        })

        // Choropleth match expression
        const colorMatch: unknown[] = ["match", ["get", "iso_3166_1_alpha_3"]]
        for (const [iso, name] of Object.entries(ISO_TO_COUNTRY)) {
          const d = countryData[name]
          colorMatch.push(iso, d ? CATEGORY_COLORS[d.category] ?? "#1e293b" : "#1e293b")
        }
        colorMatch.push("#1e293b")

        // Base choropleth fill (all countries, slightly dimmed when one is selected)
        map.addLayer({
          id: "country-fill",
          type: "fill",
          source: "country-fills",
          "source-layer": "country_boundaries",
          paint: {
            "fill-color":   colorMatch as never,
            "fill-opacity": 0.75,
          },
        })

        // Subtle borders
        map.addLayer({
          id: "country-border",
          type: "line",
          source: "country-fills",
          "source-layer": "country_boundaries",
          paint: {
            "line-color": "rgba(255,255,255,0.12)",
            "line-width": 0.6,
          },
        })

        // Selected country — vivid solid fill on top (overrides base opacity)
        map.addLayer({
          id: "country-selected-fill",
          type: "fill",
          source: "country-fills",
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "___"],
          paint: {
            "fill-color":   "#ffffff",  // overridden dynamically via setPaintProperty
            "fill-opacity": 1.0,
          },
        })

        // White glow overlay on selected country
        map.addLayer({
          id: "country-selected-glow",
          type: "fill",
          source: "country-fills",
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "___"],
          paint: {
            "fill-color":   "#ffffff",
            "fill-opacity": 0.14,
          },
        })

        // Bright white border on selected country
        map.addLayer({
          id: "country-selected-border",
          type: "line",
          source: "country-fills",
          "source-layer": "country_boundaries",
          filter: ["==", ["get", "iso_3166_1_alpha_3"], "___"],
          paint: {
            "line-color":   "#ffffff",
            "line-width":   2.5,
            "line-opacity": 1,
          },
        })

        // ── HOVER ──
        map.on("mousemove", "country-fill", (e) => {
          if (!e.features?.length) return
          const props = e.features[0].properties as Record<string, unknown>
          const iso   = props?.iso_3166_1_alpha_3 as string
          const name  = ISO_TO_COUNTRY[iso]
          const d     = name ? countryData[name] : null
          const tEl   = tooltipRef.current!
          if (name && d) {
            const col = CATEGORY_COLORS[d.category] ?? "#475569"
            const catLabel: Record<string,string> = { good:"Bueno","semi-good":"Semi Bueno","semi-bad":"Semi Malo",bad:"Malo" }
            tEl.innerHTML = [
              `<div style="font-weight:800;font-size:12px;color:#f0f2f5;margin-bottom:3px">${name}</div>`,
              `<div style="display:flex;align-items:center;gap:6px">`,
              `  <div style="width:8px;height:8px;border-radius:50%;background:${col};box-shadow:0 0 6px ${col}"></div>`,
              `  <span style="color:${col};font-weight:700;font-size:10px">${catLabel[d.category] ?? "—"}</span>`,
              `  <span style="color:#64748b;font-size:10px">· AQI ${d.avgAQI}</span>`,
              `</div>`,
              `<div style="color:#475569;font-size:9px;margin-top:3px">Haz clic para explorar</div>`,
            ].join("")
            tEl.style.display = "block"
          } else {
            tEl.style.display = "none"
          }
          tEl.style.left = `${e.point.x + 14}px`
          tEl.style.top  = `${e.point.y - 8}px`
          map.getCanvas().style.cursor = (name && d) ? "pointer" : "default"
        })
        map.on("mouseleave", "country-fill", () => {
          if (tooltipRef.current) tooltipRef.current.style.display = "none"
          map.getCanvas().style.cursor = "default"
        })

        // ── CLICK – country ──
        map.on("click", "country-fill", (e) => {
          if (!e.features?.length) return
          e.originalEvent.stopPropagation()
          const iso  = (e.features[0].properties as Record<string,unknown>)?.iso_3166_1_alpha_3 as string
          const name = ISO_TO_COUNTRY[iso]
          if (!name || !countryData[name]) return
          onCountryRef.current(name)
        })
      })
    }).catch(err => console.error("[WorldAirMap]", err))

    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync selectedCountry → highlight + zoom ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (!map.getLayer("country-selected-border")) return

      const iso    = selectedCountry ? (COUNTRY_TO_ISO[selectedCountry] ?? "___") : "___"
      const filter: unknown[] = ["==", ["get", "iso_3166_1_alpha_3"], iso]
      const hideFilter: unknown[] = ["==", ["get", "iso_3166_1_alpha_3"], "___"]

      if (selectedCountry) {
        modeRef.current = "country"
        const d = countryData[selectedCountry]
        const selColor = d ? (CATEGORY_COLORS[d.category] ?? "#1e293b") : "#1e293b"

        // Dim all other countries
        map.setPaintProperty("country-fill", "fill-opacity", 0.28)
        map.setPaintProperty("country-border", "line-opacity", 0.3)

        // Paint selected country at full vivid color
        map.setPaintProperty("country-selected-fill", "fill-color", selColor)
        map.setFilter("country-selected-fill",   filter as never)
        map.setFilter("country-selected-glow",   filter as never)
        map.setFilter("country-selected-border", filter as never)

        // Zoom to bbox
        if (d?.bbox) {
          const [w, s, e, n] = d.bbox
          const padLng = Math.max((e - w) * 0.15, 2)
          const padLat = Math.max((n - s) * 0.15, 1)
          map.fitBounds(
            [[w - padLng, s - padLat], [e + padLng, n + padLat]] as LngLatBoundsLike,
            { duration: 1200, padding: 80 }
          )
        }
      } else {
        const center = map.getCenter()
        modeRef.current = "world"

        // Restore all countries
        map.setPaintProperty("country-fill", "fill-opacity", 0.75)
        map.setPaintProperty("country-border", "line-opacity", 1)

        // Hide selected layers
        map.setFilter("country-selected-fill",   hideFilter as never)
        map.setFilter("country-selected-glow",   hideFilter as never)
        map.setFilter("country-selected-border", hideFilter as never)

        map.flyTo({ center: [center.lng, center.lat], zoom: 2, duration: 1200 })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once("idle", apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry])

  return <div ref={containerRef} style={{ position:"absolute", inset:0 }} />
}
