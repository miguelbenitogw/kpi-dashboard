import { supabaseAdmin } from '@/lib/supabase/server'

export interface SyncVacancyTagsResult {
  processed: number       // vacancies processed
  skipped_closed: number  // closed vacancies already in DB, skipped
  upserted_rows: number   // total tag-count rows written
  errors: string[]
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function syncVacancyTagCounts(options?: {
  onlyActive?: boolean
}): Promise<SyncVacancyTagsResult> {
  const errors: string[] = []
  let processed = 0
  let skipped_closed = 0
  let upserted_rows = 0

  // Step 1: Fetch all vacancies
  const { data: vacancies, error: vacError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, is_active')

  if (vacError || !vacancies) {
    return {
      processed: 0,
      skipped_closed: 0,
      upserted_rows: 0,
      errors: [vacError?.message ?? 'Failed to fetch vacancies'],
    }
  }

  // Step 2: Split into active and closed
  const activeIds = vacancies.filter((v) => v.is_active).map((v) => v.id)
  let closedIds = vacancies.filter((v) => !v.is_active).map((v) => v.id)

  if (options?.onlyActive) {
    closedIds = []
  }

  // Step 3: For closed vacancies, skip those that already have data
  let closedToProcess: string[] = []
  let closedSkippedCount = 0

  if (closedIds.length > 0) {
    const { data: existing, error: existError } = await supabaseAdmin
      .from('vacancy_tag_counts_kpi')
      .select('vacancy_id')
      .in('vacancy_id', closedIds)

    if (existError) {
      errors.push(`Failed to check existing closed vacancy data: ${existError.message}`)
    } else {
      const alreadyProcessed = new Set((existing ?? []).map((r) => r.vacancy_id))
      closedSkippedCount = alreadyProcessed.size
      closedToProcess = closedIds.filter((id) => !alreadyProcessed.has(id))
    }
  }

  skipped_closed = closedSkippedCount

  // Step 4: Combine all vacancies to process
  const toProcess = [...activeIds, ...closedToProcess]

  if (toProcess.length === 0) {
    return { processed, skipped_closed, upserted_rows, errors }
  }

  // Step 5: Delete existing rows for active vacancies
  if (activeIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('vacancy_tag_counts_kpi')
      .delete()
      .in('vacancy_id', activeIds)

    if (deleteError) {
      errors.push(`Failed to delete active vacancy tag counts: ${deleteError.message}`)
    }
  }

  // Step 6: Process in batches of 50
  const batches = chunks(toProcess, 50)

  for (const batch of batches) {
    try {
      // a. Fetch candidate history for this batch
      const { data: historyRows, error: histError } = await supabaseAdmin
        .from('candidate_job_history_kpi')
        .select('job_opening_id, candidate_id')
        .in('job_opening_id', batch)

      if (histError) {
        errors.push(`Failed to fetch candidate history for batch: ${histError.message}`)
        continue
      }

      // b. Collect all unique candidate IDs
      const uniqueCandidateIds = [...new Set((historyRows ?? []).map((r) => r.candidate_id))]

      // c. Skip if no candidates
      if (uniqueCandidateIds.length === 0) {
        processed += batch.length
        continue
      }

      // d. Fetch tags for those candidates
      const { data: candidateRows, error: candError } = await supabaseAdmin
        .from('candidates_kpi')
        .select('id, tags')
        .in('id', uniqueCandidateIds)

      if (candError) {
        errors.push(`Failed to fetch candidate tags for batch: ${candError.message}`)
        continue
      }

      // e. Build candidate → tags map
      const candidateTagMap = new Map<string, string[]>()
      for (const c of candidateRows ?? []) {
        if (c.tags && Array.isArray(c.tags) && c.tags.length > 0) {
          candidateTagMap.set(c.id, c.tags as string[])
        }
      }

      // f. Aggregate tag counts per vacancy
      const vacancyCounts = new Map<string, Map<string, number>>() // vacancy_id → tag → count
      for (const hist of historyRows ?? []) {
        const tags = candidateTagMap.get(hist.candidate_id) ?? []
        for (const tag of tags) {
          if (!vacancyCounts.has(hist.job_opening_id)) vacancyCounts.set(hist.job_opening_id, new Map())
          const tagMap = vacancyCounts.get(hist.job_opening_id)!
          tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
        }
      }

      // g. Build insert rows
      const insertRows: { vacancy_id: string; tag: string; count: number; synced_at: string }[] = []
      const now = new Date().toISOString()

      for (const [vacancyId, tagMap] of vacancyCounts.entries()) {
        for (const [tag, count] of tagMap.entries()) {
          insertRows.push({ vacancy_id: vacancyId, tag, count, synced_at: now })
        }
      }

      // h. Upsert into vacancy_tag_counts_kpi
      if (insertRows.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('vacancy_tag_counts_kpi')
          .upsert(insertRows, { onConflict: 'vacancy_id,tag' })

        if (upsertError) {
          errors.push(`Failed to upsert tag counts for batch: ${upsertError.message}`)
        } else {
          upserted_rows += insertRows.length
        }
      }

      processed += batch.length
    } catch (err) {
      errors.push(`Unexpected error in batch: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { processed, skipped_closed, upserted_rows, errors }
}
