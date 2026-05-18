"use client"
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useSentinel } from '@/contexts/sentinel-context'
import { useFireSelection, type FireIntensity } from '@/contexts/fire-selection-context'
import { degToCompass } from '@/lib/utils'
import { useGeolocation } from '@/hooks/use-geolocation'
import type { FireRiskRegionMap, FireRiskRegion } from '@/hooks/use-socket'

function directionToDeg(dir: string): number | null {
  const map: Record<string, number> = {
    N: 0, NORTE: 0,
    NNE: 22.5,
    NE: 45, NORESTE: 45,
    ENE: 67.5,
    E: 90, ESTE: 90,
    ESE: 112.5,
    SE: 135, SURESTE: 135,
    SSE: 157.5,
    S: 180, SUR: 180,
    SSO: 202.5, SSW: 202.5,
    SO: 225, SUROESTE: 225, SW: 225,
    OSO: 247.5, WSW: 247.5,
    O: 270, OESTE: 270, W: 270,
    ONO: 292.5, WNW: 292.5,
    NO: 315, NOROESTE: 315, NW: 315,
    NNO: 337.5, NNW: 337.5,
  }
  return map[dir.toUpperCase().trim()] ?? null
}

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"


type ExpansionKey = '2h' | '6h' | '12h'

// Elliptical fire spread model — shape from wind, size from LLM area (km²).
function makeFireSpreadPolygon(
  lat: number, lon: number,
  windDegFrom: number, windSpeedMs: number,
  expansionKm2: number
) {
  const windKmh = windSpeedMs * 3.6
  const spreadRad = ((windDegFrom + 180) % 360) * (Math.PI / 180)
  const sinS = Math.sin(spreadRad)
  const cosS = Math.cos(spreadRad)

  // Shape ratios from wind (Rothermel simplified)
  const ros_forward = Math.max(0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002, 0.5)
  const ros_backing = 0.3
  const ros_flank = Math.sqrt(ros_forward * ros_backing)

  // Scale the ellipse so its area matches expansionKm2: area = π * a * b
  // a = k*(ros_forward+ros_backing)/2, b = k*ros_flank
  // → k = sqrt(expansionKm2 / (π * (ros_forward+ros_backing)/2 * ros_flank))
  const shapeArea = Math.PI * ((ros_forward + ros_backing) / 2) * ros_flank
  const k = Math.sqrt(Math.max(expansionKm2, 0.01) / shapeArea)

  const d_forward = k * ros_forward
  const d_backing = k * ros_backing
  const d_flank = Math.max(k * ros_flank, 0.05)

  const a = (d_forward + d_backing) / 2
  const b = d_flank
  const center_offset = (d_forward - d_backing) / 2

  const cosLat = Math.cos(lat * Math.PI / 180)
  const kmToDegLat = 1 / 111
  const kmToDegLon = 1 / (111 * cosLat)

  const centerLat = lat + cosS * center_offset * kmToDegLat
  const centerLon = lon + sinS * center_offset * kmToDegLon

  const coords: number[][] = []
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    const localAlong = a * Math.cos(angle)
    const localPerp = b * Math.sin(angle)
    const east = localAlong * sinS + localPerp * (-cosS)
    const north = localAlong * cosS + localPerp * sinS
    coords.push([centerLon + east * kmToDegLon, centerLat + north * kmToDegLat])
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}


const EXP_CONFIG: Record<ExpansionKey, {
  hours: number
  colorCore: string; colorMid: string; colorOuter: string
}> = {
  '2h':  { hours: 2,  colorCore: '#dc2626', colorMid: '#ef4444', colorOuter: '#f87171' },
  '6h':  { hours: 6,  colorCore: '#c2410c', colorMid: '#ea580c', colorOuter: '#fb923c' },
  '12h': { hours: 12, colorCore: '#b45309', colorMid: '#d97706', colorOuter: '#fbbf24' },
}


