import { supabaseAdmin } from '../supabase/server'
import { fetchAllCandidatesByJobOpening, fetchAssociatedJobOpeningsForCandidate } from './client'
import { deriveTipoVacante } from '../utils/vacancy-type'

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
 * Syncs Zoho candidate data for active vacancies. Does exactly two things:
 *
 *  1. STATUS CHANGE DETECTION — if a candidate's status in a vacancy changed
 *     since the last run, logs a row to stage_history_kpi (from_status → to_status).
 *
 *  2. CANDIDATE DATA UPDATE — upserts candidate_job_history_kpi for candidates
 *     that already exist in candidates_kpi (the Madre). Never creates rows for
 *     candidates outside the Madre.
 *
 * Safe to re-run: upsert key is (candidate_id, job_opening_id).
 * Never overwrites association_type on existing rows.
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

  // 2. Load all candidate IDs that exist in the Madre (candidates_kpi).
  //    We never create history rows for candidates not in the Madre.
  const { data: madreCandidates, error: madreError } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id')

  if (madreError) {
    errors.push(`Failed to fetch madre candidate IDs: ${madreError.message}`)
    return { vacancies_processed: 0, candidates_synced: 0, status_changes_logged: 0, api_calls: 0, errors }
  }

  const madreCandidateIds = new Set((madreCandidates ?? []).map((c) => c.id))

  // 3. For each vacancy, pull all associated candidates from Zoho
  for (let i = 0; i < vacancies.length; i++) {
    const vacancy: { id: string; title: string | null } = vacancies[i]

    try {
      const zohoRecords = await fetchAllCandidatesByJobOpening(vacancy.id)

      apiCalls += Math.max(1, Math.ceil(zohoRecords.length / 200))

      if (zohoRecords.length === 0) {
        if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
        continue
      }

      // 4. Load existing statuses for this vacancy to detect changes
      const { data: existingRows } = await supabaseAdmin
        .from('candidate_job_history_kpi')
        .select('candidate_id, candidate_status_in_jo')
        .eq('job_opening_id', vacancy.id)

      // Map candidate_id → previous status (null if first time seeing this candidate)
      const prevStatus = new Map(
        (existingRows ?? []).map((r) => [r.candidate_id, r.candidate_status_in_jo as string | null])
      )

      // 5. Transform records — skip any candidate not in the Madre
      // candidates_kpi.id = Candidate_ID (short sequential, e.g. "88082"),
      // NOT the internal Zoho record id (long, e.g. "179458000031006174").
      // Use Candidate_ID for matching; keep internal id in zoho_record_id.
      type RowFull = {
        candidate_id: string
        candidate_name: string | null
        zoho_record_id: string
        job_opening_id: string
        job_opening_title: string | null
        candidate_status_in_jo: string | null
        association_type: 'atraccion'
        fetched_at: string
      }
      const rows: RowFull[] = zohoRecords
        .filter((record) => madreCandidateIds.has(String(record.Candidate_ID ?? record.id)))
        .map((record): RowFull => ({
          candidate_id: String(record.Candidate_ID ?? record.id),
          candidate_name: (record.Full_Name as string) || null,
          zoho_record_id: String(record.id),
          job_opening_id: vacancy.id,
          job_opening_title: vacancy.title ?? null,
          candidate_status_in_jo: (record.Candidate_Status as string) || null,
          association_type: 'atraccion',
          fetched_at: fetchedAt,
        }))

      // 6. Build status-change entries for stage_history_kpi
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

      // 7. Upsert candidate rows in batches
      //    New rows get association_type = 'atraccion'.
      //    Existing rows: only update status, name, title and fetched_at — never overwrite association_type.
      type RowUpdate = Omit<RowFull, 'association_type'>

      const newRows: RowFull[] = rows.filter((r) => !prevStatus.has(r.candidate_id))
      const updatedRows: RowUpdate[] = rows
        .filter((r) => prevStatus.has(r.candidate_id))
        .map(({ association_type: _at, ...rest }) => rest)

      const allBatches: Array<RowFull[] | RowUpdate[]> = []
      for (let j = 0; j < newRows.length; j += UPSERT_BATCH_SIZE) allBatches.push(newRows.slice(j, j + UPSERT_BATCH_SIZE))
      for (let j = 0; j < updatedRows.length; j += UPSERT_BATCH_SIZE) allBatches.push(updatedRows.slice(j, j + UPSERT_BATCH_SIZE))

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

export interface SyncAtraccionHistoryResult {
  candidate_id: string
  inserted: number
  errors: string[]
}

/**
 * Fetches the full Zoho job history for a single promo candidate and upserts
 * their atraccion associations into candidate_job_history_kpi.
 *
 * Call this when a candidate is added to a promotion so their pre-formacion
 * atraccion history is captured immediately, without waiting for the backfill.
 *
 * This function is intentionally NOT called automatically — wire it in explicitly
 * from whatever flow assigns a candidate to a promo.
 *
 * @param candidateId — the candidate's ID in candidates_kpi (same as Zoho record ID)
 */
export async function syncAtraccionHistoryForPromoCandidate(
  candidateId: string
): Promise<SyncAtraccionHistoryResult> {
  const errors: string[] = []
  let inserted = 0

  // Fetch candidate details for name
  const { data: candidate } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name')
    .eq('id', candidateId)
    .single()

  // Fetch job openings from Zoho for this candidate
  let zohoJobOpenings: Awaited<ReturnType<typeof fetchAssociatedJobOpeningsForCandidate>>
  try {
    zohoJobOpenings = await fetchAssociatedJobOpeningsForCandidate(candidateId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Zoho fetch failed: ${msg}`)
    return { candidate_id: candidateId, inserted, errors }
  }

  if (zohoJobOpenings.length === 0) {
    return { candidate_id: candidateId, inserted, errors }
  }

  // Pre-load known vacancies for tipo_vacante resolution
  const vacancyIds = zohoJobOpenings.map((jo) => jo.id)
  const { data: knownVacancies } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .in('id', vacancyIds)

  const vacancyMap = new Map(
    (knownVacancies ?? []).map((v) => {
      const raw = v as unknown as { id: string; title: string; tipo_vacante?: string | null }
      return [
        raw.id,
        {
          title: raw.title,
          tipoVacante: raw.tipo_vacante ?? deriveTipoVacante(raw.title),
        },
      ]
    })
  )

  const fetchedAt = new Date().toISOString()

  for (const jo of zohoJobOpenings) {
    const knownVacancy = vacancyMap.get(jo.id)
    const jobOpeningTitle = knownVacancy?.title ?? jo.title
    const tipoVacante = knownVacancy?.tipoVacante ?? deriveTipoVacante(jo.title)

    const row = {
      candidate_id: candidateId,
      candidate_name: candidate?.full_name ?? null,
      zoho_record_id: candidateId,
      job_opening_id: jo.id,
      job_opening_title: jobOpeningTitle,
      association_type: tipoVacante,
      candidate_status_in_jo: jo.status ?? null,
      fetched_at: fetchedAt,
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('candidate_job_history_kpi')
      .upsert(row, {
        onConflict: 'candidate_id,job_opening_id',
        ignoreDuplicates: false,
      })

    if (upsertErr) {
      errors.push(`Upsert failed for vacancy ${jo.id}: ${upsertErr.message}`)
    } else {
      inserted++
    }
  }

  return { candidate_id: candidateId, inserted, errors }
}
