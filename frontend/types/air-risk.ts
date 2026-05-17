export type AirRiskTimeSlot = 'now' | 'plus2h' | 'plus6h' | 'plus12h'

export interface AirRiskCell {
  id: string
  lat: number
  lon: number
  polygon: number[][][]
  pm25: number
  aqi: number
  ozone: number
  no2: number
  co: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EMERGENCY'
  main_pollutant: string
  confidence: number
  trend: 'improving' | 'stable' | 'worsening'
  nearest_fire_km: number | null
  smoke_direction: string | null
}

export interface AirRiskGridResult {
  now: AirRiskCell[]
  plus2h: AirRiskCell[]
  plus6h: AirRiskCell[]
  plus12h: AirRiskCell[]
  metadata: {
    stations_used: number
    coverage_area_km2: number
    generated_at: string
  }
}
