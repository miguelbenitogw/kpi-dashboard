import { NextRequest, NextResponse } from 'next/server'
import {
  runPromoSync,
  syncJobOpenings,
  syncPromoCandidatesChunked,
  clearSyncCursor,
  getSyncCursor,
  cleanupNonPromoCandidates,
} from '@/lib/zoho/sync'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  const syncApiKey = process.env.SYNC_API_KEY

  if (!syncApiKey || apiKey !== syncApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const typeParam = searchParams.get('type') ?? 'promo'

  try {
    // --- Cleanup: remove non-promo candidates from Supabase ---
    if (typeParam === 'cleanup') {
      const result = await cleanupNonPromoCandidates()

      return NextResponse.json({
        type: 'cleanup',
        ...result,
      }, {
        status: result.errors.length === 0 ? 200 : 207,
      })
    }

    // --- Full promo sync (job openings + promo candidates in one shot) ---
    if (typeParam === 'promo' || typeParam === 'full') {
      await clearSyncCursor()

      const result = await runPromoSync()

      return NextResponse.json(result, {
        status: result.errors.length === 0 ? 200 : 207,
      })
    }

    // --- Chunked promo sync: start fresh ---
    if (typeParam === 'chunked') {
      await clearSyncCursor()

      // Sync job openings first to identify promos
      const jobResult = await syncJobOpenings()
      const chunkResult = await syncPromoCandidatesChunked(5)

      return NextResponse.json({
        type: 'chunked',
        job_openings: jobResult,
        candidates: chunkResult,
      })
    }

    // --- Continue an existing chunked sync ---
    if (typeParam === 'continue') {
      const cursor = await getSyncCursor()

      if (!cursor || cursor.completed) {
        return NextResponse.json({
          message: 'No active sync to continue. Use ?type=chunked to start one.',
          cursor,
        })
      }

      const chunkResult = await syncPromoCandidatesChunked(5)

      return NextResponse.json({
        type: 'continue',
        candidates: chunkResult,
      })
    }

    // --- Job openings only ---
    if (typeParam === 'job-openings') {
      const result = await syncJobOpenings()
      return NextResponse.json({
        type: 'job-openings',
        ...result,
      })
    }

    return NextResponse.json(
      { error: `Unknown sync type: ${typeParam}. Valid: promo, full, chunked, continue, cleanup, job-openings` },
      { status: 400 }
    )
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
