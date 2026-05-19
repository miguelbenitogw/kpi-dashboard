import { NextRequest, NextResponse } from 'next/server'
import { getPlacementCalendar, getPlacementSummary } from '@/lib/queries/placement'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const year  = parseInt(searchParams.get('year')  ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10)

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  try {
    const [calendar, summary] = await Promise.all([
      getPlacementCalendar(year, month),
      getPlacementSummary(year, month),
    ])
    return NextResponse.json({ calendar, summary })
  } catch (error) {
    console.error('[placement/calendar] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
