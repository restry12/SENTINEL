export type RiskCat = "Critico" | "Riesgo Alto" | "Observacion" | "Estable";
export type UrgencyLevel = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";

export interface InfraItem {
  t: string;
  d: string;
  ic: string;
}

export interface GlacierAI {
  diag: string;
  urgency: UrgencyLevel;
  impact: string;
  recT: string;
  recR: string;
}

export interface Glacier {
  id: string;
  glimsId: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  area: number;
  srcDate?: string;
  lastReleaseDate?: string;
  elevation?: number;

  tempAnomaly: number;
  tempHistory: number[];

  massHistory: number[];
  areaHistory: number[];

  riesgo: number;
  cat: RiskCat;
  trend: "Retroceso acelerado" | "Retroceso lento" | "Estable";
  deltaShort: string;
  deltaYear: string;
  masaVar: string;
  riskHistory: number[];

  cuenca: string;
  poblacion: string;
  infra: InfraItem[];

  ai?: GlacierAI;
}

export interface ScoreInputs {
  areaNow: number;
  areaRef: number;
  tempAnomaly: number;
  elevation: number;
  cuencaFactor: number;
}

export interface GlimsFeature {
  geometry?: {
    type: string;
    coordinates: unknown;
  };
  properties: {
    glims_id?: string;
    glacier_name?: string;
    glac_id?: string;
    glac_name?: string | null;
    anlys_id?: number;
    lat_degr?: number;
    lon_degr?: number;
    latitude?: number;
    longitude?: number;
    area?: number;
    db_area?: number | null;
    src_date?: string;
    release_date?: string;
    id_num?: number;
    rec_status?: string;
    line_type?: string;
    chief_affl?: string;
    subm_id?: number;
  };
}

export interface OpenMeteoResponse {
  monthly?: {
    time: string[];
    temperature_2m_mean: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_mean: Array<number | null>;
  };
}
