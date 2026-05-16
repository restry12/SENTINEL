import type { AirData, FireData, AirAlerts } from '@sentinel/types'
import { callOpenRouter, parseJSON, MODELS } from './openrouter'

function toAqiData(air: AirData, fires: FireData[]) {
  return {
    stations: [
      { name: 'Estación principal', aqi: air.aqi, pm25: air.pm25 },
    ],
    fire_count: fires.length,
  }
}

// A3: AQI / Health Monitor
export async function analyzeAir(air: AirData, fires: FireData[]): Promise<AirAlerts> {
  const aqiData = toAqiData(air, fires)
  const location = { region: 'Patagonia / Araucanía, Chile-Argentina' }

  const system = `Eres un monitor experto de calidad del aire y salud pública en contexto de incendios.
Recibes datos de AQI (Air Quality Index) y ubicación.
Debes responder SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código.
El JSON debe tener exactamente esta estructura:
{
  "alertas": [
    {
      "zona": "nombre de la zona",
      "aqi": número,
      "color": "verde" | "amarillo" | "naranja" | "rojo" | "morado" | "granate",
      "nivel": "Bueno" | "Moderado" | "Dañino para grupos sensibles" | "Dañino" | "Muy dañino" | "Peligroso",
      "recomendacion": "instrucción concreta en español para la población"
    }
  ],
  "resumen_general": "evaluación general de la calidad del aire en la zona afectada"
}`

  const user = `Datos AQI:\n${JSON.stringify(aqiData, null, 2)}\n\nUbicación: ${JSON.stringify(location)}\n\nGenera alertas de salud por zona con colores semánticos y recomendaciones.`

  const raw = await callOpenRouter(MODELS.small, system, user)
  return parseJSON<AirAlerts>(raw, 'Agent 3 (AQI)')
}
