import 'dotenv/config'
import type { GlacierClimateData, GlacierMassData, GlacierInfo, GlacierAnalysis } from '@sentinel/types'
import { calculateGlacierRisk, getRiskCategory } from './risk-calculator'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'
import { catalog, copernicus } from './data'
import { estimateDaysAboveZero, thermalBaseline, buildPrediction } from './analyze'

export async function fetchGlacierClimate(
  lat: number,
  lon: number,
  altitudeM: number = 0
): Promise<GlacierClimateData> {
  const key = process.env.OPENWEATHER_API_KEY
  if (!key) throw new Error('OPENWEATHER_API_KEY is not set')

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`)

  const json = await res.json() as {
    main: { temp: number; temp_max: number }
    rain?: { '1h'?: number }
    snow?: { '1h'?: number }
  }

  const currentMonth = new Date().getMonth() + 1
  const temp_avg = Math.round(json.main.temp * 10) / 10
  const temp_max = Math.round(json.main.temp_max * 10) / 10
  const precipitation_mm = Math.round((json.rain?.['1h'] ?? 0) * 10) / 10
  const snowfall_cm = Math.round(((json.snow?.['1h'] ?? 0) / 10) * 10) / 10
  const days_above_zero = estimateDaysAboveZero(lat, altitudeM, temp_avg, currentMonth)
  const thermal_anomaly = Math.round((temp_avg - thermalBaseline(altitudeM)) * 10) / 10

  return { temp_avg, temp_max, precipitation_mm, snowfall_cm, days_above_zero, thermal_anomaly }
}

export async function buildGlacierAnalysis(glacierId: string): Promise<GlacierAnalysis> {
  const glacierInfo = catalog.find(g => g.id === glacierId)
  if (!glacierInfo) throw new Error(`Glaciar no encontrado: ${glacierId}`)

  const massHistory: GlacierMassData[] = copernicus[glacierId] ?? []
  const climateData = await fetchGlacierClimate(
    glacierInfo.lat,
    glacierInfo.lon,
    glacierInfo.altitude ?? 0
  )

  const riskIndex = calculateGlacierRisk(climateData, massHistory)
  const riskCategory = getRiskCategory(riskIndex)
  const prediction = buildPrediction(massHistory, riskIndex)

  const system = `Eres un glaciólogo experto en criosfera global. Recibes datos reales de un glaciar.
Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "summary": "resumen de 2-3 oraciones del estado actual del glaciar",
  "riskExplanation": "explicación técnica de los factores de riesgo principales",
  "prediction": "proyección narrativa del comportamiento esperado a 5-10 años",
  "urgentActions": ["acción 1", "acción 2", "acción 3"],
  "monitoringRecommendations": ["monitoreo 1", "monitoreo 2", "monitoreo 3"],
  "publicAlert": "mensaje de alerta pública en lenguaje ciudadano"
}`

  const user = `Glaciar: ${glacierInfo.name} (${glacierInfo.country}, ${glacierInfo.region})
Coordenadas: lat ${glacierInfo.lat}, lon ${glacierInfo.lon}, altitud ${glacierInfo.altitude ?? 'desconocida'} m
Área: ${glacierInfo.area_km2 ?? 'desconocida'} km²
Historial de masa Copernicus (mmwe): ${JSON.stringify(massHistory)}
Clima actual: temp promedio ${climateData.temp_avg}°C, máxima ${climateData.temp_max}°C, precipitación ${climateData.precipitation_mm}mm, nieve ${climateData.snowfall_cm}cm, días sobre 0°C estimados ${climateData.days_above_zero}, anomalía térmica ${climateData.thermal_anomaly}°C
Índice de vulnerabilidad: ${riskIndex}/100 (${riskCategory})
Tendencia de retroceso: ${prediction.trend}
Años estimados hasta estado crítico: ${prediction.estimated_years_to_critical ?? 'ya en estado crítico'}`

  const raw = await callOpenRouter(MODELS.large, system, user)
  const llmAnalysis = parseJSON<GlacierAnalysis['llmAnalysis']>(raw, 'agent-glacier')

  return { glacierInfo, climateData, massHistory, riskIndex, riskCategory, prediction, llmAnalysis }
}
