import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/zoho/sync'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSync('incremental')

    return NextResponse.json(result, {
      status: result.errors.length === 0 ? 200 : 207,
    })
  } catch (error) {
    console.error('[cron/sync] Fatal error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
