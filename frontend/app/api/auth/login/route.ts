import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Mock successful login
    // In a real app, you would verify credentials against a database
    if (email && password) {
      return NextResponse.json(
        {
          success: true,
          user: {
            id: 'mock-user-123',
            name: 'Sentinel Operator',
            email: email,
            role: 'operator',
          },
          token: 'mock-jwt-token-xyz-789',
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Invalid credentials' },
      { status: 401 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
