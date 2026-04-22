import { NextRequest, NextResponse } from 'next/server'
import { syncVacancyTagCountsLocal } from '@/lib/supabase/sync-vacancy-tags-local'

export const maxDuration = 300

/**
 * POST /api/admin/sync-vacancy-tags-local
 *
 * Computes vacancy tag counts from Supabase data only (no Zoho API calls).
 * Safe for closed vacancies — reads candidate_job_history_kpi + candidates_kpi.tags.
 *
 * Body (all optional):
 *   onlyActive  boolean  — only process active vacancies (default: false = all)
 *   vacancyIds  string[] — limit to specific vacancy IDs
 *   forceAll    boolean  — recompute even closed vacancies already in table
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to trigger sync',
    body_options: {
      onlyActive: 'boolean — only process active vacancies',
      vacancyIds: 'string[] — limit to specific vacancy IDs',
      forceAll: 'boolean — recompute closed vacancies even if already in table',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const options = {
      onlyActive: body.onlyActive === true,
      vacancyIds: Array.isArray(body.vacancyIds) ? body.vacancyIds : undefined,
      forceAll: body.forceAll === true,
    }

    const result = await syncVacancyTagCountsLocal(options)

    return NextResponse.json(
      { success: true, ...result },
      { status: result.errors.length > 0 ? 207 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
