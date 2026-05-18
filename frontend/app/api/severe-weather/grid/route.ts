import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AGENT_URL = process.env.AGENT_SEVERE_WEATHER_URL ?? 'http://localhost:3007'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const latMin = searchParams.get('lat_min')
  const latMax = searchParams.get('lat_max')
  const lonMin = searchParams.get('lon_min')
  const lonMax = searchParams.get('lon_max')
  const step = searchParams.get('step')

  let url = `${AGENT_URL}/api/severe-weather/grid`
  const params = new URLSearchParams()
  if (latMin) params.set('lat_min', latMin)
  if (latMax) params.set('lat_max', latMax)
  if (lonMin) params.set('lon_min', lonMin)
  if (lonMax) params.set('lon_max', lonMax)
  if (step) params.set('step', step)

  const qs = params.toString()
  if (qs) url += `?${qs}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Severe weather agent unreachable' }, { status: 502 })
  }
}
