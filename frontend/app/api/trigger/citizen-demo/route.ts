import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { phone?: string; lat?: number; lon?: number }
    const phone = typeof body.phone === 'string' && body.phone.startsWith('+') ? body.phone : null
    if (!phone) return NextResponse.json({ ok: false, error: 'phone required' }, { status: 400 })

    const makeUrl = process.env.MAKE_WEBHOOK_URL
    if (!makeUrl) return NextResponse.json({ ok: false, error: 'MAKE_WEBHOOK_URL not configured' }, { status: 500 })

    const userLat = body.lat ?? -38.5
    const userLon = body.lon ?? -72.0
    const fireLat = Math.round((userLat + 0.004) * 10000) / 10000
    const fireLon = Math.round((userLon + 0.003) * 10000) / 10000

    const makeHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    const secret = process.env.MAKE_WEBHOOK_SECRET
    if (secret) makeHeaders['x-make-apikey'] = secret

    const makeRes = await fetch(makeUrl, {
      method: 'POST',
      headers: makeHeaders,
      body: JSON.stringify({
        to: phone,
        fire_lat: fireLat,
        fire_lon: fireLon,
        fire_frp_mw: 127.4,
        fire_brightness: 412.8,
        distance_km: 0.54,
        user_lat: userLat,
        user_lon: userLon,
        google_maps_fire_url: `https://maps.google.com/?q=${fireLat},${fireLon}`,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!makeRes.ok) {
      const text = await makeRes.text()
      console.error('[citizen-demo] Make.com rejected:', makeRes.status, text)
      return NextResponse.json({ ok: false, error: `Make.com ${makeRes.status}: ${text}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[citizen-demo]', err)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}
