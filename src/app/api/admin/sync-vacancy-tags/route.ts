import { NextRequest, NextResponse } from 'next/server'
import { syncVacancyTagCounts } from '@/lib/supabase/sync-vacancy-tags'

export const maxDuration = 60

/**
 * GET /api/admin/sync-vacancy-tags
 *
 * Returns usage instructions. Use POST to trigger the actual sync.
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({ message: 'Use POST to trigger sync' })
}

/**
 * POST /api/admin/sync-vacancy-tags
 *
 * Pre-aggregates candidate tag counts per vacancy into vacancy_tag_counts_kpi.
 * Active vacancies are always recomputed; closed vacancies are only computed once.
 */
export async function POST(_request: NextRequest) {
  try {
    const result = await syncVacancyTagCounts()

    return NextResponse.json(
      { success: true, ...result },
      { status: result.errors.length > 0 ? 207 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
