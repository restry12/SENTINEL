import type { FireData } from '@sentinel/types'

export async function fetchFires(
  latSouth: number,
  lonWest: number,
  latNorth: number,
  lonEast: number,
  days = 1
): Promise<FireData[]> {
  const key = process.env.NASA_FIRMS_API_KEY
  if (!key) throw new Error('NASA_FIRMS_API_KEY is not set')

  if (days < 1 || days > 10) throw new Error(`FIRMS: days must be 1-10, got ${days}`)

  const area = `${lonWest},${latSouth},${lonEast},${latNorth}`
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${area}/${days}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`NASA FIRMS error: ${res.status}`)

  const csv = await res.text()
  return parseFirmsCsv(csv)
}

function parseFirmsCsv(csv: string): FireData[] {
  const lines = csv.trim().replace(/\r/g, '').split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',')
  const latIdx = headers.indexOf('latitude')
  const lonIdx = headers.indexOf('longitude')
  const frpIdx = headers.indexOf('frp')
  const brightIdx = headers.indexOf('bright_ti4')
  const timeIdx = headers.indexOf('acq_time')
  const dateIdx = headers.indexOf('acq_date')

  if ([latIdx, lonIdx, frpIdx, brightIdx, timeIdx, dateIdx].some(i => i === -1)) {
    throw new Error('FIRMS CSV missing expected columns')
  }

  return lines.slice(1)
    .map((line) => {
      const cols = line.split(',')
      const time = String(cols[timeIdx]).padStart(4, '0')
      return {
        lat: parseFloat(cols[latIdx]),
        lon: parseFloat(cols[lonIdx]),
        frp: parseFloat(cols[frpIdx]),
        brightness: parseFloat(cols[brightIdx]),
        timestamp: `${cols[dateIdx]}T${time.slice(0, 2)}:${time.slice(2)}:00Z`,
      }
    })
    .filter(f => !isNaN(f.lat) && !isNaN(f.lon) && !isNaN(f.frp))
}
