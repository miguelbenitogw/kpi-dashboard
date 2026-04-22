/**
 * Vacancy tag counts — local Supabase-only pipeline.
 *
 * Computes tag counts for vacancies using only data already in Supabase:
 *   candidate_job_history_kpi (vacancy ↔ candidate associations)
 *   candidates_kpi.tags        (tags per candidate)
 *
 * No Zoho API calls. Safe for closed vacancies (compute once, never update).
 * For active vacancies, re-run to refresh.
 */

import { supabaseAdmin } from '@/lib/supabase/server'

export interface SyncVacancyTagsLocalResult {
  processed: number
  skipped_closed: number
  upserted_rows: number
  errors: string[]
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Sync vacancy tag counts from local Supabase data.
 *
 * Strategy:
 *  - Active vacancies: always recompute (DELETE + INSERT).
 *  - Closed vacancies: skip if already in vacancy_tag_counts_kpi (set once, frozen).
 *
 * Options:
 *  - onlyActive: process only active vacancies (default: false = all)
 *  - vacancyIds: limit to specific vacancy IDs
 *  - forceAll: ignore the "skip closed if already processed" optimization
 */
export async function syncVacancyTagCountsLocal(options?: {
  onlyActive?: boolean
  vacancyIds?: string[]
  forceAll?: boolean
}): Promise<SyncVacancyTagsLocalResult> {
  const errors: string[] = []
  let processed = 0
  let skipped_closed = 0
  let upserted_rows = 0

  // ── Step 1: Load vacancies ──────────────────────────────────────────────────
  let vacancyQuery = supabaseAdmin
    .from('job_openings_kpi')
    .select('id, is_active')

  if (options?.vacancyIds && options.vacancyIds.length > 0) {
    vacancyQuery = vacancyQuery.in('id', options.vacancyIds)
  }

  const { data: vacancies, error: vacError } = await vacancyQuery

  if (vacError || !vacancies) {
    return { processed: 0, skipped_closed: 0, upserted_rows: 0, errors: [vacError?.message ?? 'Failed to fetch vacancies'] }
  }

  const activeIds = vacancies.filter((v) => v.is_active).map((v) => v.id)
  let closedIds = vacancies.filter((v) => !v.is_active).map((v) => v.id)

  if (options?.onlyActive) closedIds = []

  // ── Step 2: Skip closed vacancies already computed (frozen) ─────────────────
  let closedToProcess: string[] = closedIds

  if (!options?.forceAll && closedIds.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('vacancy_tag_counts_kpi')
      .select('vacancy_id')
      .in('vacancy_id', closedIds)

    const alreadyDone = new Set((existing ?? []).map((r) => r.vacancy_id))
    skipped_closed = alreadyDone.size
    closedToProcess = closedIds.filter((id) => !alreadyDone.has(id))
  }

  // ── Step 3: Delete existing rows for active vacancies (full refresh) ─────────
  if (activeIds.length > 0) {
    const { error: delError } = await supabaseAdmin
      .from('vacancy_tag_counts_kpi')
      .delete()
      .in('vacancy_id', activeIds)

    if (delError) errors.push(`Delete active tags: ${delError.message}`)
  }

  // ── Step 4: Process in batches of 50 ────────────────────────────────────────
  const toProcess = [...activeIds, ...closedToProcess]
  if (toProcess.length === 0) return { processed, skipped_closed, upserted_rows, errors }

  for (const batch of chunks(toProcess, 50)) {
    try {
      // a. Get candidate associations for this batch of vacancies
      const { data: history, error: histErr } = await supabaseAdmin
        .from('candidate_job_history_kpi')
        .select('job_opening_id, candidate_id')
        .in('job_opening_id', batch)

      if (histErr) {
        errors.push(`History fetch error: ${histErr.message}`)
        processed += batch.length
        continue
      }

      if (!history || history.length === 0) {
        processed += batch.length
        continue
      }

      // b. Get tags for all unique candidates in this batch
      const candidateIds = [...new Set(history.map((r) => r.candidate_id))]

      const { data: candidateRows, error: candErr } = await supabaseAdmin
        .from('candidates_kpi')
        .select('id, tags')
        .in('id', candidateIds)

      if (candErr) {
        errors.push(`Candidate tags fetch error: ${candErr.message}`)
        processed += batch.length
        continue
      }

      // c. Build candidate → tags map
      const tagMap = new Map<string, string[]>()
      for (const c of candidateRows ?? []) {
        if (Array.isArray(c.tags) && c.tags.length > 0) {
          tagMap.set(c.id, c.tags as string[])
        }
      }

      // d. Aggregate: vacancy_id → tag → count
      const counts = new Map<string, Map<string, number>>()
      for (const row of history) {
        const tags = tagMap.get(row.candidate_id) ?? []
        for (const tag of tags) {
          if (!counts.has(row.job_opening_id)) counts.set(row.job_opening_id, new Map())
          const tm = counts.get(row.job_opening_id)!
          tm.set(tag, (tm.get(tag) ?? 0) + 1)
        }
      }

      // e. Build insert rows
      const now = new Date().toISOString()
      const insertRows: { vacancy_id: string; tag: string; count: number; synced_at: string }[] = []

      for (const [vacancyId, tagCounts] of counts) {
        for (const [tag, count] of tagCounts) {
          insertRows.push({ vacancy_id: vacancyId, tag, count, synced_at: now })
        }
      }

      if (insertRows.length > 0) {
        const { error: upsertErr } = await supabaseAdmin
          .from('vacancy_tag_counts_kpi')
          .upsert(insertRows, { onConflict: 'vacancy_id,tag' })

        if (upsertErr) {
          errors.push(`Upsert error: ${upsertErr.message}`)
        } else {
          upserted_rows += insertRows.length
        }
      }

      processed += batch.length
    } catch (err) {
      errors.push(`Batch error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { processed, skipped_closed, upserted_rows, errors }
}
