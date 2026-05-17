import { NextRequest } from 'next/server'
import type { Glacier, GlimsFeature, OpenMeteoResponse } from '@/lib/glacier-types'
import { calcRiesgo, getCat, getTrend, getMasaVar, buildRiskHistory } from '@/lib/glacier-score'
import { getRegion, getCuenca, getPoblacion, getCuencaFactor, getInfra, getBaseline } from '@/lib/glacier-context'
import wgmsData from '@/data/wgms-chile.json'
import fallbackData from '@/data/glaciers-fallback.json'

export const runtime = 'edge'

const WGMS = wgmsData as Record<string, number[]>
const FALLBACK = fallbackData as Glacier[]

// Bounding box de Chile: lon -76 a -66, lat -56 a -17
const GLIMS_URL = 'https://www.glims.org/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GLIMS:glims_latest&outputFormat=application/json&bbox=-76,-56,-66,-17,EPSG:4326&maxFeatures=80'

function openMeteoUrl(lat: number, lon: number): string {
  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - 12)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${fmt(start)}&end_date=${fmt(end)}&monthly=temperature_2m_mean&timezone=auto`
}

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace('glaciar ', '')
    .replace('glacier ', '')
    .split(' ')[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function calcAnomaly(temps: number[], lat: number): number {
  const baseline = getBaseline(lat)
  const recent = temps.slice(-12)
  if (recent.length === 0) return 1.2
  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length
  const baseMean = baseline.reduce((a, b) => a + b, 0) / baseline.length
  return parseFloat((recentMean - baseMean).toFixed(2))
}

async function fetchGlims(): Promise<GlimsFeature[]> {
  const res = await fetch(GLIMS_URL, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`GLIMS ${res.status}`)
  const json = await res.json() as { features?: GlimsFeature[] }
  return json.features ?? []
}

async function fetchClimate(lat: number, lon: number): Promise<{ temps: number[]; anomaly: number }> {
  try {
    const res = await fetch(openMeteoUrl(lat, lon), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error('open-meteo error')
    const json = await res.json() as OpenMeteoResponse
    const temps = json.monthly?.temperature_2m_mean ?? []
    return { temps, anomaly: calcAnomaly(temps, lat) }
  } catch {
    const base = getBaseline(lat)
    return { temps: base.map(b => b + 1.2), anomaly: 1.2 }
  }
}

function meanBaseline(lat: number): number {
  const b = getBaseline(lat)
  return b.reduce((a, c) => a + c, 0) / b.length
}

function buildGlacier(feat: GlimsFeature, temps: number[], anomaly: number): Glacier {
  const p = feat.properties
  const lat = p.lat_degr ?? p.latitude ?? 0
  const lon = p.lon_degr ?? p.longitude ?? 0
  const area = p.area ?? 1
  const id = p.glims_id.toLowerCase().replace(/[^a-z0-9]/g, '')
  const name = p.glacier_name ?? 'Glaciar sin nombre'

  const key = normalizeKey(name)
  const massHistory: number[] = WGMS[key] ?? temps.slice(-12).map(t => -(0.3 + (t - meanBaseline(lat)) * 0.15))
  const areaHistory: number[] = massHistory.map((_, i) => {
    const cumLoss = massHistory.slice(0, i + 1).reduce((a, b) => a + b, 0)
    return Math.max(50, Math.round(100 + cumLoss * 2))
  })

  const cuencaFactor = getCuencaFactor(lat)
  const riesgo = calcRiesgo({
    areaNow: area,
    areaRef: area * (100 / Math.max(areaHistory[0], 70)),
    tempAnomaly: anomaly,
    elevation: 3000,
    cuencaFactor,
  })

  const baselineMean = meanBaseline(lat)
  const tempHistory12 = temps.slice(-12).map(t => parseFloat((t - baselineMean).toFixed(2)))

  const displayName = name.startsWith('Glaciar') || name.startsWith('Glacier')
    ? name
    : `Glaciar ${name}`

  const lastArea = areaHistory.at(-1) ?? 100
  const lastMass = massHistory.at(-1) ?? 0

  return {
    id,
    glimsId: p.glims_id,
    name: displayName,
    region: getRegion(lat),
    lat,
    lon,
    area,
    tempAnomaly: anomaly,
    tempHistory: tempHistory12,
    massHistory,
    areaHistory,
    riesgo,
    cat: getCat(riesgo),
    trend: getTrend(massHistory),
    deltaShort: `−${Math.max(0, 100 - lastArea)}%`,
    deltaYear: `−${(Math.abs(lastMass) * 0.8).toFixed(1)}%/año`,
    masaVar: getMasaVar(massHistory),
    riskHistory: buildRiskHistory(areaHistory, tempHistory12, riesgo),
    cuenca: getCuenca(lat, lon),
    poblacion: getPoblacion(lat),
    infra: getInfra(lat, lon),
  }
}

export async function GET(_req: NextRequest) {
  try {
    const features = await fetchGlims()

    const filtered = features
      .filter(f => (f.properties.area ?? 0) >= 0.1)
      .sort((a, b) => (b.properties.area ?? 0) - (a.properties.area ?? 0))
      .slice(0, 30)

    if (filtered.length === 0) throw new Error('No glaciers from GLIMS')

    const climateResults = await Promise.all(
      filtered.map(f => {
        const lat = f.properties.lat_degr ?? f.properties.latitude ?? 0
        const lon = f.properties.lon_degr ?? f.properties.longitude ?? 0
        return fetchClimate(lat, lon)
      })
    )

    const glaciers: Glacier[] = filtered
      .map((feat, i) => buildGlacier(feat, climateResults[i].temps, climateResults[i].anomaly))
      .sort((a, b) => b.riesgo - a.riesgo)

    return new Response(JSON.stringify(glaciers), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[/api/glaciers] GLIMS failed, using fallback:', err)
    return new Response(JSON.stringify(FALLBACK), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300',
        'X-Glacier-Source': 'fallback',
      },
    })
  }
}
