import type { WeatherData, FireData } from '@sentinel/types'

export interface WeatherAnalysis {
  windDirection: string
  spreadRisk: 'low' | 'medium' | 'high'
  humidityRisk: 'low' | 'medium' | 'high'
  summary: string
}

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function analyzeWeather(weather: WeatherData, fires: FireData[]): WeatherAnalysis {
  const windDirection = degreesToCompass(weather.deg)

  const spreadRisk: WeatherAnalysis['spreadRisk'] =
    weather.speed > 15 ? 'high' : weather.speed > 7 ? 'medium' : 'low'

  const humidityRisk: WeatherAnalysis['humidityRisk'] =
    weather.humidity < 20 ? 'high' : weather.humidity < 40 ? 'medium' : 'low'

  const summary =
    `Wind ${weather.speed}m/s from ${windDirection}. ` +
    `Humidity ${weather.humidity}%. ` +
    `Spread risk: ${spreadRisk}. ` +
    `${fires.length} active fire(s) detected.`

  return { windDirection, spreadRisk, humidityRisk, summary }
}
