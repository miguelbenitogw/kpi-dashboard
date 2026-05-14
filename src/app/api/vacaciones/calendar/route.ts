import { NextRequest, NextResponse } from 'next/server'
import { getCalendarData } from '@/lib/queries/vacaciones'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10)

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  try {
    const data = await getCalendarData(year, month)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[vacaciones/calendar] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
