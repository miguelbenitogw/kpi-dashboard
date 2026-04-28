import { supabaseAdmin } from '../supabase/server'
import { fetchAllCandidatesByJobOpening } from './client'

const UPSERT_BATCH_SIZE = 100
/** Milliseconds to wait between per-vacancy Zoho API calls to stay well under rate limits */
const INTER_VACANCY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Extract tags from a Zoho record — handles both string[] and {name,id}[] shapes */
function extractTags(record: Record<string, unknown>): string[] {
  const raw = record.Associated_Tags
  if (!raw || !Array.isArray(raw)) return []
  return (raw as Array<string | { name: string }>)
    .map((t) => (typeof t === 'string' ? t : (t?.name ?? '')))
    .filter(Boolean)
}

export interface SyncCandidatesResult {
  vacancies_processed: number
  candidates_synced: number
  status_changes_logged: number
  api_calls: number
  errors: string[]
}

/**
 * For each active vacancy (es_proceso_atraccion_actual = true) fetch all
 * associated candidates from Zoho Recruit via the /Job_Openings/{id}/associate
 * endpoint and upsert them into candidate_job_history_kpi.
 *
 * Also:
 *  - Captures candidate tags (Associated_Tags) if present in the response
 *  - Detects status changes and logs them into stage_history_kpi
 *
 * The upsert key is (candidate_id, job_opening_id) so re-running is safe.
 */
export async function syncCandidatesForActiveVacancies(): Promise<SyncCandidatesResult> {
  const errors: string[] = []
  let candidatesSynced = 0
  let statusChangesLogged = 0
  let apiCalls = 0

  // 1. Fetch active vacancy IDs from Supabase
  const { data: vacancies, error: vacanciesError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)

  if (vacanciesError) {
    errors.push(`Failed to fetch active vacancies: ${vacanciesError.message}`)
    return { vacancies_processed: 0, candidates_synced: 0, status_changes_logged: 0, api_calls: 0, errors }
  }

  if (!vacancies || vacancies.length === 0) {
    return { vacancies_processed: 0, candidates_synced: 0, status_changes_logged: 0, api_calls: 0, errors }
  }

  const fetchedAt = new Date().toISOString()

  // 2. For each vacancy, pull all associated candidates from Zoho
  for (let i = 0; i < vacancies.length; i++) {
    const vacancy = vacancies[i]

    try {
      const zohoRecords = await fetchAllCandidatesByJobOpening(vacancy.id)

      apiCalls += Math.max(1, Math.ceil(zohoRecords.length / 200))

      if (zohoRecords.length === 0) {
        if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
        continue
      }

      // 3. Load existing statuses for this vacancy to detect changes
      const { data: existingRows } = await supabaseAdmin
        .from('candidate_job_history_kpi')
        .select('candidate_id, candidate_status_in_jo')
        .eq('job_opening_id', vacancy.id)

      // Map candidate_id → previous status (null if first time seeing this candidate)
      const prevStatus = new Map(
        (existingRows ?? []).map((r) => [r.candidate_id, r.candidate_status_in_jo as string | null])
      )

      // 4. Transform records
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

      // 5. Build status-change entries for stage_history_kpi
      //    Only log when there WAS a previous status and it's different from the new one
      const statusChanges = rows
        .filter((row) => {
          const prev = prevStatus.get(row.candidate_id)
          return (
            prev !== undefined &&          // candidate existed before
            prev !== null &&               // had a real status
            prev !== row.candidate_status_in_jo && // status changed
            row.candidate_status_in_jo !== null
          )
        })
        .map((row) => ({
          candidate_id: row.candidate_id,
          job_opening_id: vacancy.id,
          from_status: prevStatus.get(row.candidate_id) as string,
          to_status: row.candidate_status_in_jo as string,
          changed_at: fetchedAt,
        }))

      if (statusChanges.length > 0) {
        const { error: historyError } = await supabaseAdmin
          .from('stage_history_kpi')
          .upsert(statusChanges, {
            onConflict: 'candidate_id,job_opening_id,from_status,to_status,changed_at',
            ignoreDuplicates: true,
          })

        if (historyError) {
          errors.push(`stage_history upsert for vacancy ${vacancy.id}: ${historyError.message}`)
        } else {
          statusChangesLogged += statusChanges.length
        }
      }

      // 6. Upsert candidate rows in batches
      //    New rows get association_type = 'atraccion'.
      //    Existing rows: only update status, name, title and fetched_at — never overwrite association_type.
      const newRows = rows.filter((r) => !prevStatus.has(r.candidate_id))
      const existingRows = rows
        .filter((r) => prevStatus.has(r.candidate_id))
        .map(({ association_type: _at, ...rest }) => rest)

      const allBatches: Array<typeof rows[number] | Omit<typeof rows[number], 'association_type'>>[] = []
      for (let j = 0; j < newRows.length; j += UPSERT_BATCH_SIZE) allBatches.push(newRows.slice(j, j + UPSERT_BATCH_SIZE) as any)
      for (let j = 0; j < existingRows.length; j += UPSERT_BATCH_SIZE) allBatches.push(existingRows.slice(j, j + UPSERT_BATCH_SIZE) as any)

      for (let b = 0; b < allBatches.length; b++) {
        const batch = allBatches[b]
        const { error: upsertError } = await supabaseAdmin
          .from('candidate_job_history_kpi')
          .upsert(batch as any, {
            onConflict: 'candidate_id,job_opening_id',
            ignoreDuplicates: false,
          })

        if (upsertError) {
          errors.push(
            `Upsert error for vacancy ${vacancy.id} batch ${b}: ${upsertError.message}`
          )
        } else {
          candidatesSynced += batch.length
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to sync vacancy ${vacancy.id} (${vacancy.title ?? 'unknown'}): ${message}`)
    }

    if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
  }

  return {
    vacancies_processed: vacancies.length,
    candidates_synced: candidatesSynced,
    status_changes_logged: statusChangesLogged,
    api_calls: apiCalls,
    errors,
  }
}
