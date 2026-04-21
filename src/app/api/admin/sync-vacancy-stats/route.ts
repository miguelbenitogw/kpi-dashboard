/**
 * POST /api/admin/sync-vacancy-stats
 *
 * For each active vacancy (es_proceso_atraccion_actual = true), fetches all
 * associated candidates from Zoho Recruit and stores ONLY the aggregated
 * counts per Candidate_Status — no individual candidate rows are stored.
 *
 * Requires x-api-key header matching SYNC_API_KEY env var.
 */
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const startedAt = Date.now()

  // 1. Fetch active vacancies from Supabase
  const { data: vacancies, error: vacError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)

  if (vacError) {
    return Response.json(
      { success: false, error: `Failed to fetch vacancies: ${vacError.message}` },
      { status: 500 },
    )
  }

  const vacList = vacancies ?? []
  const errors: string[] = []
  let vacanciesProcessed = 0
  let totalCountsUpserted = 0

  // 2. For each vacancy: fetch candidates from Zoho and aggregate by status
  for (let i = 0; i < vacList.length; i++) {
    const vacancy = vacList[i]

    try {
      const candidates = await fetchAllCandidatesByJobOpening(vacancy.id)

      // Aggregate counts by Candidate_Status
      const statusMap = new Map<string, number>()
      for (const c of candidates) {
        const status = (c.Candidate_Status as string) ?? 'Sin estado'
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
      }

      if (statusMap.size === 0) {
        // No candidates — nothing to upsert for this vacancy
        vacanciesProcessed++
        if (i < vacList.length - 1) await sleep(500)
        continue
      }

      // Build upsert rows
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
        errors.push(`${vacancy.title} (${vacancy.id}): ${upsertError.message}`)
      } else {
        totalCountsUpserted += rows.length
      }

      vacanciesProcessed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${vacancy.title} (${vacancy.id}): ${msg}`)
      // Continue with next vacancy even on error
    }

    // Rate-limit delay between vacancies (skip on last)
    if (i < vacList.length - 1) {
      await sleep(500)
    }
  }

  return Response.json({
    success: errors.length === 0,
    vacancies_processed: vacanciesProcessed,
    total_counts_upserted: totalCountsUpserted,
    errors,
    duration_ms: Date.now() - startedAt,
  })
}
