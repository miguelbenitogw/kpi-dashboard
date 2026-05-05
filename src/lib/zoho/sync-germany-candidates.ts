import { fetchCandidates, fetchAssociatedJobOpeningsForCandidate, zohoFetch } from './client'
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
