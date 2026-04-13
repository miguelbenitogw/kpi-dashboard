import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/zoho/sync'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  const syncApiKey = process.env.SYNC_API_KEY

  if (!syncApiKey || apiKey !== syncApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const typeParam = searchParams.get('type') ?? 'incremental'
  const syncType =
    typeParam === 'full' ? 'full' : ('incremental' as const)

  try {
    const result = await runSync(syncType)

    return NextResponse.json(result, {
      status: result.errors.length === 0 ? 200 : 207,
    })
  } catch (error) {
    console.error('[admin/trigger-sync] Fatal error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
