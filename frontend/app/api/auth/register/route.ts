import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

// The register form collects name/email/phone/city/password. The backend
// requires countryCode + cityName too — SENTINEL targets Chile, so default
// the country here and map city → cityName.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = {
      email: body.email,
      password: body.password,
      name: body.name,
      phone: body.phone,
      countryCode: 'CL',
      countryName: 'Chile',
      stateCode: '',
      stateName: '',
      cityName: body.city,
    }
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'No se pudo contactar el servidor de autenticación' },
      { status: 502 }
    )
  }
}
