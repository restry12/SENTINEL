import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AGENT_URL = process.env.AGENT_SEVERE_WEATHER_URL ?? 'http://localhost:3007'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const mode = searchParams.get('mode') ?? 'live'

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${AGENT_URL}/api/severe-weather?lat=${lat}&lon=${lon}&mode=${mode}`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Severe weather agent unreachable' }, { status: 502 })
  }
}
