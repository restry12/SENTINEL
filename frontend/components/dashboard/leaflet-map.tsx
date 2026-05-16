"use client"

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import type { Hotspot } from "@/hooks/use-socket"

// NASA GIBS MODIS Terra true-color satellite tiles (free, no API key needed)
// TODO: swap TILE_URL for FIRMS satellite tiles when NEXT_PUBLIC_FIRMS_TOKEN is ready
const today = new Date().toISOString().split("T")[0]
const TILE_URL = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`

const INTENSITY_COLOR: Record<Hotspot["intensity"], string> = {
  low:      "#22c55e",
  medium:   "#eab308",
  high:     "#f97316",
  critical: "#ef4444",
}

const INTENSITY_RADIUS: Record<Hotspot["intensity"], number> = {
  low:      7,
  medium:   9,
  high:     11,
  critical: 14,
}

interface LeafletMapProps {
  hotspots: Hotspot[]
}

export function LeafletMap({ hotspots }: LeafletMapProps) {
  return (
    <MapContainer
      center={[34.05, -118.24]}
      zoom={10}
      style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
      zoomControl={false}
    >
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://earthdata.nasa.gov">NASA GIBS</a>'
        maxZoom={9}
      />
      {hotspots.map((spot) => (
        <CircleMarker
          key={spot.id}
          center={[spot.lat, spot.lng]}
          radius={INTENSITY_RADIUS[spot.intensity]}
          pathOptions={{
            color:       INTENSITY_COLOR[spot.intensity],
            fillColor:   INTENSITY_COLOR[spot.intensity],
            fillOpacity: 0.65,
            weight:      spot.intensity === "critical" ? 2 : 1,
          }}
        >
          <Popup>
            <div style={{ fontFamily: "monospace", fontSize: "12px" }}>
              <strong>{spot.label ?? spot.id}</strong>
              <br />
              FRP: {spot.frp} MW
              <br />
              {spot.intensity.toUpperCase()}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
