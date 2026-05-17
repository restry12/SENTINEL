import type { SevereWeatherVariables } from '@sentinel/types'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

const HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'surface_pressure',
  'precipitation',
  'rain',
  'showers',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'wind_speed_80m',
  'wind_direction_80m',
  'wind_speed_120m',
  'wind_direction_120m',
]

export interface OpenMeteoHourlyData {
  time: string[]
  temperature_2m?: (number | null)[]
  relative_humidity_2m?: (number | null)[]
  surface_pressure?: (number | null)[]
  precipitation?: (number | null)[]
  rain?: (number | null)[]
  showers?: (number | null)[]
  weather_code?: (number | null)[]
  cloud_cover?: (number | null)[]
  wind_speed_10m?: (number | null)[]
  wind_direction_10m?: (number | null)[]
  wind_gusts_10m?: (number | null)[]
  wind_speed_80m?: (number | null)[]
  wind_direction_80m?: (number | null)[]
  wind_speed_120m?: (number | null)[]
  wind_direction_120m?: (number | null)[]
}

export interface OpenMeteoResponse {
  hourly: OpenMeteoHourlyData
}

export async function fetchOpenMeteoForecast(lat: number, lon: number): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: HOURLY_VARIABLES.join(','),
    forecast_days: '2',
    timezone: 'auto',
  })

  const url = `${OPEN_METEO_URL}?${params.toString()}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Open-Meteo error ${res.status}: ${text}`)
    }
    return await res.json() as OpenMeteoResponse
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Extract variables for a specific hour index from hourly data.
 */
export function extractVariablesAtIndex(hourly: OpenMeteoHourlyData, index: number): SevereWeatherVariables {
  return {
    temperature_2m: hourly.temperature_2m?.[index] ?? null,
    relative_humidity_2m: hourly.relative_humidity_2m?.[index] ?? null,
    surface_pressure: hourly.surface_pressure?.[index] ?? null,
    precipitation: hourly.precipitation?.[index] ?? null,
    rain: hourly.rain?.[index] ?? null,
    showers: hourly.showers?.[index] ?? null,
    weather_code: hourly.weather_code?.[index] ?? null,
    cloud_cover: hourly.cloud_cover?.[index] ?? null,
    wind_speed_10m: hourly.wind_speed_10m?.[index] ?? null,
    wind_direction_10m: hourly.wind_direction_10m?.[index] ?? null,
    wind_gusts_10m: hourly.wind_gusts_10m?.[index] ?? null,
    wind_speed_80m: hourly.wind_speed_80m?.[index] ?? null,
    wind_direction_80m: hourly.wind_direction_80m?.[index] ?? null,
    wind_speed_120m: hourly.wind_speed_120m?.[index] ?? null,
    wind_direction_120m: hourly.wind_direction_120m?.[index] ?? null,
  }
}

/**
 * Find the closest hour index to "now" in the time array, then return
 * indices for Now, +1h, +3h, +6h.
 */
export function findTimeIndices(times: string[]): { now: number; plus1h: number; plus3h: number; plus6h: number } {
  const nowMs = Date.now()
  let closestIdx = 0
  let closestDiff = Infinity

  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - nowMs)
    if (diff < closestDiff) {
      closestDiff = diff
      closestIdx = i
    }
  }

  return {
    now: closestIdx,
    plus1h: Math.min(closestIdx + 1, times.length - 1),
    plus3h: Math.min(closestIdx + 3, times.length - 1),
    plus6h: Math.min(closestIdx + 6, times.length - 1),
  }
}