export function MapboxPanel({
  riskMap,
  onRegionClick,
  activeExpansion,
  setActiveExpansion
}: {
  riskMap: FireRiskRegionMap | null,
  onRegionClick: (region: FireRiskRegion) => void,
  activeExpansion: ExpansionKey | null,
  setActiveExpansion: (k: ExpansionKey | null) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pulseRafRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<string>('')
  const { sentinelUpdate } = useSentinel()
  const { selectedFire, setSelectedFire, selectFireRef } = useFireSelection()
  const userCoords = useGeolocation()
  const onRegionClickRef = useRef(onRegionClick)
  onRegionClickRef.current = onRegionClick
  // Holds the latest regions so the click handler can recover full geometry
  // from a clicked feature's id (geometry is not carried in feature props).
  const regionsRef = useRef<FireRiskRegion[]>([])
  regionsRef.current = riskMap?.regions ?? []

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-80, -5],
      zoom: 2.5,
      projection: 'globe' as any,
    })
    
    map.on('style.load', () => {
      map.setFog({
        'color': 'rgba(56, 189, 248, 0.15)',
        'high-color': 'rgba(10, 11, 14, 0.8)',
        'horizon-blend': 0.2,
        'space-color': 'rgb(2, 2, 5)',
        'star-intensity': 0.9,
      })
      // Reset cache so fire layers are always re-applied on new map instances.
      lastUpdateRef.current = ''
      setMapLoaded(true)
    })
    
    mapRef.current = map

    const observer = new ResizeObserver(() => {
      map.resize()
    })
    observer.observe(mapContainerRef.current)

    return () => { 
      observer.disconnect()
      map.remove()
      mapRef.current = null 
      setMapLoaded(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !userCoords) return
    const apply = () => {
      if (!map.getStyle()) return
      const data = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: [userCoords.lon, userCoords.lat] },
      }
      const src = map.getSource('user-loc') as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData(data)
      } else {
        map.addSource('user-loc', { type: 'geojson', data })
        map.addLayer({
          id: 'user-loc-halo', type: 'circle', source: 'user-loc',
          paint: { 'circle-radius': 20, 'circle-color': '#3b82f6', 'circle-opacity': 0.18, 'circle-blur': 1 },
        })
        map.addLayer({
          id: 'user-loc-dot', type: 'circle', source: 'user-loc',
          paint: {
            'circle-radius': 7, 'circle-color': '#3b82f6',
            'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(255,255,255,0.9)',
          },
        })
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [userCoords, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const SRC = 'fires-src'
    const CLUSTERS = 'fires-clusters'
    const CLUSTER_COUNT = 'fires-cluster-count'
    const POINTS = 'fires-points'
    const SELECTED = 'fires-selected'

    const cleanup = () => {
      if (pulseRafRef.current !== null) {
        cancelAnimationFrame(pulseRafRef.current)
        pulseRafRef.current = null
      }
      if (!map.getStyle()) return
      [SELECTED, POINTS, 'fires-points-halo', CLUSTER_COUNT, CLUSTERS].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      if (map.getSource(SRC)) map.removeSource(SRC)
      if (map.getSource('fires-selected-src')) map.removeSource('fires-selected-src')
      if (selectFireRef) selectFireRef.current = null
    }

    const apply = () => {
      const fires = sentinelUpdate?.fires ?? []
      
      // Skip if data is identical to avoid flickering
      const currentDataStr = JSON.stringify(fires)
      if (currentDataStr === lastUpdateRef.current) return
      lastUpdateRef.current = currentDataStr

      cleanup()
      if (fires.length === 0) return

      function openFire(
        lat: number, lon: number,
        id: string, frp: number, brightness: number,
        weatherJson: string, pm25: number | null,
        critical: boolean,
      ) {
        const color = critical ? '#ef4444' : '#f97316'
        const weather = weatherJson ? JSON.parse(weatherJson) : undefined
        const intensity: FireIntensity = frp >= 300 ? 'critical' : frp >= 100 ? 'high' : 'moderate'

        const fireWDeg   = weather?.deg   ?? 0
        const fireWSpeed = weather?.speed ?? 0
        const fireSDeg   = (fireWDeg + 180) % 360
        const fireSDirLabel = degToCompass(fireSDeg)
        const fireWKmh   = Math.round(fireWSpeed * 3.6)

        const roundCoord = (v: number) => Math.round(v * 10000) / 10000
        const perFire = sentinelUpdate?.perFireExpansions
          ?.find(e => roundCoord(e.lat) === roundCoord(lat) && roundCoord(e.lon) === roundCoord(lon))
        const toArea = (km2: number) => ({ km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) })
        const fireA2  = perFire ? toArea(perFire.expansion_2h_km2)  : undefined
        const fireA6  = perFire ? toArea(perFire.expansion_6h_km2)  : undefined
        const fireA12 = perFire ? toArea(perFire.expansion_12h_km2) : undefined

        const m = mapRef.current
        if (!m) return

        setSelectedFire({
          id, lat, lon, frp, brightness,
          intensity, windImpactDir: fireSDirLabel, windKmh: fireWKmh,
          expansion2h: fireA2, expansion6h: fireA6, expansion12h: fireA12,
          weather,
        })
        setActiveExpansion(perFire ? '2h' : null)

        const sel = m.getSource('fires-selected-src') as mapboxgl.GeoJSONSource
        sel?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }],
        } as any)

        m.flyTo({ 
          center: [lon + 0.12, lat], 
          zoom: 10, 
          duration: 1500, 
          essential: true 
        })
      }

      // Register for HotspotSearch — updated each time fires reload
      if (selectFireRef) {
        selectFireRef.current = (idx, allFires) => {
          const m = mapRef.current
          if (!m) return
          const f = allFires[idx]
          if (!f) return
          const id = `FIRE-${String(idx + 1).padStart(3, '0')}`
          const isCritical = (sentinelUpdate?.riskLevel === 'critical') || f.frp >= 300
          openFire(f.lat, f.lon, id, f.frp, f.brightness, f.weather ? JSON.stringify(f.weather) : '', f.pm25 ?? null, isCritical)
        }
      }

      if (fires.length === 0) return

      const features = fires.map((f, i) => ({
        type: 'Feature' as const,
        properties: {
          id: `FIRE-${String(i + 1).padStart(3, '0')}`,
          frp: f.frp,
          brightness: f.brightness,
          critical: (sentinelUpdate?.riskLevel === 'critical' || f.frp >= 300) ? 1 : 0,
          weatherJson: f.weather ? JSON.stringify(f.weather) : '',
          pm25: f.pm25 ?? null,
          ts: f.timestamp ?? '',
        },
        geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      }))

      map.addSource(SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features } as any,
        cluster: true,
        clusterMaxZoom: 9,
        clusterRadius: 40,
      })

      map.addSource('fires-selected-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      })

      map.addLayer({
        id: CLUSTERS, type: 'circle', source: SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#fb923c', 50, '#f97316', 200, '#ef4444'],
          'circle-radius': ['step', ['get', 'point_count'], 14, 50, 20, 200, 26],
          'circle-opacity': 0.75,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.35)',
        },
      })

      map.addLayer({
        id: CLUSTER_COUNT, type: 'symbol', source: SRC,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#fff' },
      })

      map.addLayer({
        id: 'fires-points-halo', type: 'circle', source: SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case', ['==', ['get', 'critical'], 1], '#ef4444', '#f97316'],
          'circle-radius': 10,
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      })

      map.addLayer({
        id: POINTS, type: 'circle', source: SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case', ['==', ['get', 'critical'], 1], '#ef4444', '#f97316'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 8, 4, 12, 7, 16, 10],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.55)',
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 9, 0.8],
        },
      })

      map.addLayer({
        id: SELECTED, type: 'circle', source: 'fires-selected-src',
        paint: {
          'circle-color': '#ef4444',
          'circle-radius': 14,
          'circle-opacity': 0.25,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ef4444',
          'circle-stroke-opacity': 1,
        },
      })

      map.on('mouseenter', POINTS,   () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', POINTS,   () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', CLUSTERS, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', CLUSTERS, () => { map.getCanvas().style.cursor = '' })

      map.on('click', CLUSTERS, (e) => {
        const feat = e.features?.[0]
        if (!feat) return
        const clusterId = (feat.properties as any).cluster_id
        const src = map.getSource(SRC) as mapboxgl.GeoJSONSource
        ;(src.getClusterExpansionZoom as any)(clusterId, (err: any, zoom: number) => {
          if (err) return
          map.easeTo({ center: (feat.geometry as any).coordinates, zoom, duration: 700 })
        })
      })

      map.on('click', POINTS, (e) => {
        const feat = e.features?.[0]
        if (!feat) return
        const props = feat.properties as any
        const [lon, lat] = (feat.geometry as any).coordinates as [number, number]
        openFire(lat, lon, props.id, props.frp, props.brightness, props.weatherJson ?? '', props.pm25 ?? null, props.critical === 1)
      })

      if (fires.length > 0 && map.getZoom() < 6) {
        const avgLon = fires.reduce((s, f) => s + f.lon, 0) / fires.length
        const avgLat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
        map.easeTo({ center: [avgLon, avgLat], duration: 1200 })
      }

      const animate = () => {
        if (!mapRef.current || !mapRef.current.getStyle() || !mapRef.current.getLayer('fires-points-halo')) return
        const t = (performance.now() / 1400) % 1
        const phase = (Math.sin(t * Math.PI * 2) + 1) / 2
        const radius = 8 + phase * 14
        const opacity = 0.45 - phase * 0.4
        mapRef.current.setPaintProperty('fires-points-halo', 'circle-radius', radius)
        mapRef.current.setPaintProperty('fires-points-halo', 'circle-opacity', opacity)
        pulseRafRef.current = requestAnimationFrame(animate)
      }
      pulseRafRef.current = requestAnimationFrame(animate)
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [sentinelUpdate, setSelectedFire, setActiveExpansion, selectFireRef, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !sentinelUpdate) return

    const apply = () => {
      if (!map.getStyle()) return
      const polyId = 'sentinel-polygon'
      if (map.getLayer(polyId + '-fill')) map.removeLayer(polyId + '-fill')
      if (map.getLayer(polyId + '-line')) map.removeLayer(polyId + '-line')
      if (map.getSource(polyId)) map.removeSource(polyId)
      if (sentinelUpdate.polygon?.geometry) {
        map.addSource(polyId, { type: 'geojson', data: sentinelUpdate.polygon as any })
        map.addLayer({ id: polyId + '-fill', type: 'fill', source: polyId, paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.18 } })
        map.addLayer({ id: polyId + '-line', type: 'line', source: polyId, paint: { 'line-color': '#ef4444', 'line-width': 2 } })
      }

      const routeId = 'sentinel-routes'
      if (map.getLayer(routeId)) map.removeLayer(routeId)
      if (map.getSource(routeId)) map.removeSource(routeId)
      const routes = sentinelUpdate.routes ?? []
      if (routes.length > 0) {
        map.addSource(routeId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: routes.map(r => ({ type: 'Feature', properties: {}, geometry: r.geometry })),
          } as any,
        })
        map.addLayer({ id: routeId, type: 'line', source: routeId, paint: { 'line-color': '#22c55e', 'line-width': 3, 'line-opacity': 0.8 } })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [sentinelUpdate])

  // Region source + fill/line layers — rebuilt whenever the risk map changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const apply = () => {
      if (!map.getStyle()) return
      const fillId = 'risk-grid-fill'
      const lineId = 'risk-grid-line'
      const srcId = 'risk-grid-src'
      if (map.getLayer(fillId)) map.removeLayer(fillId)
      if (map.getLayer(lineId)) map.removeLayer(lineId)
      if (map.getSource(srcId)) map.removeSource(srcId)

      if (!riskMap) return

      const features = riskMap.regions.map(r => ({
        type: 'Feature' as const,
        id: r.id,
        properties: {
          id: r.id,
          nombre: r.nombre,
          category: r.category,
          score: r.score,
          fwi: r.factors.fwi,
          historial: r.factors.historial,
          terreno: r.factors.terreno,
        },
        geometry: r.geometry,
      }))

      map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features } as any,
      })
      map.addLayer({
        id: fillId, type: 'fill', source: srcId,
        paint: {
          'fill-color': [
            'match', ['get', 'category'],
            'bajo', '#22c55e',
            'medio', '#eab308',
            'alto', '#f97316',
            'critico', '#ef4444',
            '#22c55e',
          ],
          'fill-opacity': 0.35,
        },
      })
      map.addLayer({
        id: lineId, type: 'line', source: srcId,
        paint: { 'line-color': 'rgba(255,255,255,0.25)', 'line-width': 1 },
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [riskMap, mapLoaded])

  // Region interactivity — registered once for the fixed layer id.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const fillId = 'risk-grid-fill'
    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as any
      const region = regionsRef.current.find(r => r.id === p.id)
      if (region) onRegionClickRef.current(region)
    }
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }

    map.on('click', fillId, onClick)
    map.on('mouseenter', fillId, onEnter)
    map.on('mouseleave', fillId, onLeave)

    return () => {
      map.off('click', fillId, onClick)
      map.off('mouseenter', fillId, onEnter)
      map.off('mouseleave', fillId, onLeave)
    }
  }, [mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const apply = () => {
      if (!map.getStyle()) return
      const expId = 'fire-expansion'
      const expLineId = 'fire-expansion-line'
      if (map.getLayer(expId)) map.removeLayer(expId)
      if (map.getLayer(expLineId)) map.removeLayer(expLineId)
      if (map.getSource(expId)) map.removeSource(expId)

      if (!selectedFire || !activeExpansion || !selectedFire.weather) return

      const config = EXP_CONFIG[activeExpansion]
      const expansionKm2 =
        activeExpansion === '2h'  ? selectedFire.expansion2h?.km2 :
        activeExpansion === '6h'  ? selectedFire.expansion6h?.km2 :
                                    selectedFire.expansion12h?.km2
      if (expansionKm2 == null) return
      const poly = makeFireSpreadPolygon(
        selectedFire.lat, selectedFire.lon,
        selectedFire.weather?.deg ?? 0,
        selectedFire.weather?.speed ?? 0,
        expansionKm2
      )

      map.addSource(expId, { type: 'geojson', data: poly as any })
      map.addLayer({
        id: expId, type: 'fill', source: expId,
        paint: { 'fill-color': config.colorMid, 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: expLineId, type: 'line', source: expId,
        paint: { 'line-color': config.colorMid, 'line-width': 2, 'line-dasharray': [2, 2] },
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [selectedFire, activeExpansion, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const apply = () => {
      if (!map.getStyle()) return
      const infraId = 'sentinel-infrastructure'
      if (map.getLayer(infraId)) map.removeLayer(infraId)
      if (map.getSource(infraId)) map.removeSource(infraId)

      const infra = sentinelUpdate?.infrastructure ?? []
      if (infra.length === 0) return

      map.addSource(infraId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: infra.map(f => ({
            type: 'Feature',
            properties: { name: f.name, type: f.type },
            geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
          })),
        } as any,
      })

      map.addLayer({
        id: infraId, type: 'circle', source: infraId,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match', ['get', 'type'],
            'hospital', '#ef4444',
            'school', '#3b82f6',
            '#fbbf24',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })
    }

    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [sentinelUpdate, mapLoaded])

  return (
    <div className="absolute inset-0 w-full h-full bg-[#04050a] z-0">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ position: 'relative', width: '100%', height: '100%' }}
      />
    </div>
  )
}
