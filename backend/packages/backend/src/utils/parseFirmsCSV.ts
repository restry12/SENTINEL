import type { FireData } from '@sentinel/types'

export function parseFirmsCSV(csv: string): FireData[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',')
  const idx = {
    lat: headers.indexOf('latitude'),
    lon: headers.indexOf('longitude'),
    brightness: headers.indexOf('bright_ti4'),
    frp: headers.indexOf('frp'),
    date: headers.indexOf('acq_date'),
    time: headers.indexOf('acq_time'),
  }

  const fires: FireData[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < headers.length) continue

    const lat = parseFloat(cols[idx.lat])
    const lon = parseFloat(cols[idx.lon])
    const frp = parseFloat(cols[idx.frp])
    const brightness = parseFloat(cols[idx.brightness])
    const dateStr = cols[idx.date]?.trim()
    // acq_time is HHMM as integer (e.g. 534 = 05:34)
    const timeRaw = cols[idx.time]?.trim().padStart(4, '0')
    const timestamp = `${dateStr}T${timeRaw.slice(0, 2)}:${timeRaw.slice(2)}:00Z`

    if (!isFinite(lat) || !isFinite(lon) || !isFinite(frp)) continue

    fires.push({ lat, lon, frp, brightness, timestamp })
  }

  return fires
}
