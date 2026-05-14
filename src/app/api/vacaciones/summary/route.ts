import { NextRequest, NextResponse } from 'next/server'
import { getVacationSummary } from '@/lib/queries/vacaciones'

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') ?? '', 10)

  if (!year) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  try {
    const data = await getVacationSummary(year)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[vacaciones/summary] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
