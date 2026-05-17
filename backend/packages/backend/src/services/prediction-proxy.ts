import type {
  AgentResponse,
  FireRiskRegionMap,
  RegionDetail,
  RiskCategory,
  RiskFactors,
  WeatherData,
  FireData,
} from '@sentinel/types'

function predictionUrl(): string {
  const url = process.env.AGENT_PREDICTION_URL
  if (!url) throw new Error('AGENT_PREDICTION_URL not set')
  return url
}

export async function fetchRiskGrid(weather: WeatherData, firms: FireData[]): Promise<FireRiskRegionMap> {
  const res = await fetch(`${predictionUrl()}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weather, firms }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`agent-prediction /analyze returned ${res.status}`)
  const json = (await res.json()) as AgentResponse<FireRiskRegionMap>
  if (!json.success) throw new Error(json.error)
  return json.data
}

export interface RegionDetailRequest {
  region_id: number
  nombre: string
  score: number
  category: RiskCategory
  factors: RiskFactors
}

export async function fetchCellDetail(region: RegionDetailRequest): Promise<RegionDetail> {
  const res = await fetch(`${predictionUrl()}/cell-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(region),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`agent-prediction /cell-detail returned ${res.status}`)
  const json = (await res.json()) as AgentResponse<RegionDetail>
  if (!json.success) throw new Error(json.error)
  return json.data
}
