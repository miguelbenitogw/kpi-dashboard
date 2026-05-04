import { NextRequest, NextResponse } from 'next/server'
import { syncGermanyCandidateData } from '@/lib/zoho/sync-germany-candidates'

export const maxDuration = 300

/**
 * GET /api/cron/sync-germany-candidates
 *
 * Syncs Zoho tags and job history for Germany candidates.
 * Reads germany_candidates_kpi.zoho_candidate_id, fetches tags and
 * Associate_Job_Openings from Zoho, and updates tags + zoho_history.
 *
 * Protected by Bearer CRON_SECRET.
 * Recommended schedule: weekly (0 3 * * 0) — 774 candidates × 300ms delay
 * means roughly 4 minutes for history, plus tag fetch time.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const result = await syncGermanyCandidateData()

    const hasErrors = result.errors.length > 0

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        total_candidates: result.total_candidates,
        tags_updated: result.tags_updated,
        history_updated: result.history_updated,
        history_skipped: result.history_skipped,
        errors: result.errors,
      },
      { status: hasErrors ? 207 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: message, duration_ms: Date.now() - startTime },
      { status: 500 }
    )
  }
}
