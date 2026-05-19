import { NextRequest, NextResponse } from 'next/server'
import { syncVacancyTagCountsLocal } from '@/lib/supabase/sync-vacancy-tags-local'
import { syncVacancyTagCountsFromZoho } from '@/lib/zoho/sync-vacancy-tags-zoho'

export const maxDuration = 300

/**
 * GET /api/cron/sync-vacancy-tags
 *
 * Weekly cron — pre-aggregates candidate tag counts per vacancy.
 * Phase 1: Local (Supabase-only, all vacancies — fast).
 * Phase 2: Zoho API (active vacancies only — slower, covers fresh associations).
 *
 * Schedule: 30 6 * * 0 (Sunday 06:30 UTC)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const errors: string[] = []

  let localResult = null
  let zohoResult = null

  try {
    localResult = await syncVacancyTagCountsLocal()
    errors.push(...localResult.errors)
  } catch (err) {
    errors.push(`[local] ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    zohoResult = await syncVacancyTagCountsFromZoho({ onlyActive: true })
    errors.push(...zohoResult.errors)
  } catch (err) {
    errors.push(`[zoho] ${err instanceof Error ? err.message : String(err)}`)
  }

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      local: localResult,
      zoho: zohoResult,
      errors,
    },
    { status: errors.length > 0 ? 207 : 200 },
  )
}
