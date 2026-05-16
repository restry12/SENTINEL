import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

// Last known SentinelUpdate — used to hydrate the dashboard on load so it has
// memory without waiting for the next Make.com trigger.
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/last`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return NextResponse.json({ ok: false, update: null }, { status: 502 })
  }
}
