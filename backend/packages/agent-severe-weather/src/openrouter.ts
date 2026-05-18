import type { SevereWeatherMistralAnalysis } from '@sentinel/types'

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const MODELS = {
  large: 'mistralai/mistral-large',
} as const

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinel.vercel.app',
        'X-Title': 'SENTINEL',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenRouter error ${res.status}: ${err}`)
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0].message.content
  } finally {
    clearTimeout(timeout)
  }
}

function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as T
    throw new Error(`Mistral output is not valid JSON:\n${raw.slice(0, 200)}`)
  }
}

const SYSTEM_PROMPT = `You are SENTINEL's Severe Weather Intelligence Agent.
You analyze official active weather alerts and real forecast data to identify severe storm risk and tornado-favorable conditions.
You must not claim that a tornado will occur unless there is an official tornado alert.
Use only the data provided.
Clearly separate official active alerts from forecast-based risk estimation.
Explain risk level, main drivers, uncertainty, probable impact corridor and recommended actions.
Output strict JSON with this exact structure:
{
  "risk_summary": "string",
  "technical_explanation": "string",
  "citizen_alert_160_chars": "string (max 160 chars)",
  "municipal_briefing": "string",
  "recommended_actions": ["string array"],
  "shelter_guidance": "string",
  "uncertainty_note": "string"
}

Rules:
- Do not invent CAPE, SRH, helicity or radar data.
- Do not claim exact tornado prediction.
- Use responsible language: "conditions may favor severe storm development", "possible tornado-favorable environment", "increased severe weather potential".
- If confidence is low, say so.
- Prioritize human safety.
- Keep citizen_alert_160_chars under 160 characters.
- If there are active official alerts (Tornado Warning, Tornado Watch, etc.), give them highest priority in your summary.
- If there are no active alerts and risk is LOW, keep the response proportionally calm.
- IMPORTANT: All text values in your JSON response MUST be written in Spanish (es-ES). This includes risk_summary, technical_explanation, citizen_alert_160_chars, municipal_briefing, recommended_actions, shelter_guidance, and uncertainty_note.`

export interface MistralAnalysisInput {
  location: { lat: number; lon: number }
  active_alerts: Array<{ event: string; severity: string; headline: string }>
  forecast_risk: Array<{
    window: string
    score: number
    risk_level: string
    drivers: string[]
    confidence: number
  }>
  impact_corridor: {
    direction_label: string
    bearing_degrees: number
    estimated_distance_km_1h: number
    estimated_distance_km_3h: number
    estimated_distance_km_6h: number
  }
  limitations: string[]
}

export async function analyzeWithMistral(input: MistralAnalysisInput): Promise<SevereWeatherMistralAnalysis> {
  const userMessage = `Analyze the following severe weather data and provide your assessment:

Location: ${input.location.lat}, ${input.location.lon}

Active Official Alerts (from NOAA/NWS):
${input.active_alerts.length > 0 ? JSON.stringify(input.active_alerts, null, 2) : 'None active for this location.'}

Forecast Risk Assessment (computed from Open-Meteo data):
${JSON.stringify(input.forecast_risk, null, 2)}

Probable Impact Corridor:
${JSON.stringify(input.impact_corridor, null, 2)}

Limitations:
${input.limitations.join('\n')}

Provide your analysis as strict JSON.`

  const raw = await callOpenRouter(MODELS.large, SYSTEM_PROMPT, userMessage)
  return parseJSON<SevereWeatherMistralAnalysis>(raw)
}

export const MISTRAL_FALLBACK: SevereWeatherMistralAnalysis = {
  risk_summary: 'AI analysis unavailable.',
  technical_explanation: 'The numerical risk index was calculated successfully, but the AI explanation could not be generated.',
  citizen_alert_160_chars: '',
  municipal_briefing: '',
  recommended_actions: [],
  shelter_guidance: '',
  uncertainty_note: 'Use official alerts and local emergency guidance.',
}
