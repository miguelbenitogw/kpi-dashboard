import { NextRequest, NextResponse } from 'next/server'
import {
  syncJobOpenings,
  syncCandidatesChunked,
  clearSyncCursor,
  getSyncCursor,
} from '@/lib/zoho/sync'

export const maxDuration = 60

const TIMEOUT_BUFFER_MS = 5000 // Stop 5s before timeout
const SLEEP_BETWEEN_CHUNKS_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  const syncApiKey = process.env.SYNC_API_KEY

  if (!syncApiKey || apiKey !== syncApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const timeoutMs = (maxDuration * 1000) - TIMEOUT_BUFFER_MS
  const errors: string[] = []

  try {
    // Reset cursor and sync job openings first
    const cursor = await getSyncCursor()
    const isNewSync = !cursor || cursor.completed

    if (isNewSync) {
      await clearSyncCursor()

      const jobResult = await syncJobOpenings()
      if (jobResult.errors.length > 0) {
        errors.push(...jobResult.errors)
      }
    }

    // Loop: fetch 1 page at a time until done or timeout approaching
    let totalCandidatesSynced = 0
    let lastPage = 0
    let completed = false
    let iterations = 0

    while (true) {
      const elapsed = Date.now() - startTime
      if (elapsed >= timeoutMs) {
        break
      }

      const chunkResult = await syncCandidatesChunked(1)
      iterations++
      totalCandidatesSynced += chunkResult.candidates_this_chunk
      lastPage = chunkResult.page

      if (chunkResult.errors.length > 0) {
        errors.push(...chunkResult.errors)
      }

      if (chunkResult.completed) {
        completed = true
        break
      }

      // Rate limit between Zoho API calls
      await sleep(SLEEP_BETWEEN_CHUNKS_MS)
    }

    return NextResponse.json({
      completed,
      iterations,
      last_page: lastPage,
      candidates_synced_this_run: totalCandidatesSynced,
      elapsed_ms: Date.now() - startTime,
      errors,
    })
  } catch (error) {
    console.error('[admin/trigger-sync-loop] Fatal error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        elapsed_ms: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
