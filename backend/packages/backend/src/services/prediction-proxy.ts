import type {
  AgentResponse,
  FireRiskGrid,
  CellDetail,
  FireRiskCell,
  WeatherData,
  FireData,
} from '@sentinel/types'

function predictionUrl(): string {
  const url = process.env.AGENT_PREDICTION_URL
  if (!url) throw new Error('AGENT_PREDICTION_URL not set')
  return url
}

export async function fetchRiskGrid(weather: WeatherData, firms: FireData[]): Promise<FireRiskGrid> {
  const res = await fetch(`${predictionUrl()}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weather, firms }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`agent-prediction /analyze returned ${res.status}`)
  const json = (await res.json()) as AgentResponse<FireRiskGrid>
  if (!json.success) throw new Error(json.error)
  return json.data
}

export async function fetchCellDetail(cell: FireRiskCell): Promise<CellDetail> {
  const res = await fetch(`${predictionUrl()}/cell-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cell }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`agent-prediction /cell-detail returned ${res.status}`)
  const json = (await res.json()) as AgentResponse<CellDetail>
  if (!json.success) throw new Error(json.error)
  return json.data
}
