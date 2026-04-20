import { supabaseAdmin } from '../supabase/server'
import { fetchAllCandidatesByJobOpening } from './client'

const UPSERT_BATCH_SIZE = 100
/** Milliseconds to wait between per-vacancy Zoho API calls to stay well under rate limits */
const INTER_VACANCY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface SyncCandidatesResult {
  vacancies_processed: number
  candidates_synced: number
  api_calls: number
  errors: string[]
}

/**
 * For each active vacancy (es_proceso_atraccion_actual = true) fetch all
 * associated candidates from Zoho Recruit via the /Job_Openings/{id}/associate
 * endpoint and upsert them into candidate_job_history_kpi.
 *
 * The upsert key is (candidate_id, job_opening_id) so re-running is safe —
 * it only updates candidate_status_in_jo and fetched_at when the row already
 * exists.
 */
export async function syncCandidatesForActiveVacancies(): Promise<SyncCandidatesResult> {
  const errors: string[] = []
  let candidatesSynced = 0
  let apiCalls = 0

  // 1. Fetch active vacancy IDs from Supabase
  const { data: vacancies, error: vacanciesError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)

  if (vacanciesError) {
    errors.push(`Failed to fetch active vacancies: ${vacanciesError.message}`)
    return { vacancies_processed: 0, candidates_synced: 0, api_calls: 0, errors }
  }

  if (!vacancies || vacancies.length === 0) {
    return { vacancies_processed: 0, candidates_synced: 0, api_calls: 0, errors }
  }

  const fetchedAt = new Date().toISOString()

  // 2. For each vacancy, pull all associated candidates from Zoho
  for (let i = 0; i < vacancies.length; i++) {
    const vacancy = vacancies[i]

    try {
      // fetchAllCandidatesByJobOpening handles pagination internally and
      // uses /Job_Openings/{id}/associate (v2 "Get Associated Records")
      const zohoRecords = await fetchAllCandidatesByJobOpening(vacancy.id)

      // Each page call = 1 API call; approximate from record count
      apiCalls += Math.max(1, Math.ceil(zohoRecords.length / 200))

      if (zohoRecords.length === 0) {
        // Add delay even when empty to avoid bursting the rate limit
        if (i < vacancies.length - 1) {
          await sleep(INTER_VACANCY_DELAY_MS)
        }
        continue
      }

      // 3. Transform Zoho associate records into candidate_job_history_kpi rows
      //
      // The /associate endpoint returns records with shape:
      //   { id, Full_Name, Candidate_Status, ... }
      //
      // The "id" here is the candidate's Zoho record ID.
      // "Candidate_Status" is the candidate's status WITHIN this job opening.
      const rows = zohoRecords.map((record) => ({
        candidate_id: String(record.id),
        candidate_name: (record.Full_Name as string) || null,
        zoho_record_id: String(record.id),
        job_opening_id: vacancy.id,
        job_opening_title: vacancy.title ?? null,
        candidate_status_in_jo: (record.Candidate_Status as string) || null,
        association_type: 'atraccion' as const,
        fetched_at: fetchedAt,
      }))

      // 4. Upsert in batches
      for (let j = 0; j < rows.length; j += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(j, j + UPSERT_BATCH_SIZE)

        const { error: upsertError } = await supabaseAdmin
          .from('candidate_job_history_kpi')
          .upsert(batch, {
            onConflict: 'candidate_id,job_opening_id',
            ignoreDuplicates: false, // update existing rows (refreshes status + fetched_at)
          })

        if (upsertError) {
          errors.push(
            `Upsert error for vacancy ${vacancy.id} batch ${Math.floor(j / UPSERT_BATCH_SIZE)}: ${upsertError.message}`
          )
        } else {
          candidatesSynced += batch.length
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to sync vacancy ${vacancy.id} (${vacancy.title ?? 'unknown'}): ${message}`)
    }

    // Rate-limit guard: pause between vacancies (except after the last one)
    if (i < vacancies.length - 1) {
      await sleep(INTER_VACANCY_DELAY_MS)
    }
  }

  return {
    vacancies_processed: vacancies.length,
    candidates_synced: candidatesSynced,
    api_calls: apiCalls,
    errors,
  }
}
