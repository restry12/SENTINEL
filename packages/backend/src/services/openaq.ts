import type { AirData } from '@sentinel/types'

export async function fetchAirQuality(lat: number, lon: number): Promise<AirData> {
  // OpenAQ v3 — find nearest location with PM2.5 readings
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

  const value = json.results[0]?.sensors?.[0]?.latest?.value ?? 0
  return {
    pm25: value,
    aqi: pm25ToAqi(value),
    category: aqiCategory(pm25ToAqi(value)),
  }
}

// US EPA breakpoints (simplified)
function pm25ToAqi(pm25: number): number {
  if (pm25 <= 12) return Math.round((50 / 12) * pm25)
  if (pm25 <= 35.4) return Math.round(50 + ((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1))
  if (pm25 <= 55.4) return Math.round(100 + ((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5))
  if (pm25 <= 150.4) return Math.round(150 + ((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5))
  if (pm25 <= 250.4) return Math.round(200 + ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5))
  return Math.round(300 + ((400 - 301) / (350.4 - 250.5)) * (pm25 - 250.5))
}

function aqiCategory(aqi: number): string {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}
