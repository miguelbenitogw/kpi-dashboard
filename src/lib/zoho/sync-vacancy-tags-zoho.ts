import { fetchCandidates, fetchAllCandidatesByJobOpening } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface SyncVacancyTagsZohoResult {
  vacancies_processed: number
  vacancies_skipped_closed: number
  tag_rows_upserted: number
  zoho_api_calls: number
  errors: string[]
}

export async function syncVacancyTagCountsFromZoho(options?: {
  onlyActive?: boolean
  vacancyIds?: string[]
}): Promise<SyncVacancyTagsZohoResult> {
  const errors: string[] = []
  let vacancies_processed = 0
  let vacancies_skipped_closed = 0
  let tag_rows_upserted = 0
  let zoho_api_calls = 0

  // ---- Step 1: Build Zoho candidate tags map --------------------------------
  // Pre-fetch ALL candidates once → Map<zohoId18, tags[]>
  let allCandidates: Record<string, unknown>[]
  try {
    allCandidates = await fetchCandidates()
  } catch (err) {
    return {
      vacancies_processed: 0,
      vacancies_skipped_closed: 0,
      tag_rows_upserted: 0,
      zoho_api_calls: 0,
      errors: [
        `Failed to fetch candidates from Zoho: ${err instanceof Error ? err.message : String(err)}`,
      ],
    }
  }

  // Count API calls consumed by candidate pre-fetch (1 call per 200 records page)
  zoho_api_calls += Math.ceil(allCandidates.length / 200) || 1

  // Build map: 18-digit Zoho ID → normalized tag names
  const candidateTagMap = new Map<string, string[]>()
  for (const record of allCandidates) {
    const zohoId = String(record.id ?? '')
    if (!zohoId) continue

    const rawTags = record.Associated_Tags as
      | Array<string | { name: string }>
      | null
      | undefined

    const tags = (rawTags ?? [])
      .map((t) => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
      .filter(Boolean)

    if (tags.length > 0) {
      candidateTagMap.set(zohoId, tags)
    }
  }

  // ---- Step 2: Get vacancies from DB ----------------------------------------
  let vacancyQuery = supabaseAdmin.from('job_openings_kpi').select('id, is_active')

  if (options?.vacancyIds && options.vacancyIds.length > 0) {
    vacancyQuery = vacancyQuery.in('id', options.vacancyIds)
  }

  const { data: vacancies, error: vacError } = await vacancyQuery

  if (vacError || !vacancies) {
    return {
      vacancies_processed: 0,
      vacancies_skipped_closed: 0,
      tag_rows_upserted: 0,
      zoho_api_calls,
      errors: [vacError?.message ?? 'Failed to fetch vacancies from DB'],
    }
  }

  const activeIds = vacancies.filter((v) => v.is_active).map((v) => v.id)
  let closedIds = vacancies.filter((v) => !v.is_active).map((v) => v.id)

  if (options?.onlyActive) {
    closedIds = []
  }

  // ---- Step 3: Determine which closed vacancies to skip ---------------------
  let closedToProcess: string[] = []

  if (closedIds.length > 0) {
    const { data: existingClosed, error: existError } = await supabaseAdmin
      .from('vacancy_tag_counts_kpi')
      .select('vacancy_id')
      .in('vacancy_id', closedIds)

    if (existError) {
      errors.push(`Failed to check existing closed vacancy data: ${existError.message}`)
      // Fall through: process all closed vacancies to be safe
      closedToProcess = closedIds
    } else {
      const alreadyProcessed = new Set((existingClosed ?? []).map((r) => r.vacancy_id))
      vacancies_skipped_closed = alreadyProcessed.size
      closedToProcess = closedIds.filter((id) => !alreadyProcessed.has(id))
    }
  }

  // ---- Step 4: Delete existing rows for active vacancies --------------------
  if (activeIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('vacancy_tag_counts_kpi')
      .delete()
      .in('vacancy_id', activeIds)

    if (deleteError) {
      errors.push(`Failed to delete active vacancy tag counts: ${deleteError.message}`)
    }
  }

  // ---- Step 5: Process each vacancy -----------------------------------------
  const toProcess = [...activeIds, ...closedToProcess]

  for (const vacancyId of toProcess) {
    try {
      // Fetch all candidates associated to this job opening
      const associatedCandidates = await fetchAllCandidatesByJobOpening(vacancyId)

      // fetchAllCandidatesByJobOpening paginates internally; each page = 1 API call
      // Minimum 1 call even for vacancies with no candidates
      zoho_api_calls += Math.ceil(associatedCandidates.length / 200) || 1

      if (associatedCandidates.length === 0) {
        vacancies_processed++
        // Still respect rate limit before next vacancy
        await new Promise<void>((r) => setTimeout(r, 200))
        continue
      }

      // Aggregate: Map<tag, count>
      const tagCounts = new Map<string, number>()
      for (const candidate of associatedCandidates) {
        const zohoId = String(candidate.id ?? '')
        if (!zohoId) continue

        const tags = candidateTagMap.get(zohoId) ?? []
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        }
      }

      if (tagCounts.size === 0) {
        vacancies_processed++
        await new Promise<void>((r) => setTimeout(r, 200))
        continue
      }

      // Build insert rows
      const now = new Date().toISOString()
      const insertRows = Array.from(tagCounts.entries()).map(([tag, count]) => ({
        vacancy_id: vacancyId,
        tag,
        count,
        synced_at: now,
      }))

      const { error: upsertError } = await supabaseAdmin
        .from('vacancy_tag_counts_kpi')
        .upsert(insertRows, { onConflict: 'vacancy_id,tag' })

      if (upsertError) {
        errors.push(`Failed to upsert tags for vacancy ${vacancyId}: ${upsertError.message}`)
      } else {
        tag_rows_upserted += insertRows.length
      }

      vacancies_processed++
    } catch (err) {
      errors.push(
        `Error processing vacancy ${vacancyId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Rate limit: 200ms between vacancy API calls
    await new Promise<void>((r) => setTimeout(r, 200))
  }

  return {
    vacancies_processed,
    vacancies_skipped_closed,
    tag_rows_upserted,
    zoho_api_calls,
    errors,
  }
}
