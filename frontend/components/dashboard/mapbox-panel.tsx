"use client"
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useSentinel } from '@/contexts/sentinel-context'
import { useFireSelection, type FireIntensity } from '@/contexts/fire-selection-context'
import { degToCompass } from '@/lib/utils'
import { useGeolocation } from '@/hooks/use-geolocation'

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg"


type ExpansionKey = '2h' | '6h' | '12h'

// Elliptical fire spread model (simplified Rothermel).
// Fire origin sits at the REAR of the ellipse — spread is clearly one-directional.
// windDegFrom: meteorological bearing fire comes FROM (0=N, 90=E…)
function makeFireSpreadPolygon(
  lat: number, lon: number,
  windDegFrom: number, windSpeedMs: number,
  hours: number
) {
  const windKmh = windSpeedMs * 3.6
  const spreadRad = ((windDegFrom + 180) % 360) * (Math.PI / 180)
  const sinS = Math.sin(spreadRad)  // east component of spread direction
  const cosS = Math.cos(spreadRad)  // north component of spread direction

  // Rate of spread (km/h)
  const ros_forward = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_backing = 0.3
  const ros_flank = Math.sqrt(ros_forward * ros_backing)

  // Distances after `hours`
  const d_forward = ros_forward * hours
  const d_backing = ros_backing * hours
  const d_flank = Math.max(ros_flank * hours, 0.3)

  // Ellipse axes — fire origin at rear focus, not center
  const a = (d_forward + d_backing) / 2
  const b = d_flank
  const center_offset = (d_forward - d_backing) / 2

  const cosLat = Math.cos(lat * Math.PI / 180)
  const kmToDegLat = 1 / 111
  const kmToDegLon = 1 / (111 * cosLat)

  // Shift ellipse center downwind from fire origin
  const centerLat = lat + cosS * center_offset * kmToDegLat
  const centerLon = lon + sinS * center_offset * kmToDegLon

  const coords: number[][] = []
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    const localAlong = a * Math.cos(angle)   // along spread axis
    const localPerp = b * Math.sin(angle)    // perpendicular to spread
    // Rotate to geographic spread direction
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

// Area of spread ellipse in km² (π·a·b), 1 ha = 0.01 km²
function computeFireSpreadArea(windSpeedMs: number, hours: number) {
  const windKmh = windSpeedMs * 3.6
  const ros_f = 0.5 + windKmh * 0.15 + windKmh * windKmh * 0.002
  const ros_b = 0.3
  const ros_l = Math.sqrt(ros_f * ros_b)
  const a = (ros_f * hours + ros_b * hours) / 2
  const b = Math.max(ros_l * hours, 0.3)
  const km2 = Math.PI * a * b
  return { km2: Math.round(km2 * 10) / 10, ha: Math.round(km2 * 100) }
}

const EXP_CONFIG: Record<ExpansionKey, {
  hours: number
  colorCore: string; colorMid: string; colorOuter: string
}> = {
  '2h':  { hours: 2,  colorCore: '#dc2626', colorMid: '#ef4444', colorOuter: '#f87171' },
  '6h':  { hours: 6,  colorCore: '#c2410c', colorMid: '#ea580c', colorOuter: '#fb923c' },
  '12h': { hours: 12, colorCore: '#b45309', colorMid: '#d97706', colorOuter: '#fbbf24' },
}

interface FireArea { km2: number; ha: number }
interface PopupData {
  id: string; color: string; intensity: string; frp: number
  lat: number; lon: number
  sDirLabel: string; wKmh: number
  a2: FireArea; a6: FireArea; a12: FireArea
  weather?: { speed: number; deg: number; humidity: number; temp?: number }
  pm25?: number | null
}

function fmtKm2(v: number) { return v >= 1000 ? `${(v/1000).toFixed(1)}k km²` : `${v} km²` }
function fmtHa(v: number)  { return v >= 10000 ? `${Math.round(v/1000)}k ha` : `${v.toLocaleString()} ha` }

function buildPopupHTML(d: PopupData, active: ExpansionKey | null): string {
  const areas: Record<ExpansionKey, FireArea> = { '2h': d.a2, '6h': d.a6, '12h': d.a12 }
  const expColors: Record<ExpansionKey, string> = { '2h': '#ef4444', '6h': '#fb923c', '12h': '#fbbf24' }
  const expBg: Record<ExpansionKey, string> = {
    '2h': 'rgba(220,38,38,', '6h': 'rgba(194,65,12,', '12h': 'rgba(180,83,9,'
  }

  const activeArea = active ? areas[active] : null
  const activeColor = active ? expColors[active] : d.color
  const activeBg = active ? expBg[active] : 'rgba(239,68,68,'

  return `
    <div style="font-family:ui-monospace,monospace;background:linear-gradient(160deg,#0d1117,#0a0608);border:1px solid ${activeColor}44;border-radius:16px;overflow:hidden;box-shadow:0 0 50px ${activeColor}18,0 24px 60px rgba(0,0,0,0.7);min-width:280px;">

      <!-- Header -->
      <div style="padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;">
        <div style="width:9px;height:9px;border-radius:50%;background:${d.color};box-shadow:0 0 12px ${d.color};flex-shrink:0;"></div>
        <span style="font-size:13px;font-weight:900;letter-spacing:0.18em;color:#f8fafc;">${d.id}</span>
        <span style="margin-left:auto;font-size:9px;font-weight:700;letter-spacing:0.15em;color:${d.color};background:${d.color}22;border:1px solid ${d.color}44;border-radius:6px;padding:3px 8px;">${d.intensity.toUpperCase()}</span>
      </div>

      <!-- Stats row -->
      <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:10px 12px;">
          <div style="font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:4px;">POTENCIA</div>
          <div style="font-size:20px;font-weight:900;color:#fff;line-height:1;">${d.frp.toFixed(0)}<span style="font-size:10px;color:rgba(255,255,255,0.35);margin-left:3px;">MW</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:10px 12px;">
          <div style="font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:4px;">PROPAGACIÓN</div>
          <div style="font-size:20px;font-weight:900;color:#fb923c;line-height:1;">${d.sDirLabel}<span style="font-size:10px;color:rgba(255,255,255,0.35);margin-left:3px;">${d.wKmh}km/h</span></div>
        </div>
      </div>

      <!-- Per-fire weather + air quality -->
      ${d.weather ? `
      <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:8px;">CLIMA + AIRE EN EL FOCO</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
          <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:7px 10px;">
            <div style="font-size:8px;letter-spacing:0.16em;color:rgba(255,255,255,0.3);">VIENTO</div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:2px;">${d.weather.speed.toFixed(1)}<span style="font-size:9px;color:rgba(255,255,255,0.35);"> m/s · ${d.weather.deg}°</span></div>
          </div>
          <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:7px 10px;">
            <div style="font-size:8px;letter-spacing:0.16em;color:rgba(255,255,255,0.3);">HUMEDAD</div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:2px;">${d.weather.humidity}<span style="font-size:9px;color:rgba(255,255,255,0.35);"> %</span></div>
          </div>
          ${typeof d.weather.temp === 'number' ? `
          <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:7px 10px;">
            <div style="font-size:8px;letter-spacing:0.16em;color:rgba(255,255,255,0.3);">TEMP</div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:2px;">${d.weather.temp.toFixed(1)}<span style="font-size:9px;color:rgba(255,255,255,0.35);"> °C</span></div>
          </div>` : ''}
          ${d.pm25 !== undefined ? `
          <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:7px 10px;">
            <div style="font-size:8px;letter-spacing:0.16em;color:rgba(255,255,255,0.3);">PM2.5</div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:2px;">${d.pm25 === null ? 's/d' : `${d.pm25}<span style="font-size:9px;color:rgba(255,255,255,0.35);"> µg/m³</span>`}</div>
          </div>` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Active expansion hero block -->
      ${activeArea ? `
      <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:8px;">ZONA AFECTADA EN <span style="color:${activeColor};font-weight:900;">${active!.toUpperCase()}</span></div>
        <div style="background:${activeBg}0.14);border:1px solid ${activeColor}50;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:16px;">
          <div>
            <div style="font-size:26px;font-weight:900;color:#fff;line-height:1;text-shadow:0 0 20px ${activeColor};">${fmtKm2(activeArea.km2)}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;">${fmtHa(activeArea.ha)}</div>
          </div>
          <div style="margin-left:auto;font-size:36px;font-weight:900;color:${activeColor};opacity:0.5;line-height:1;">${active!.replace('h','')}<span style="font-size:14px;">H</span></div>
        </div>
      </div>
      ` : ''}

      <!-- All 3 timeframes grid -->
      <div style="padding:12px 16px 14px;">
        ${!activeArea ? `<div style="font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);margin-bottom:8px;">PROYECCIÓN DE EXPANSIÓN</div>` : `<div style="font-size:8px;letter-spacing:0.2em;color:rgba(255,255,255,0.25);margin-bottom:8px;">OTRAS PROYECCIONES</div>`}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          ${(['2h','6h','12h'] as ExpansionKey[]).map(k => {
            const isAct = k === active
            const c = expColors[k]
            const bg = expBg[k]
            const ar = areas[k]
            return `<button data-sentinel-key="${k}" style="cursor:pointer;all:unset;display:block;width:100%;box-sizing:border-box;background:${bg}${isAct ? '0.22' : '0.08'});border:1px solid ${c}${isAct ? '70' : '30'};border-radius:8px;padding:10px 6px;text-align:center;${isAct ? `box-shadow:0 0 14px ${c}30;` : ''}transition:all 0.15s;">
              <div style="font-size:11px;font-weight:900;color:${c};letter-spacing:0.1em;${isAct ? `text-shadow:0 0 8px ${c};` : 'opacity:0.7;'}">${k.toUpperCase()}</div>
              <div style="font-size:12px;font-weight:800;color:${isAct ? '#fff' : 'rgba(255,255,255,0.6)'};margin-top:4px;">${fmtKm2(ar.km2)}</div>
              <div style="font-size:10px;color:rgba(255,255,255,${isAct ? '0.45' : '0.25'});margin-top:2px;">${fmtHa(ar.ha)}</div>
            </button>`
          }).join('')}
        </div>
        <div style="margin-top:8px;font-size:8px;color:rgba(255,255,255,0.18);text-align:center;letter-spacing:0.08em;">${d.lat.toFixed(4)}° ${d.lon.toFixed(4)}°</div>
      </div>
    </div>
  `
}

export function MapboxPanel({ showHeatmap = false }: { showHeatmap?: boolean }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const pulseRafRef = useRef<number | null>(null)
  const currentPopupRef = useRef<{ popup: mapboxgl.Popup; data: PopupData } | null>(null)
  const { sentinelUpdate } = useSentinel()
  const { selectedFire, setSelectedFire } = useFireSelection()
  const [activeExpansion, setActiveExpansion] = useState<ExpansionKey | null>(null)
  const userCoords = useGeolocation()

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-71.90, -38.28],
      zoom: 9,
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
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // User GPS position marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userCoords) return
    const apply = () => {
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
  }, [userCoords])

  // Fire markers — native Mapbox layer (GPU rendered) + clustering for perf with 4k+ points
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

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
      [SELECTED, POINTS, 'fires-points-halo', CLUSTER_COUNT, CLUSTERS].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      if (map.getSource(SRC)) map.removeSource(SRC)
      if (map.getSource('fires-selected-src')) map.removeSource('fires-selected-src')
    }

    const wDeg   = sentinelUpdate?.weather?.deg   ?? 315
    const wSpeed = sentinelUpdate?.weather?.speed ?? 6.7
    const sDeg   = (wDeg + 180) % 360
    const sDirLabel = degToCompass(sDeg)
    const wKmh  = Math.round(wSpeed * 3.6)
    const a2  = computeFireSpreadArea(wSpeed, 2)
    const a6  = computeFireSpreadArea(wSpeed, 6)
    const a12 = computeFireSpreadArea(wSpeed, 12)

    const apply = () => {
      cleanup()
      const fires = sentinelUpdate?.fires ?? []
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

      // Empty source for the highlighted/selected fire (single animated dot)
      map.addSource('fires-selected-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      })

      // Cluster bubbles
      map.addLayer({
        id: CLUSTERS, type: 'circle', source: SRC,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#fb923c', 50,
            '#f97316', 200,
            '#ef4444',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            14, 50, 20, 200, 26,
          ],
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

      // Pulsing halo behind individual (unclustered) dots
      map.addLayer({
        id: 'fires-points-halo', type: 'circle', source: SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case', ['==', ['get', 'critical'], 1], '#ef4444', '#f97316',
          ],
          'circle-radius': 10,
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      })

      // Individual fires — static red dots, zoom-responsive size
      map.addLayer({
        id: POINTS, type: 'circle', source: SRC,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case', ['==', ['get', 'critical'], 1], '#ef4444', '#f97316',
          ],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 2.5,
            8, 4,
            12, 7,
            16, 10,
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.55)',
          'circle-stroke-opacity': [
            'interpolate', ['linear'], ['zoom'], 5, 0, 9, 0.8,
          ],
        },
      })

      // Selected fire — bigger pulsing ring (single feature, animation is cheap)
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

      // Hover cursor
      map.on('mouseenter', POINTS,   () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', POINTS,   () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', CLUSTERS, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', CLUSTERS, () => { map.getCanvas().style.cursor = '' })

      // Click a cluster → zoom in
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

      // Click a fire → flyTo + popup + selectedFire context
      map.on('click', POINTS, (e) => {
        const feat = e.features?.[0]
        if (!feat) return
        const props = feat.properties as any
        const [lon, lat] = (feat.geometry as any).coordinates as [number, number]
        const color = props.critical === 1 ? '#ef4444' : '#f97316'
        const weather = props.weatherJson ? JSON.parse(props.weatherJson) : undefined
        const intensity: FireIntensity = props.frp >= 300 ? 'critical' : props.frp >= 100 ? 'high' : 'moderate'

        const popupData: PopupData = {
          id: props.id, color, intensity: String(intensity),
          frp: props.frp, lat, lon,
          sDirLabel, wKmh, a2, a6, a12,
          weather, pm25: props.pm25,
        }

        currentPopupRef.current?.popup.remove()

        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, anchor: 'bottom', maxWidth: '320px' })
          .setLngLat([lon, lat])
          .setHTML(buildPopupHTML(popupData, '2h'))
          .addTo(map)

        popup.getElement()?.addEventListener('click', (ev) => {
          const btn = (ev.target as HTMLElement).closest('[data-sentinel-key]')
          if (!btn) return
          const key = btn.getAttribute('data-sentinel-key') as ExpansionKey
          setActiveExpansion(prev => prev === key ? null : key)
        })

        currentPopupRef.current = { popup, data: popupData }

        setSelectedFire({
          id: props.id, lat, lon, frp: props.frp, brightness: props.brightness,
          intensity, windImpactDir: sDirLabel, windKmh: wKmh,
          expansion2h: a2, expansion6h: a6, expansion12h: a12,
        })
        setActiveExpansion('2h')

        // Highlight selected dot
        const sel = map.getSource('fires-selected-src') as mapboxgl.GeoJSONSource
        sel.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature', properties: {},
            geometry: { type: 'Point', coordinates: [lon, lat] },
          }],
        } as any)

        map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 11), duration: 1100, essential: true })
      })

      // Pan to the average centroid only on first load
      if (fires.length > 0 && map.getZoom() < 6) {
        const avgLon = fires.reduce((s, f) => s + f.lon, 0) / fires.length
        const avgLat = fires.reduce((s, f) => s + f.lat, 0) / fires.length
        map.easeTo({ center: [avgLon, avgLat], duration: 1200 })
      }

      // Pulse animation for unclustered individual fires
      const animate = () => {
        if (!mapRef.current || !mapRef.current.getLayer('fires-points-halo')) return
        const t = (performance.now() / 1400) % 1
        const phase = (Math.sin(t * Math.PI * 2) + 1) / 2  // 0..1
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
  }, [sentinelUpdate, setSelectedFire])

  // Update open popup HTML whenever active expansion changes
  useEffect(() => {
    const current = currentPopupRef.current
    if (!current) return
    current.popup.setHTML(buildPopupHTML(current.data, activeExpansion))
  }, [activeExpansion])

  // Fire perimeter + evacuation routes from backend
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sentinelUpdate) return

    const apply = () => {
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

  // Draw expansion — 3 concentric danger zones + glowing border + direction arrow
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const EXP_LAYER_IDS = [
      'exp-outer-fill', 'exp-outer-glow', 'exp-outer-line',
      'exp-mid-fill',
      'exp-core-fill', 'exp-core-line',
      'exp-arrow',
    ]
    const EXP_SOURCE_IDS = ['exp-outer', 'exp-mid', 'exp-core', 'exp-arrow-src']

    const drawExpansion = () => {
      EXP_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id) })
      EXP_SOURCE_IDS.forEach(id => { if (map.getSource(id)) map.removeSource(id) })

      if (!selectedFire || !activeExpansion) return

      const cfg = EXP_CONFIG[activeExpansion]
      const windDeg = sentinelUpdate?.weather?.deg ?? 315
      const windSpeedMs = sentinelUpdate?.weather?.speed ?? 6.7
      const exp = sentinelUpdate?.expansion
      const backendPoly = activeExpansion === '2h' ? exp?.expansion_2h
        : activeExpansion === '6h' ? exp?.expansion_6h
        : exp?.expansion_12h

      // Outer polygon = full timeframe (or backend data)
      const outerGeo = backendPoly?.coordinates
        ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: backendPoly.coordinates } }
        : makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeedMs, cfg.hours)

      // Mid and core = 55% / 25% of hours (same shape, smaller)
      const midGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeedMs, cfg.hours * 0.55)
      const coreGeo = makeFireSpreadPolygon(selectedFire.lat, selectedFire.lon, windDeg, windSpeedMs, cfg.hours * 0.25)

      // Direction arrow: fire origin → downwind tip of outer polygon
      const spreadRad = ((windDeg + 180) % 360) * Math.PI / 180
      const sinS = Math.sin(spreadRad)
      const cosS = Math.cos(spreadRad)
      const windKmhVal = windSpeedMs * 3.6
      const ros_f = 0.5 + windKmhVal * 0.15 + windKmhVal * windKmhVal * 0.002
      const tipKm = ros_f * cfg.hours
      const cosLat = Math.cos(selectedFire.lat * Math.PI / 180)
      const tipLon = selectedFire.lon + sinS * tipKm / (111 * cosLat)
      const tipLat = selectedFire.lat + cosS * tipKm / 111

      // Sources
      map.addSource('exp-outer', { type: 'geojson', data: outerGeo as any })
      map.addSource('exp-mid',   { type: 'geojson', data: midGeo   as any })
      map.addSource('exp-core',  { type: 'geojson', data: coreGeo  as any })
      map.addSource('exp-arrow-src', {
        type: 'geojson',
        data: {
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [[selectedFire.lon, selectedFire.lat], [tipLon, tipLat]] },
        } as any,
      })

      // Outer glow (wide dim line for bloom effect)
      map.addLayer({ id: 'exp-outer-glow', type: 'line', source: 'exp-outer',
        paint: { 'line-color': cfg.colorOuter, 'line-width': 14, 'line-opacity': 0.08, 'line-blur': 4 } })
      // Outer fill — low opacity danger zone
      map.addLayer({ id: 'exp-outer-fill', type: 'fill', source: 'exp-outer',
        paint: { 'fill-color': cfg.colorOuter, 'fill-opacity': 0.07 } })
      // Outer dashed border
      map.addLayer({ id: 'exp-outer-line', type: 'line', source: 'exp-outer',
        paint: { 'line-color': cfg.colorOuter, 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } })

      // Mid fill — medium intensity
      map.addLayer({ id: 'exp-mid-fill', type: 'fill', source: 'exp-mid',
        paint: { 'fill-color': cfg.colorMid, 'fill-opacity': 0.14 } })

      // Core fill — hottest / most dangerous zone
      map.addLayer({ id: 'exp-core-fill', type: 'fill', source: 'exp-core',
        paint: { 'fill-color': cfg.colorCore, 'fill-opacity': 0.28 } })
      // Core solid glowing border
      map.addLayer({ id: 'exp-core-line', type: 'line', source: 'exp-core',
        paint: { 'line-color': cfg.colorCore, 'line-width': 2.5, 'line-opacity': 0.9 } })

      // Direction arrow — bold line from fire origin to downwind tip
      map.addLayer({ id: 'exp-arrow', type: 'line', source: 'exp-arrow-src',
        paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [6, 4] } })
    }

    if (map.isStyleLoaded()) drawExpansion()
    else map.once('style.load', drawExpansion)
  }, [selectedFire, activeExpansion, sentinelUpdate])

  // A6 prediction heatmap — toggled by clicking Critical Fire legend
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const SRC = 'prediction-heatmap'
    const FILL = 'prediction-heatmap-fill'
    const LINE = 'prediction-heatmap-line'

    const cleanup = () => {
      if (map.getLayer(LINE)) map.removeLayer(LINE)
      if (map.getLayer(FILL)) map.removeLayer(FILL)
      if (map.getSource(SRC)) map.removeSource(SRC)
    }

    const draw = () => {
      cleanup()
      if (!showHeatmap) return
      const grid = sentinelUpdate?.prediction?.grid ?? []
      if (grid.length === 0) return

      const D = 0.25
      const features = grid.map(c => ({
        type: 'Feature' as const,
        properties: { risk: c.risk_score },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [c.lon,     c.lat    ],
            [c.lon + D, c.lat    ],
            [c.lon + D, c.lat + D],
            [c.lon,     c.lat + D],
            [c.lon,     c.lat    ],
          ]],
        },
      }))

      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features } as any })
      map.addLayer({
        id: FILL, type: 'fill', source: SRC,
        paint: {
          'fill-color': [
            'step', ['get', 'risk'],
            '#22c55e',   // green  risk ≤ 0.35
            0.35, '#eab308',  // yellow
            0.5,  '#f97316',  // orange
            0.75, '#ef4444',  // red
          ],
          'fill-opacity': 0.35,
        },
      })
      map.addLayer({
        id: LINE, type: 'line', source: SRC,
        paint: { 'line-color': 'rgba(255,255,255,0.05)', 'line-width': 0.5 },
      })
    }

    if (map.isStyleLoaded()) draw()
    else map.once('style.load', draw)
  }, [showHeatmap, sentinelUpdate?.prediction])

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

    </div>
  )
}
