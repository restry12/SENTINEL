import type { SentinelUpdate } from '@sentinel/types'
import { getSupabaseAdmin } from './supabase'

export interface IncidentRecord {
  id?: string
  timestamp: string
  risk_level: string
  zona_afectada: string | null
  centroid_lat: number
  centroid_lon: number
  fire_count: number
  frp_total: number
  frp_max: number
  wind_speed: number
  wind_deg: number
  humidity: number
  aqi: number
  aqi_category: string
  pm25: number
  expansion_12h_km2: number | null
  expansion_direction: string | null
  expansion_speed_kmh: number | null
  nivel_emergencia: string | null
  population_at_risk: number | null
  alerts_sent: boolean
  created_at?: string
}

export async function saveIncident(
  update: SentinelUpdate,
  centroidLat: number,
  centroidLon: number,
  alertsSent: boolean
): Promise<void> {
  try {
    const admin = getSupabaseAdmin()

    const frpTotal = update.fires.reduce((s, f) => s + f.frp, 0)
    const frpMax = update.fires.reduce((max, f) => Math.max(max, f.frp), 0)

    const record: IncidentRecord = {
      timestamp: update.timestamp,
      risk_level: update.riskLevel,
      zona_afectada: update.riskAssessment?.zona_afectada ?? null,
      centroid_lat: centroidLat,
      centroid_lon: centroidLon,
      fire_count: update.fires.length,
      frp_total: Math.round(frpTotal * 10) / 10,
      frp_max: Math.round(frpMax * 10) / 10,
      wind_speed: update.weather.speed,
      wind_deg: update.weather.deg,
      humidity: update.weather.humidity,
      aqi: update.airQuality.aqi,
      aqi_category: update.airQuality.category,
      pm25: update.airQuality.pm25,
      expansion_12h_km2: update.expansion?.expansion_12h?.area_km2 ?? null,
      expansion_direction: update.expansion?.direccion_principal ?? null,
      expansion_speed_kmh: update.expansion?.velocidad_propagacion_kmh ?? null,
      nivel_emergencia: update.report?.nivel_emergencia ?? null,
      population_at_risk: update.report?.poblacion_en_riesgo_estimada ?? null,
      alerts_sent: alertsSent,
    }

    const { error } = await admin.from('fire_incidents').insert(record)
    if (error) {
      console.error('[history] Failed to save incident:', error.message)
    } else {
      console.log(`[history] Incident saved — riskLevel=${record.risk_level}, fires=${record.fire_count}, frpMax=${record.frp_max}MW`)
    }
  } catch (err) {
    console.error('[history] Unexpected error saving incident:', err)
  }
}
