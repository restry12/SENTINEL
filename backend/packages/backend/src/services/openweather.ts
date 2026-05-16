import type { WeatherData } from '@sentinel/types'

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = process.env.OPENWEATHER_API_KEY
  if (!key) throw new Error('OPENWEATHER_API_KEY is not set')

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`)

  const json = await res.json() as {
    wind: { speed: number; deg: number; gust?: number }
    main: { humidity: number }
  }

  if (!json.wind) throw new Error('OpenWeather: unexpected response shape')

  return {
    speed: json.wind.speed,
    deg: json.wind.deg,
    gust: json.wind.gust,
    humidity: json.main.humidity,
  }
}
