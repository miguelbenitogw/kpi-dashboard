import { NextRequest, NextResponse } from 'next/server'
import {
  runPromoSync,
  getSyncCursor,
  syncPromoCandidatesChunked,
} from '@/lib/zoho/sync'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if there's an ongoing chunked sync that needs continuing
    const cursor = await getSyncCursor()

    if (cursor && !cursor.completed) {
      // Continue the chunked promo sync (5 pages per cron run)
      const chunkResult = await syncPromoCandidatesChunked(5)

      return NextResponse.json(
        {
          type: 'continue_promo',
          candidates: chunkResult,
          message: chunkResult.completed
            ? 'Promo sync completed'
            : `Continuing promo sync. ${chunkResult.candidates_this_chunk} candidates this chunk.`,
        },
        { status: chunkResult.errors.length === 0 ? 200 : 207 }
      )
    }

    // Normal promo sync (job openings + promo candidates only)
    const result = await runPromoSync()

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
