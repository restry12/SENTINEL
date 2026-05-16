import type { FireData } from '@sentinel/types'

// Make.com manda por cada foco: { lat, lon, frp, brightness, date|timestamp,
// speed, deg, humidity, temp?, pm25 }. pm25 puede venir null (OpenAQ sin
// estación cerca). Conserva el enriquecimiento por foco; antes se descartaba.
export function mapRawFiresToFireData(raw: Record<string, unknown>[]): FireData[] {
  return raw.map(f => {
    const hasWeather = typeof f.speed === 'number'
    return {
      lat: f.lat as number,
      lon: f.lon as number,
      frp: f.frp as number,
      brightness: f.brightness as number,
      timestamp: (f.date ?? f.timestamp) as string,
      weather: hasWeather
        ? {
            speed: f.speed as number,
            deg: f.deg as number,
            humidity: f.humidity as number,
            temp: typeof f.temp === 'number' ? f.temp : undefined,
          }
        : undefined,
      // number = valor real; null = OpenAQ sin estación; undefined = foco sin enriquecer (no vino de Make)
      pm25: typeof f.pm25 === 'number' ? f.pm25 : f.pm25 === null ? null : undefined,
    }
  })
}
