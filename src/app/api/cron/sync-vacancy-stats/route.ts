/**
 * GET /api/cron/sync-vacancy-stats
 *
 * Daily cron — syncs job openings metadata + candidate status counts for all
 * active vacancies from Zoho. Runs at 07:00 Madrid time (05:00 UTC).
 * Protected by Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { POST as syncJobOpeningsPost } from '@/app/api/admin/sync-job-openings/route'
import { POST as syncVacancyStatsPost } from '@/app/api/admin/sync-vacancy-stats/route'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader  = request.headers.get('authorization')
  const cronSecret  = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncApiKey = process.env.SYNC_API_KEY
  if (!syncApiKey) {
    return NextResponse.json({ error: 'Missing SYNC_API_KEY' }, { status: 500 })
  }

  const headers = { 'x-api-key': syncApiKey }
  const startedAt = Date.now()

  // 1. Sync job openings metadata
  const req1 = new Request(request.url, { method: 'POST', headers })
  const res1 = await syncJobOpeningsPost(req1)
  const openings = await res1.json()

  // 2. Sync candidate status counts per active vacancy
  const req2 = new Request(request.url, { method: 'POST', headers })
  const res2 = await syncVacancyStatsPost(req2)
  const stats = await res2.json()

  return NextResponse.json({
    success: true,
    duration_ms: Date.now() - startedAt,
    openings,
    stats,
  })
}
