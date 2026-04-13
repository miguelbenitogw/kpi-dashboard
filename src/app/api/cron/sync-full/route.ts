import { NextRequest, NextResponse } from 'next/server'
import {
  syncJobOpenings,
  syncCandidatesChunked,
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
    // Reset cursor for a fresh full sync
    await clearSyncCursor()

    // Sync job openings first (fast)
    const jobResult = await syncJobOpenings()

    // Fetch first 5 pages of candidates (~1000)
    // If incomplete, the daily cron (sync) will continue picking up chunks
    const chunkResult = await syncCandidatesChunked(5)

    return NextResponse.json(
      {
        job_openings: jobResult,
        candidates: chunkResult,
        message: chunkResult.completed
          ? 'Full sync completed in one run'
          : 'Full sync started. Daily cron will continue from where it left off.',
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
