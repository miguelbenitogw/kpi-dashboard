import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const challenge = request.nextUrl.searchParams.get('challenge')

    if (!challenge) {
      return NextResponse.json(
        { error: 'Missing challenge parameter' },
        { status: 400 },
      )
    }

    return NextResponse.json({ challenge })
  } catch {
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 },
    )
  }
}
