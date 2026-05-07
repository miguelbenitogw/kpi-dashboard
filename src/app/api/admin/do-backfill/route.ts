/**
 * TEMPORAL — delete after single use.
 * POST /api/admin/do-backfill — called from the admin button in ClosedVacancyCvsView.
 * No auth: this route exists only for the temporary UI button and will be removed.
 *
 * Strategy: counts candidates with status 'Hired' or 'Approved by client' per closed
 * vacancy directly from candidate_job_history_kpi — same logic used for active vacancies.
 * No Zoho API calls needed.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST() {
  // 1. Aggregate hired counts from candidate history (same logic as active vacancies)
  // "Positivos" group — same statuses used in VacancyStatusCharts segmented bar
  const HIRED_STATUSES = [
    'Hired',
    'Approved by client',
    'In Training',
    'To Place',
    'Assigned',
    'Training Finished',
    'Stand-by',
  ]

  const { data: counts, error: countErr } = await supabaseAdmin
    .from('candidate_job_history_kpi')
    .select('job_opening_id')
    .in('candidate_status_in_jo', HIRED_STATUSES)

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })

  // Group by job_opening_id
  const byVacancy = new Map<string, number>()
  for (const row of counts ?? []) {
    if (!row.job_opening_id) continue
    byVacancy.set(row.job_opening_id, (byVacancy.get(row.job_opening_id) ?? 0) + 1)
  }

  if (byVacancy.size === 0) {
    return NextResponse.json({ total: 0, updated: 0, skipped: 0, errors: 0 })
  }

  // 2. Update each closed vacancy that has a non-zero count
  let updated = 0, skipped = 0, errors = 0

  for (const [vacancyId, count] of byVacancy.entries()) {
    if (count === 0) { skipped++; continue }

    const { error: upErr } = await supabaseAdmin
      .from('job_openings_kpi')
      .update({ hired_count: count })
      .eq('id', vacancyId)
      .eq('es_proceso_atraccion_actual', false)

    if (upErr) errors++; else updated++
  }

  return NextResponse.json({
    total: byVacancy.size,
    updated,
    skipped,
    errors,
  })
}
