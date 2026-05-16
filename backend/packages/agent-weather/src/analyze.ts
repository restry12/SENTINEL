import type { WeatherData, FireData } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

export interface WeatherAnalysis {
  windDirection: string
  spreadRisk: 'low' | 'medium' | 'high'
  humidityRisk: 'low' | 'medium' | 'high'
  summary: string
  llmInsight?: string  // LLM-generated contextual analysis
}

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

// LLM-enhanced weather risk analysis
async function getLlmInsight(weather: WeatherData, fires: FireData[]): Promise<string> {
  const system = `Eres un meteorólogo experto en análisis de riesgo de incendios forestales.
Recibes datos climáticos actuales y número de focos activos.
Responde SOLO con un párrafo breve en español (máximo 3 oraciones) explicando el riesgo climático para la propagación del incendio. Sin JSON, sin markdown.`

  const user = `Viento: ${Math.round(weather.speed * 3.6)} km/h dirección ${degreesToCompass(weather.deg)}.
Humedad: ${weather.humidity}%.
${weather.gust ? `Ráfagas: ${Math.round(weather.gust * 3.6)} km/h.` : ''}
Focos activos: ${fires.length}.

Analiza el riesgo climático para la propagación.`

  return callOpenRouter(MODELS.small, system, user)
}

export async function analyzeWeather(weather: WeatherData, fires: FireData[]): Promise<WeatherAnalysis> {
  const windDirection = degreesToCompass(weather.deg)
  const spreadRisk: WeatherAnalysis['spreadRisk'] =
    weather.speed > 15 ? 'high' : weather.speed > 7 ? 'medium' : 'low'
  const humidityRisk: WeatherAnalysis['humidityRisk'] =
    weather.humidity < 20 ? 'high' : weather.humidity < 40 ? 'medium' : 'low'

  const summary =
    `Viento ${Math.round(weather.speed * 3.6)} km/h desde ${windDirection}. ` +
    `Humedad ${weather.humidity}%. ` +
    `Riesgo propagación: ${spreadRisk}. ` +
    `${fires.length} foco(s) activo(s).`

  let llmInsight: string | undefined
  try {
    llmInsight = await getLlmInsight(weather, fires)
  } catch (err) {
    console.warn('[agent-weather] LLM insight failed:', err)
  }

  return { windDirection, spreadRisk, humidityRisk, summary, llmInsight }
}
