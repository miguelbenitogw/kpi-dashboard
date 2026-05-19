import { NextRequest, NextResponse } from 'next/server'
import { syncCandidateTags } from '@/lib/zoho/sync-candidate-tags'

export const maxDuration = 300

/**
 * GET /api/cron/sync-candidate-tags
 *
 * Weekly cron — syncs Associated_Tags from Zoho into candidates_kpi.tags.
 * Schedule: 0 6 * * 0 (Sunday 06:00 UTC)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const result = await syncCandidateTags()

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        ...result,
      },
      { status: result.errors.length > 0 ? 207 : 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: message, duration_ms: Date.now() - startTime },
      { status: 500 },
    )
  }
}
