import type { WeatherData } from '@sentinel/types'

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = process.env.OPENWEATHER_API_KEY
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`)

  const json = await res.json() as {
    wind: { speed: number; deg: number; gust?: number }
    main: { humidity: number }
  }

  return {
    speed: json.wind.speed,
    deg: json.wind.deg,
    gust: json.wind.gust,
    humidity: json.main.humidity,
  }
}
