import { NextRequest, NextResponse } from 'next/server'
import {
  syncJobOpenings,
  syncPromoCandidatesChunked,
  clearSyncCursor,
} from '@/lib/zoho/sync'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Reset cursor for a fresh promo sync
    await clearSyncCursor()

    // Sync job openings first (fast, needed to identify promos)
    const jobResult = await syncJobOpenings()

    // Fetch promo candidates in chunks (5 pages per run)
    // With ~75 candidates across ~3 promos, this should complete in one run
    const chunkResult = await syncPromoCandidatesChunked(5)

    return NextResponse.json(
      {
        job_openings: jobResult,
        candidates: chunkResult,
        message: chunkResult.completed
          ? 'Promo sync completed in one run'
          : 'Promo sync started. Daily cron will continue from where it left off.',
      },
      {
        status:
          jobResult.errors.length === 0 && chunkResult.errors.length === 0
            ? 200
            : 207,
      }
    )
  } catch (error) {
    console.error('[cron/sync-full] Fatal error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
