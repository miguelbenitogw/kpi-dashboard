import { fetchCandidates, fetchAssociatedJobOpeningsForCandidate, fetchAllCandidatesByJobOpening, zohoFetch } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface SyncGermanyResult {
  total_candidates: number
  tags_updated: number
  history_updated: number
  history_skipped: number
  errors: string[]
}

export interface EnrichRecordIdResult {
  total_without_record_id: number
  enriched: number
  not_found: number
  errors: string[]
}

export interface SyncNotesResult {
  total_candidates_with_record_id: number
  notes_upserted: number
  errors: string[]
}

interface ZohoListResponse<T> {
  data: T[]
  info?: { more_records: boolean }
}

interface GermanyCandidate {
  id: number
  zoho_candidate_id: string
  zoho_history: ZohoHistoryEntry[] | null
}

interface ZohoHistoryEntry {
  job_opening_id: string
  title: string
  status: string | null
}

const HISTORY_BATCH_SIZE = 20
const HISTORY_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

/**
 * Syncs Zoho tags and job history for Germany candidates.
 *
 * Step 1 — Tags: fetches all Zoho candidates (with Associated_Tags),
 * filters those matching germany_candidates_kpi.zoho_candidate_id,
 * and updates tags in batch.
 *
 * Step 2 — History: for each Germany candidate, calls
 * /Candidates/{id}/Associate_Job_Openings and stores the result
 * as zoho_history JSONB. Batches of 20 with 300ms delay to
 * respect Zoho rate limits.
 */
