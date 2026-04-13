import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/zoho/sync'
import { getSyncCursor, syncCandidatesChunked } from '@/lib/zoho/sync'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if there's an ongoing full sync that needs continuing
    const cursor = await getSyncCursor()

    if (cursor && !cursor.completed) {
      // Continue the chunked full sync (5 pages per cron run)
      const chunkResult = await syncCandidatesChunked(5)

      return NextResponse.json(
        {
          type: 'continue_full',
          candidates: chunkResult,
          message: chunkResult.completed
            ? 'Full sync completed'
            : `Continuing full sync. Page ${chunkResult.page}, ${chunkResult.candidates_so_far} candidates so far.`,
        },
        { status: chunkResult.errors.length === 0 ? 200 : 207 }
      )
    }

    // Normal incremental sync (only recently modified candidates — fast)
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
