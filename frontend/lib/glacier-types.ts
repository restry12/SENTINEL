export type RiskCat = 'Crítico' | 'Riesgo Alto' | 'Observación' | 'Estable'
export type UrgencyLevel = 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA'

export interface InfraItem {
  t: string   // nombre
  d: string   // distancia
  ic: string  // código: AP EM HE AG CI PN RT MI RI TU
}

export interface GlacierAI {
  diag: string
  urgency: UrgencyLevel
  impact: string
  recT: string
  recR: string
}

export interface Glacier {
  id: string
  glimsId: string
  name: string
  region: string
  lat: number
  lon: number
  area: number            // km²
  elevation?: number      // m.s.n.m.

  tempAnomaly: number     // °C sobre baseline ERA5
  tempHistory: number[]   // 12 meses de anomalía mensual

  massHistory: number[]   // m EH/año, 12 puntos (WGMS o estimado)
  areaHistory: number[]   // % de superficie relativa a t0, 12 puntos

  riesgo: number          // 0–100
  cat: RiskCat
  trend: 'Retroceso acelerado' | 'Retroceso lento' | 'Estable'
  deltaShort: string
  deltaYear: string
  masaVar: string
  riskHistory: number[]   // serie histórica del índice de riesgo

  cuenca: string
  poblacion: string
  infra: InfraItem[]

  ai?: GlacierAI
}

export interface ScoreInputs {
  areaNow: number
  areaRef: number
  tempAnomaly: number
  elevation: number
  cuencaFactor: number
}

// Shape de respuesta cruda de GLIMS WFS
export interface GlimsFeature {
  properties: {
    glims_id: string
    glacier_name: string
    lat_degr?: number
    lon_degr?: number
    latitude?: number
    longitude?: number
    area?: number
    src_date?: string
  }
}

// Shape de respuesta de Open-Meteo Archive
export interface OpenMeteoResponse {
  monthly?: {
    time: string[]
    temperature_2m_mean: number[]
  }
}
