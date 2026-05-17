export type ScreenRisk = 'low' | 'medium' | 'high' | 'critical'

export interface NaturalRoute {
  id: string
  label: string
  destino: string
  distancia_km: number
  bearing_deg: number
  eta_min: number
  estado: 'LIBRE' | 'CONGESTIONADA' | 'BLOQUEADA'
  instrucciones?: string[]
}

export interface CitizenData {
  riskLevel: ScreenRisk
  user: { lat: number; lon: number; accuracy_m: number; heading_deg: number }
  fires: { id: string; lat: number; lon: number; frp: number; dist_km: number }[]
  weather: { wind_speed_kmh: number; wind_dir_deg: number; humidity_pct: number; temp_c: number }
  naturalRoutes: NaturalRoute[]
  expansion: {
    direccion_principal_deg: number
    velocidad_propagacion_kmh: number
    eta_min: number
  }
}

export const CITIZEN_MOCK: CitizenData = {
  riskLevel: 'critical',
  user: { lat: -36.82412, lon: -73.04985, accuracy_m: 12, heading_deg: 84 },
  fires: [
    { id: 'F-2041', lat: -36.81870, lon: -73.05410, frp: 184, dist_km: 0.74 },
    { id: 'F-2043', lat: -36.81620, lon: -73.06210, frp: 96,  dist_km: 1.31 },
  ],
  weather: { wind_speed_kmh: 38, wind_dir_deg: 215, humidity_pct: 14, temp_c: 31 },
  naturalRoutes: [
    {
      id: 'R-N1',
      label: 'Quebrada Norte',
      destino: 'Punto de Encuentro · Cerro Chepe',
      distancia_km: 1.2,
      bearing_deg: 38,
      eta_min: 14,
      estado: 'LIBRE',
      instrucciones: [
        'Sube por Avenida Pedro de Valdivia',
        'Cruza el puente peatonal del estero',
        'Sigue por Calle Las Lomas hasta el mirador',
      ],
    },
    {
      id: 'R-S2',
      label: 'Costera Sur',
      destino: 'Refugio Municipal · Lota',
      distancia_km: 3.8,
      bearing_deg: 196,
      eta_min: 42,
      estado: 'CONGESTIONADA',
    },
    {
      id: 'R-W3',
      label: 'Salida Oeste',
      destino: 'Caleta Tumbes',
      distancia_km: 2.4,
      bearing_deg: 268,
      eta_min: 28,
      estado: 'BLOQUEADA',
    },
  ],
  expansion: { direccion_principal_deg: 41, velocidad_propagacion_kmh: 2.4, eta_min: 18 },
}
