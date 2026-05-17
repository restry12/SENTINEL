"use client"

import { useEffect, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { useSentinel } from '@/contexts/sentinel-context'
import type { AirRiskCell, AirRiskTimeSlot } from '@/types/air-risk'

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
  EMERGENCY: '#7c2d92',
}

const SOURCE_ID = 'air-risk-grid-src'
const FILL_LAYER = 'air-risk-fill'
const LINE_LAYER = 'air-risk-line'

function getOpacityFromAqi(aqi: number): number {
  // AQI 0-50 → 0.08, AQI 300+ → 0.55
  const t = Math.min(aqi / 300, 1)
  return 0.08 + t * 0.47
}

function buildGeoJSON(cells: AirRiskCell[]) {
  const features = cells.map(cell => ({
    type: 'Feature' as const,
    properties: {
      id: cell.id,
      risk_level: cell.risk_level,
      aqi: cell.aqi,
      pm25: cell.pm25,
      ozone: cell.ozone,
      no2: cell.no2,
      co: cell.co,
      main_pollutant: cell.main_pollutant,
      confidence: cell.confidence,
      trend: cell.trend,
      nearest_fire_km: cell.nearest_fire_km,
      smoke_direction: cell.smoke_direction,
      lat: cell.lat,
      lon: cell.lon,
      fill_color: RISK_COLORS[cell.risk_level] || '#22c55e',
      fill_opacity: getOpacityFromAqi(cell.aqi),
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: cell.polygon,
    },
  }))
  return { type: 'FeatureCollection' as const, features }
}

interface AirRiskLayerProps {
  map: mapboxgl.Map | null
  visible: boolean
  timeSlot: AirRiskTimeSlot
  onTimeSlotChange: (slot: AirRiskTimeSlot) => void
  onCellSelect: (cell: AirRiskCell | null) => void
}

export function AirRiskLayer({ map, visible, timeSlot, onTimeSlotChange, onCellSelect }: AirRiskLayerProps) {
  const { sentinelUpdate } = useSentinel()

  const airRiskGrid = sentinelUpdate?.airRiskGrid

  // Clean up layers
  const removeLayers = useCallback((m: mapboxgl.Map) => {
    if (m.getLayer(FILL_LAYER)) m.removeLayer(FILL_LAYER)
    if (m.getLayer(LINE_LAYER)) m.removeLayer(LINE_LAYER)
    if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID)
  }, [])

  // Draw / update layers
  useEffect(() => {
    if (!map) return

    const draw = () => {
      removeLayers(map)

      if (!visible || !airRiskGrid) return

      const cells = airRiskGrid[timeSlot] ?? []
      if (cells.length === 0) return

      const geojson = buildGeoJSON(cells)

      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson as any })

      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['get', 'fill_color'],
          'fill-opacity': ['get', 'fill_opacity'],
        },
      })

      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['get', 'fill_color'],
          'line-width': 0.5,
          'line-opacity': 0.4,
        },
      })
    }

    if (map.isStyleLoaded()) draw()
    else map.once('style.load', draw)

    return () => {
      if (map && map.isStyleLoaded()) removeLayers(map)
    }
  }, [map, visible, airRiskGrid, timeSlot, removeLayers])

  // Click handler
  useEffect(() => {
    if (!map || !visible) return

    const handler = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const feat = e.features?.[0]
      if (!feat) return
      const props = feat.properties as any
      const cells = airRiskGrid?.[timeSlot] ?? []
      const cell = cells.find(c => c.id === props.id)
      if (cell) onCellSelect(cell)
    }

    map.on('click', FILL_LAYER, handler)
    map.on('mouseenter', FILL_LAYER, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', FILL_LAYER, () => { map.getCanvas().style.cursor = '' })

    return () => {
      map.off('click', FILL_LAYER, handler)
    }
  }, [map, visible, airRiskGrid, timeSlot, onCellSelect])

  if (!visible) return null

  const slots: { key: AirRiskTimeSlot; label: string }[] = [
    { key: 'now', label: 'Now' },
    { key: 'plus2h', label: '+2h' },
    { key: 'plus6h', label: '+6h' },
    { key: 'plus12h', label: '+12h' },
  ]

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl">
        {slots.map(s => (
          <button
            key={s.key}
            onClick={() => onTimeSlotChange(s.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
              timeSlot === s.key
                ? 'bg-white/15 text-white shadow-inner'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
