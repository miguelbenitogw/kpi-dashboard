import { fetchCandidates, fetchAssociatedJobOpeningsForCandidate } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface SyncGermanyResult {
  total_candidates: number
  tags_updated: number
  history_updated: number
  history_skipped: number
  errors: string[]
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