export async function syncGermanyCandidateData(): Promise<SyncGermanyResult> {
  const errors: string[] = []

  // ─── Fetch Germany candidate IDs from Supabase ───────────────────────────
  const { data: germanyRows, error: fetchError } = await supabaseAdmin
    .from('germany_candidates_kpi')
    .select('id, zoho_candidate_id, zoho_history')
    .not('zoho_candidate_id', 'is', null)

  if (fetchError) {
    throw new Error(`Failed to fetch germany_candidates_kpi: ${fetchError.message}`)
  }

  const candidates = (germanyRows ?? []) as GermanyCandidate[]
  const total_candidates = candidates.length

  // Build a Set for O(1) lookups
  const germanyIdSet = new Set(candidates.map((c) => c.zoho_candidate_id))

  // ─── STEP 1: Tags ─────────────────────────────────────────────────────────
  console.log(`[sync-germany] Fetching all Zoho candidates for tags...`)
  const zohoRecords = await fetchCandidates()
  console.log(`[sync-germany] Zoho returned ${zohoRecords.length} candidates`)

  // Build map: zoho_candidate_id → tags[]
  const tagsMap = new Map<string, string[]>()
  for (const record of zohoRecords) {
    const candidateId = String(record.Candidate_ID ?? '')
    if (!candidateId || !germanyIdSet.has(candidateId)) continue

    const rawTags = record.Associated_Tags as
      | Array<string | { name: string }>
      | null
      | undefined
    const tags = (rawTags ?? [])
      .map((t) => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
      .filter(Boolean)

    tagsMap.set(candidateId, tags)
  }

  console.log(`[sync-germany] Tags found for ${tagsMap.size} Germany candidates`)

  // Update tags with individual updates (not upsert — avoids NOT NULL constraint on nombre)
  let tags_updated = 0
  const tagBatches = chunks(
    candidates.filter((c) => tagsMap.has(c.zoho_candidate_id)),
    50
  )

  for (const batch of tagBatches) {
    const updatePromises = batch.map((c) =>
      supabaseAdmin
        .from('germany_candidates_kpi')
        .update({ tags: tagsMap.get(c.zoho_candidate_id) ?? [] })
        .eq('id', c.id)
    )

    const results = await Promise.all(updatePromises)
    for (const { error: updateError } of results) {
      if (updateError) {
        errors.push(`Tags update error: ${updateError.message}`)
      } else {
        tags_updated++
      }
    }
  }

  console.log(`[sync-germany] Tags updated: ${tags_updated}`)

  // ─── STEP 2: History ──────────────────────────────────────────────────────
  console.log(`[sync-germany] Fetching job history for ${candidates.length} candidates...`)

  let history_updated = 0
  let history_skipped = 0
  const historyBatches = chunks(candidates, HISTORY_BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < historyBatches.length; batchIdx++) {
    const batch = historyBatches[batchIdx]

    for (const candidate of batch) {
      try {
        const jobOpenings = await fetchAssociatedJobOpeningsForCandidate(
          candidate.zoho_candidate_id
        )

        const newHistory: ZohoHistoryEntry[] = jobOpenings.map((jo) => ({
          job_opening_id: jo.id,
          title: jo.title,
          status: jo.status,
        }))

        // Skip if history hasn't changed (compare by serialized JSON)
        const existingJson = JSON.stringify(candidate.zoho_history ?? [])
        const newJson = JSON.stringify(newHistory)

        if (existingJson === newJson) {
          history_skipped++
          await sleep(HISTORY_DELAY_MS)
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('germany_candidates_kpi')
          .update({
            zoho_history: newHistory,
            zoho_synced_at: new Date().toISOString(),
          })
          .eq('id', candidate.id)

        if (updateError) {
          errors.push(
            `History update error for ${candidate.zoho_candidate_id}: ${updateError.message}`
          )
        } else {
          history_updated++
        }
      } catch (err) {
        errors.push(
          `History fetch error for ${candidate.zoho_candidate_id}: ${err instanceof Error ? err.message : String(err)}`
        )
      }

      await sleep(HISTORY_DELAY_MS)
    }

    const done = Math.min((batchIdx + 1) * HISTORY_BATCH_SIZE, candidates.length)
    console.log(
      `[sync-germany] History progress: ${done}/${candidates.length} (updated=${history_updated}, skipped=${history_skipped}, errors=${errors.length})`
    )
  }

  return {
    total_candidates,
    tags_updated,
    history_updated,
    history_skipped,
    errors,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 3 — Enrich germany_candidates_kpi with zoho_record_id (long ID)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For every Germany candidate that has zoho_candidate_id (short, e.g. "51517")
 * but no zoho_record_id (long Zoho internal ID), this function:
 *   1. Searches Zoho via GET /Candidates/search?criteria=(Candidate_ID:equals:{id})
 *   2. Writes the long record ID back to germany_candidates_kpi.zoho_record_id
 *
 * Processes in batches of 20 with 300ms between calls to respect rate limits.
 */
export async function enrichGermanyCandidatesWithRecordId(): Promise<EnrichRecordIdResult> {
  const errors: string[] = []
  let enriched = 0
  let not_found = 0

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('germany_candidates_kpi')
    .select('id, zoho_candidate_id')
    .is('zoho_record_id', null)
    .not('zoho_candidate_id', 'is', null)

  if (fetchError) {
    throw new Error(`Failed to fetch germany_candidates_kpi: ${fetchError.message}`)
  }

  const candidates = (rows ?? []) as Array<{ id: number; zoho_candidate_id: string }>
  const total_without_record_id = candidates.length

  console.log(`[enrich-record-id] ${total_without_record_id} candidates need zoho_record_id`)

  const batches = chunks(candidates, HISTORY_BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]

    for (const candidate of batch) {
      try {
        const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
          '/Candidates/search',
          {
            criteria: `(Candidate_ID:equals:${candidate.zoho_candidate_id})`,
            fields: 'id,Full_Name,Candidate_ID',
          }
        )

        const records = response.data ?? []

        if (records.length === 0) {
          console.warn(
            `[enrich-record-id] Not found in Zoho: zoho_candidate_id=${candidate.zoho_candidate_id}`
          )
          not_found++
          await sleep(HISTORY_DELAY_MS)
          continue
        }

        const record = records[0]
        const zoho_record_id = String(record.id ?? '')

        if (!zoho_record_id) {
          errors.push(`No id field in Zoho response for candidate_id=${candidate.zoho_candidate_id}`)
          await sleep(HISTORY_DELAY_MS)
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('germany_candidates_kpi')
          .update({ zoho_record_id })
          .eq('id', candidate.id)

        if (updateError) {
          errors.push(
            `Update error for ${candidate.zoho_candidate_id}: ${updateError.message}`
          )
        } else {
          enriched++
        }
      } catch (err) {
        errors.push(
          `Search error for ${candidate.zoho_candidate_id}: ${err instanceof Error ? err.message : String(err)}`
        )
      }

      await sleep(HISTORY_DELAY_MS)
    }

    const done = Math.min((batchIdx + 1) * HISTORY_BATCH_SIZE, total_without_record_id)
    console.log(
      `[enrich-record-id] Progress: ${done}/${total_without_record_id} (enriched=${enriched}, not_found=${not_found}, errors=${errors.length})`
    )
  }

  return { total_without_record_id, enriched, not_found, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 4 — Sync notes for Germany candidates into germany_candidate_notes_kpi
// ─────────────────────────────────────────────────────────────────────────────

interface ZohoNote {
  id: string
  Note_Title?: string
  Note_Content?: string
  Note_Owner?: { name?: string }
  Created_By?: { name?: string }
  Created_Time?: string
  Modified_Time?: string
  Parent_Id?: { name?: string }
}

/**
 * For every Germany candidate that has a zoho_record_id, fetches all notes
 * from GET /Candidates/{zoho_record_id}/Notes (with pagination) and upserts
 * them into germany_candidate_notes_kpi using zoho_note_id as the conflict key.
 *
 * Processes in batches of 20 with 300ms between calls.
 */
export async function syncGermanyCandidateNotes(): Promise<SyncNotesResult> {
  const errors: string[] = []
  let notes_upserted = 0

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('germany_candidates_kpi')
    .select('id, zoho_candidate_id, zoho_record_id')
    .not('zoho_record_id', 'is', null)

  if (fetchError) {
    throw new Error(`Failed to fetch germany_candidates_kpi: ${fetchError.message}`)
  }

  const candidates = (rows ?? []) as Array<{
    id: number
    zoho_candidate_id: string
    zoho_record_id: string
  }>

  const total_candidates_with_record_id = candidates.length
  console.log(`[sync-notes] ${total_candidates_with_record_id} candidates with zoho_record_id`)

  const batches = chunks(candidates, HISTORY_BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]

    for (const candidate of batch) {
      try {
        // Paginate notes for this candidate
        const allNotes: ZohoNote[] = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          const response = await zohoFetch<ZohoListResponse<ZohoNote>>(
            `/Candidates/${candidate.zoho_record_id}/Notes`,
            { per_page: '200', page: String(page) }
          )

          const notes = response.data ?? []
          allNotes.push(...notes)

          hasMore = response.info?.more_records ?? false
          page++

          if (hasMore) {
            await sleep(HISTORY_DELAY_MS)
          }
        }

        if (allNotes.length === 0) {
          await sleep(HISTORY_DELAY_MS)
          continue
        }

        // Build upsert rows
        const upsertRows = allNotes.map((note) => ({
          zoho_record_id: candidate.zoho_record_id,
          zoho_note_id: note.id,
          candidate_name: note.Parent_Id?.name ?? null,
          zoho_candidate_id: candidate.zoho_candidate_id,
          note_title: note.Note_Title ?? null,
          note_content: note.Note_Content ?? null,
          note_owner: note.Note_Owner?.name ?? null,
          created_by: note.Created_By?.name ?? null,
          created_at: note.Created_Time ?? null,
          modified_at: note.Modified_Time ?? null,
          synced_at: new Date().toISOString(),
        }))

        const { error: upsertError } = await supabaseAdmin
          .from('germany_candidate_notes_kpi')
          .upsert(upsertRows, { onConflict: 'zoho_note_id' })

        if (upsertError) {
          errors.push(
            `Upsert error for record_id=${candidate.zoho_record_id}: ${upsertError.message}`
          )
        } else {
          notes_upserted += upsertRows.length
        }
      } catch (err) {
        errors.push(
          `Notes fetch error for record_id=${candidate.zoho_record_id}: ${err instanceof Error ? err.message : String(err)}`
        )
      }

      await sleep(HISTORY_DELAY_MS)
    }

    const done = Math.min((batchIdx + 1) * HISTORY_BATCH_SIZE, total_candidates_with_record_id)
    console.log(
      `[sync-notes] Progress: ${done}/${total_candidates_with_record_id} (notes_upserted=${notes_upserted}, errors=${errors.length})`
    )
  }

  return { total_candidates_with_record_id, notes_upserted, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// VACANCY-FIRST HISTORY SYNC — germany_candidate_history_kpi
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncGermanyCandidateHistoryResult {
  vacancies_processed: number
  associations_upserted: number
  stage_changes_detected: number
  errors: number
}

/**
 * Vacancy-first sync of Germany candidate history.
 *
 * Strategy (mirrors Norway's atraccion history cron):
 *   1. Load all Germany candidates from germany_candidates_kpi → Set for O(1) lookup
 *   2. Fetch Germany-relevant vacancies from job_openings_kpi
 *      (title keywords: Alemania, Infantil, Educación Infantil, Maestr, Técnico)
 *      excluding the historical catch-all vacancy 179458000025917049
 *   3. For each vacancy, call fetchAllCandidatesByJobOpening() (paginated)
 *   4. Filter candidates by Germany Set (Candidate_ID match)
 *   5. Compare vs. existing germany_candidate_history_kpi to detect status changes
 *   6. Insert stage changes into germany_stage_history_kpi
 *   7. Upsert current state into germany_candidate_history_kpi
 *   8. Wait 300ms between vacancies (rate limiting)
 */
export async function syncGermanyCandidateHistory(): Promise<SyncGermanyCandidateHistoryResult> {
  const INTER_VACANCY_DELAY_MS = 300
  const EXCLUDED_VACANCY_ID = '179458000025917049'

  let associations_upserted = 0
  let stage_changes_detected = 0
  let errors = 0

  // ── 1. Load all Germany candidates ──────────────────────────────────────
  const { data: germanyRows, error: germanyErr } = await supabaseAdmin
    .from('germany_candidates_kpi')
    .select('zoho_candidate_id, nombre')
    .not('zoho_candidate_id', 'is', null)

  if (germanyErr) {
    throw new Error(`Failed to fetch germany_candidates_kpi: ${germanyErr.message}`)
  }

  // Build Set<zoho_candidate_id> for O(1) lookup
  // Also build Map<zoho_candidate_id, name> for enriching history rows
  const germanyIdSet = new Set<string>()
  const germanyNameMap = new Map<string, string | null>()
  for (const row of germanyRows ?? []) {
    if (row.zoho_candidate_id) {
      germanyIdSet.add(row.zoho_candidate_id)
      germanyNameMap.set(row.zoho_candidate_id, (row as Record<string, unknown>).nombre as string | null ?? null)
    }
  }

  console.log(`[sync-germany-history] Germany candidates loaded: ${germanyIdSet.size}`)

  // ── 2. Fetch Germany-relevant vacancies ──────────────────────────────────
  const { data: vacanciesRaw, error: vacanciesErr } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .neq('id', EXCLUDED_VACANCY_ID)
    .or(
      'title.ilike.%Alemania%,' +
      'title.ilike.%Educación Infantil%,' +
      'title.ilike.%Educacion Infantil%,' +
      'title.ilike.%Infantil%,' +
      'title.ilike.%Maestr%,' +
      'title.ilike.%Técnico%,' +
      'title.ilike.%Tecnico%'
    )
    .order('title', { ascending: true })

  if (vacanciesErr) {
    throw new Error(`Failed to fetch Germany vacancies: ${vacanciesErr.message}`)
  }

  const vacancies = (vacanciesRaw ?? []) as Array<{ id: string; title: string }>
  console.log(`[sync-germany-history] Vacancies to process: ${vacancies.length}`)

  const fetchedAt = new Date().toISOString()

  // ── 3–7. Per-vacancy loop ─────────────────────────────────────────────────
  for (let i = 0; i < vacancies.length; i++) {
    const vacancy = vacancies[i]

    let zohoAssociations: Record<string, unknown>[]

    try {
      zohoAssociations = await fetchAllCandidatesByJobOpening(vacancy.id)
    } catch (err) {
      console.error(
        `[sync-germany-history] Error fetching vacancy ${vacancy.id} (${vacancy.title}):`,
        err instanceof Error ? err.message : err
      )
      errors++
      if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    if (zohoAssociations.length === 0) {
      if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    // Filter to Germany candidates only
    const germanyMatches = zohoAssociations.filter((c) => {
      const candidateId = String(c.Candidate_ID ?? c.id ?? '')
      return candidateId && germanyIdSet.has(candidateId)
    })

    if (germanyMatches.length === 0) {
      if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    console.log(
      `[sync-germany-history] Vacancy "${vacancy.title}": ${zohoAssociations.length} total, ${germanyMatches.length} Germany matches`
    )

    // Fetch existing history rows for this vacancy in one batch query
    const candidateIdsInVacancy = germanyMatches
      .map((c) => String(c.Candidate_ID ?? c.id ?? ''))
      .filter(Boolean)

    const { data: existingRows } = await supabaseAdmin
      .from('germany_candidate_history_kpi')
      .select('zoho_candidate_id, candidate_status')
      .eq('job_opening_id', vacancy.id)
      .in('zoho_candidate_id', candidateIdsInVacancy)

    // Build Map<zoho_candidate_id, existing_status> for this vacancy
    const existingStatusMap = new Map<string, string | null>()
    for (const row of existingRows ?? []) {
      existingStatusMap.set(row.zoho_candidate_id, row.candidate_status)
    }

    // Process each Germany match
    for (const zohoCandidate of germanyMatches) {
      const candidateId = String(zohoCandidate.Candidate_ID ?? zohoCandidate.id ?? '')
      if (!candidateId) continue

      const newStatus =
        (zohoCandidate.Candidate_Status as string) ??
        (zohoCandidate.Candidate_Stage as string) ??
        null

      const zohoRecordId = String(zohoCandidate.id ?? '')
      const candidateName =
        (zohoCandidate.Full_Name as string) ?? germanyNameMap.get(candidateId) ?? null

      // Detect status change
      const isNew = !existingStatusMap.has(candidateId)
      const prevStatus = existingStatusMap.get(candidateId) ?? null
      const statusChanged = !isNew && prevStatus !== newStatus

      if ((isNew && newStatus) || statusChanged) {
        // Insert into stage history
        const stageRow = {
          zoho_candidate_id: candidateId,
          job_opening_id: vacancy.id,
          candidate_name: candidateName,
          job_opening_title: vacancy.title,
          from_status: isNew ? null : prevStatus,
          to_status: newStatus ?? '',
          changed_at: fetchedAt,
        }

        const { error: stageErr } = await supabaseAdmin
          .from('germany_stage_history_kpi')
          .upsert(stageRow, {
            onConflict: 'zoho_candidate_id,job_opening_id,from_status,to_status,changed_at',
            ignoreDuplicates: true,
          })

        if (stageErr) {
          console.error(
            `[sync-germany-history] Stage history insert error for ${candidateId}/${vacancy.id}: ${stageErr.message}`
          )
          errors++
        } else {
          stage_changes_detected++
        }
      }

      // Upsert current state into germany_candidate_history_kpi
      const historyRow = {
        zoho_candidate_id: candidateId,
        zoho_record_id: zohoRecordId || null,
        candidate_name: candidateName,
        job_opening_id: vacancy.id,
        job_opening_title: vacancy.title,
        candidate_status: newStatus,
        fetched_at: fetchedAt,
      }

      const { error: upsertErr } = await supabaseAdmin
        .from('germany_candidate_history_kpi')
        .upsert(historyRow, {
          onConflict: 'zoho_candidate_id,job_opening_id',
          ignoreDuplicates: false,
        })

      if (upsertErr) {
        console.error(
          `[sync-germany-history] Upsert error for ${candidateId}/${vacancy.id}: ${upsertErr.message}`
        )
        errors++
      } else {
        associations_upserted++
      }
    }

    if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)

    const done = i + 1
    if (done % 10 === 0 || done === vacancies.length) {
      console.log(
        `[sync-germany-history] Progress: ${done}/${vacancies.length} vacancies ` +
        `(upserted=${associations_upserted}, stage_changes=${stage_changes_detected}, errors=${errors})`
      )
    }
  }

  return {
    vacancies_processed: vacancies.length,
    associations_upserted,
    stage_changes_detected,
    errors,
  }
}
