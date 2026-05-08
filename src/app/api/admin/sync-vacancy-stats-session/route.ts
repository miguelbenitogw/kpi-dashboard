/**
 * POST /api/admin/sync-vacancy-stats-session
 *
 * Session-protected version of sync-vacancy-stats.
 * For each active vacancy, fetches all candidates from Zoho and aggregates
 * counts by status into vacancy_status_counts_kpi.
 *
 * Same logic as /api/admin/sync-vacancy-stats but uses Supabase session auth
 * so it can be called from the dashboard UI without an API key.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'

export const maxDuration = 300

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requireAuth(): Promise<boolean> {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

export async function POST() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  const { data: vacancies, error: vacError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)

  if (vacError) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch vacancies: ${vacError.message}` },
      { status: 500 },
    )
  }

  const vacList = vacancies ?? []
  const errors: string[] = []
  let vacanciesProcessed = 0
  let totalCountsUpserted = 0

  for (let i = 0; i < vacList.length; i++) {
    const vacancy = vacList[i]!
    try {
      const candidates = await fetchAllCandidatesByJobOpening(vacancy.id)

      const statusMap = new Map<string, number>()
      for (const c of candidates) {
        const status = (c.Candidate_Status as string) ?? 'Sin estado'
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
      }

      if (statusMap.size === 0) {
        vacanciesProcessed++
        if (i < vacList.length - 1) await sleep(500)
        continue
      }

      const now = new Date().toISOString()
      const rows = Array.from(statusMap.entries()).map(([status, count]) => ({
        vacancy_id: vacancy.id,
        status,
        count,
        synced_at: now,
      }))

      const { error: upsertError } = await supabaseAdmin
        .from('vacancy_status_counts_kpi')
        .upsert(rows, { onConflict: 'vacancy_id,status' })

      if (upsertError) {
        errors.push(`${vacancy.title}: ${upsertError.message}`)
      } else {
        totalCountsUpserted += rows.length
      }

      vacanciesProcessed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${vacancy.title}: ${msg}`)
    }

    if (i < vacList.length - 1) await sleep(500)
  }

  return NextResponse.json({
    success: errors.length === 0,
    vacancies_processed: vacanciesProcessed,
    total_counts_upserted: totalCountsUpserted,
    errors,
    duration_ms: Date.now() - startedAt,
  })
}
