import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

// Fire Risk Grid — proxied from the backend, lazy-loaded by the dashboard toggle.
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/risk-grid`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'backend unreachable' }, { status: 502 })
  }
}
