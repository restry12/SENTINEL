import type { AirData } from '@sentinel/types'

export async function fetchAirQuality(lat: number, lon: number): Promise<AirData> {
  const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=50000&parameters_id=2&limit=1`

  const res = await fetch(url, {
    headers: { 'X-API-Key': process.env.OPENAQ_API_KEY ?? '' }
  })
  if (!res.ok) throw new Error(`OpenAQ error: ${res.status}`)

  const json = await res.json() as {
    results: Array<{
      sensors?: Array<{ latest?: { value?: number } }>
    }>
  }

  if (!json.results.length) throw new Error('OpenAQ: no monitoring stations found within radius')

  const value = json.results[0]?.sensors?.[0]?.latest?.value ?? 0
  const aqi = pm25ToAqi(value)

  return {
    pm25: value,
    aqi,
    category: aqiCategory(aqi),
  }
}

function pm25ToAqi(pm25: number): number {
  const v = Math.max(0, pm25)
  if (v <= 12) return Math.round((50 / 12) * v)
  if (v <= 35.4) return Math.round(50 + ((100 - 51) / (35.4 - 12.1)) * (v - 12.1))
  if (v <= 55.4) return Math.round(100 + ((150 - 101) / (55.4 - 35.5)) * (v - 35.5))
  if (v <= 150.4) return Math.round(150 + ((200 - 151) / (150.4 - 55.5)) * (v - 55.5))
  if (v <= 250.4) return Math.round(200 + ((300 - 201) / (250.4 - 150.5)) * (v - 150.5))
  return Math.round(300 + ((400 - 301) / (350.4 - 250.5)) * (v - 250.5))
}

function aqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}
