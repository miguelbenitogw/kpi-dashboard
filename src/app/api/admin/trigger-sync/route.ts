import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/zoho/sync'
import {
  syncJobOpenings,
  syncCandidatesChunked,
  clearSyncCursor,
  getSyncCursor,
} from '@/lib/zoho/sync'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  const syncApiKey = process.env.SYNC_API_KEY

  if (!syncApiKey || apiKey !== syncApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const typeParam = searchParams.get('type') ?? 'incremental'

  try {
    if (typeParam === 'full') {
      // Start a new full sync: sync job openings first, then start chunked candidates
      await clearSyncCursor()

      const jobResult = await syncJobOpenings()
      const chunkResult = await syncCandidatesChunked(5)

      return NextResponse.json({
        type: 'full',
        job_openings: jobResult,
        candidates: chunkResult,
      })
    }

    if (typeParam === 'continue') {
      // Continue an existing chunked sync
      const cursor = await getSyncCursor()

      if (!cursor || cursor.completed) {
        return NextResponse.json({
          message: 'No active sync to continue. Use ?type=full to start one.',
          cursor,
        })
      }

      const chunkResult = await syncCandidatesChunked(5)

      return NextResponse.json({
        type: 'continue',
        candidates: chunkResult,
      })
    }

    if (typeParam === 'chunk') {
      // Run a specific number of pages
      const pagesParam = searchParams.get('pages')
      const pages = pagesParam ? parseInt(pagesParam, 10) : 5

      const chunkResult = await syncCandidatesChunked(pages)

      return NextResponse.json({
        type: 'chunk',
        candidates: chunkResult,
      })
    }

    // Default: incremental sync (uses original runSync for recently modified)
    const result = await runSync('incremental')

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
