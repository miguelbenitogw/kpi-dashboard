import { supabaseAdmin } from '../supabase/server'
import {
  fetchJobOpenings,
  fetchCandidatesByJobOpening,
} from './client'
import {
  transformCandidate,
  transformJobOpening,
  extractStatusChange,
  TERMINAL_STATUSES,
} from './transform'
import { differenceInDays, format, startOfDay } from 'date-fns'
import type { Json } from '../supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  sync_type: 'promo'
  started_at: string
  finished_at: string
  job_openings_synced: number
  promo_openings_found: number
  candidates_synced: number
  status_changes_detected: number
  sla_alerts_created: number
  snapshots_created: number
  api_calls_used: number
  errors: string[]
}

export interface ChunkedSyncResult {
  job_opening_id: string
  job_opening_title: string
  page: number
  candidates_this_chunk: number
  completed: boolean
  errors: string[]
  api_calls_used: number
}

export interface PromoSyncCursor {
  /** Index into the promo job opening IDs array */
  promo_index: number
  /** Current page within the current job opening */
  page: number
  /** Whether the entire promo sync is done */
  completed: boolean
  sync_id: number
  candidates_so_far: number
  started_at: string
  /** The promo job opening IDs to iterate through */
  promo_job_opening_ids: string[]
}

export interface CleanupResult {
  candidates_deleted: number
  sla_alerts_resolved: number
  stage_history_deleted: number
  non_promo_job_openings: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPSERT_BATCH_SIZE = 100
const PROMO_PATTERN = '%promo%'

// ---------------------------------------------------------------------------
// Promo detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns job_opening IDs whose title matches '%promo%' (case-insensitive).
 * Works from the Supabase copy of job_openings (synced first).
 */
async function getPromoJobOpeningIds(): Promise<
  { id: string; title: string }[]
> {
  const { data, error } = await supabaseAdmin
    .from('job_openings')
    .select('id, title')
    .ilike('title', PROMO_PATTERN)

  if (error) throw new Error(`Failed to query promo job openings: ${error.message}`)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Cursor helpers (promo-aware)
// ---------------------------------------------------------------------------

export async function getSyncCursor(): Promise<PromoSyncCursor | null> {
  const { data, error } = await supabaseAdmin
    .from('dashboard_config')
    .select('config_value')
    .eq('config_key', 'sync_cursor')
    .single()

  if (error || !data?.config_value) return null
  const cursor = data.config_value as unknown as PromoSyncCursor
  if (cursor.promo_job_opening_ids == null) return null
  return cursor
}

export async function saveSyncCursor(cursor: PromoSyncCursor): Promise<void> {
  await supabaseAdmin
    .from('dashboard_config')
    .upsert(
      {
        config_key: 'sync_cursor',
        config_value: cursor as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'config_key' }
    )
}

export async function clearSyncCursor(): Promise<void> {
  await supabaseAdmin
    .from('dashboard_config')
    .delete()
    .eq('config_key', 'sync_cursor')
}

// ---------------------------------------------------------------------------
// Sync job openings (all — fast, needed to identify promos)
// ---------------------------------------------------------------------------

export async function syncJobOpenings(): Promise<{
  synced: number
  errors: string[]
  api_calls: number
}> {
  const errors: string[] = []
  let synced = 0

  try {
    const zohoJobOpenings = await fetchJobOpenings()
    const apiCalls = Math.max(1, Math.ceil(zohoJobOpenings.length / 200))

    const jobOpeningRows = zohoJobOpenings.map((jo) => ({
      ...transformJobOpening(jo),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    for (let i = 0; i < jobOpeningRows.length; i += UPSERT_BATCH_SIZE) {
      const batch = jobOpeningRows.slice(i, i + UPSERT_BATCH_SIZE)
      const { error } = await supabaseAdmin
        .from('job_openings')
        .upsert(batch, { onConflict: 'id' })

      if (error) {
        errors.push(`Job openings upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
      } else {
        synced += batch.length
      }
    }

    return { synced, errors, api_calls: apiCalls }
  } catch (err) {
    errors.push(
      `Job openings sync failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return { synced, errors, api_calls: 0 }
  }
}

// ---------------------------------------------------------------------------
// Chunked promo-only candidates sync (Vercel 60s safe)
// ---------------------------------------------------------------------------

/**
 * Syncs candidates that belong to promo job openings only.
 * Processes `maxPages` pages per invocation — call repeatedly until completed.
 */
export async function syncPromoCandidatesChunked(
  maxPages: number = 5
): Promise<ChunkedSyncResult> {
  const errors: string[] = []
  let apiCallsUsed = 0
  let candidatesSynced = 0

  // Get or create cursor
  let cursor = await getSyncCursor()

  if (!cursor || cursor.completed) {
    // Identify promo job openings
    const promos = await getPromoJobOpeningIds()
    if (promos.length === 0) {
      return {
        job_opening_id: '',
        job_opening_title: 'No promos found',
        page: 0,
        candidates_this_chunk: 0,
        completed: true,
        errors: [],
        api_calls_used: 0,
      }
    }

    // Create sync log entry
    const { data: syncLogEntry } = await supabaseAdmin
      .from('sync_log')
      .insert({
        sync_type: 'promo',
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single()

    cursor = {
      promo_index: 0,
      page: 1,
      completed: false,
      sync_id: syncLogEntry?.id ?? 0,
      candidates_so_far: 0,
      started_at: new Date().toISOString(),
      promo_job_opening_ids: promos.map((p) => p.id),
    }
    await saveSyncCursor(cursor)
  }

  let pagesProcessed = 0
  let currentJobOpeningId = cursor.promo_job_opening_ids[cursor.promo_index] ?? ''
  let currentJobOpeningTitle = ''

  while (pagesProcessed < maxPages && !cursor.completed) {
    currentJobOpeningId = cursor.promo_job_opening_ids[cursor.promo_index]
    if (!currentJobOpeningId) {
      cursor.completed = true
      break
    }

    try {
      const result = await fetchCandidatesByJobOpening(currentJobOpeningId, cursor.page)
      apiCallsUsed++

      if (result.candidates.length === 0 && cursor.page === 1) {
        // No candidates for this job opening — move to next
        cursor.promo_index++
        cursor.page = 1
        if (cursor.promo_index >= cursor.promo_job_opening_ids.length) {
          cursor.completed = true
        }
        continue
      }

      if (result.candidates.length > 0) {
        // Attach job_opening_id to each candidate before processing
        const enrichedCandidates = result.candidates.map((c) => ({
          ...c,
          _promo_job_opening_id: currentJobOpeningId,
        }))

        const processResult = await processCandidatesBatch(
          enrichedCandidates,
          currentJobOpeningId
        )
        candidatesSynced += processResult.synced
        if (processResult.errors.length > 0) {
          errors.push(...processResult.errors)
        }
      }

      pagesProcessed++

      if (!result.more_records) {
        // Done with this job opening — move to next
        cursor.promo_index++
        cursor.page = 1
        if (cursor.promo_index >= cursor.promo_job_opening_ids.length) {
          cursor.completed = true
        }
      } else {
        cursor.page++
      }
    } catch (err) {
      errors.push(
        `Job ${currentJobOpeningId} page ${cursor.page} failed: ${err instanceof Error ? err.message : String(err)}`
      )
      break
    }
  }

  // Persist cursor
  cursor.candidates_so_far += candidatesSynced
  await saveSyncCursor(cursor)

  // Get title for response
  if (currentJobOpeningId) {
    const { data: joData } = await supabaseAdmin
      .from('job_openings')
      .select('title')
      .eq('id', currentJobOpeningId)
      .single()
    currentJobOpeningTitle = joData?.title ?? currentJobOpeningId
  }

  // If completed, run post-processing and update sync log
  if (cursor.completed) {
    try {
      await runPostProcessing(errors)
    } catch (err) {
      errors.push(
        `Post-processing failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    if (cursor.sync_id) {
      const syncStatus = errors.length === 0 ? 'success' : 'partial'
      await supabaseAdmin
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          records_processed: cursor.candidates_so_far,
          api_calls_used: apiCallsUsed,
          status: syncStatus,
          error_message: errors.length > 0 ? errors.join(' | ') : null,
        })
        .eq('id', cursor.sync_id)
    }
  }

  return {
    job_opening_id: currentJobOpeningId,
    job_opening_title: currentJobOpeningTitle,
    page: cursor.page,
    candidates_this_chunk: candidatesSynced,
    completed: cursor.completed,
    errors,
    api_calls_used: apiCallsUsed,
  }
}

// ---------------------------------------------------------------------------
// Full promo sync (single invocation — for small datasets ~75 candidates)
// ---------------------------------------------------------------------------

export async function runPromoSync(): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const errors: string[] = []
  let apiCallsUsed = 0
  let jobOpeningsSynced = 0
  let candidatesSynced = 0
  let statusChangesDetected = 0
  let slaAlertsCreated = 0
  let snapshotsCreated = 0

  // Log sync start
  const { data: syncLogEntry, error: logError } = await supabaseAdmin
    .from('sync_log')
    .insert({
      sync_type: 'promo',
      started_at: startedAt,
      status: 'running',
    })
    .select('id')
    .single()

  if (logError) {
    errors.push(`Failed to create sync_log entry: ${logError.message}`)
  }

  const syncLogId = syncLogEntry?.id

  try {
    // Step 1: Sync ALL job openings (to identify promos)
    try {
      const joResult = await syncJobOpenings()
      jobOpeningsSynced = joResult.synced
      apiCallsUsed += joResult.api_calls
      if (joResult.errors.length > 0) errors.push(...joResult.errors)
    } catch (err) {
      errors.push(
        `Job openings sync failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Step 2: Identify promo job openings
    const promos = await getPromoJobOpeningIds()
    const promoIds = promos.map((p) => p.id)

    if (promoIds.length === 0) {
      errors.push('No promo job openings found — nothing to sync')
    }

    // Step 3: Fetch and process candidates per promo job opening
    if (promoIds.length > 0) {
      for (const promoId of promoIds) {
        try {
          let page = 1
          let hasMore = true

          while (hasMore) {
            const result = await fetchCandidatesByJobOpening(promoId, page)
            apiCallsUsed++

            if (result.candidates.length > 0) {
              const processResult = await processCandidatesBatch(
                result.candidates,
                promoId
              )
              candidatesSynced += processResult.synced
              statusChangesDetected += processResult.statusChanges
              if (processResult.errors.length > 0) {
                errors.push(...processResult.errors)
              }
            }

            hasMore = result.more_records
            page++
          }
        } catch (err) {
          errors.push(
            `Candidates sync for promo ${promoId} failed: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }
    }

    // Step 4: Post-processing (only for promo candidates)
    try {
      await calculateCandidateDays()
    } catch (err) {
      errors.push(
        `Calculate candidate days failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    try {
      await updateJobOpeningStats()
    } catch (err) {
      errors.push(
        `Update job opening stats failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    try {
      snapshotsCreated = await createDailySnapshot()
    } catch (err) {
      errors.push(
        `Daily snapshot failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    try {
      slaAlertsCreated = await recalculateSlaAlerts()
    } catch (err) {
      errors.push(
        `SLA alerts recalculation failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Step 5: Log completion
    const finishedAt = new Date().toISOString()
    const syncStatus = errors.length === 0 ? 'success' : 'partial'

    if (syncLogId) {
      await supabaseAdmin
        .from('sync_log')
        .update({
          finished_at: finishedAt,
          records_processed: candidatesSynced + jobOpeningsSynced,
          api_calls_used: apiCallsUsed,
          status: syncStatus,
          error_message: errors.length > 0 ? errors.join(' | ') : null,
        })
        .eq('id', syncLogId)
    }

    return {
      sync_type: 'promo',
      started_at: startedAt,
      finished_at: finishedAt,
      job_openings_synced: jobOpeningsSynced,
      promo_openings_found: promoIds.length,
      candidates_synced: candidatesSynced,
      status_changes_detected: statusChangesDetected,
      sla_alerts_created: slaAlertsCreated,
      snapshots_created: snapshotsCreated,
      api_calls_used: apiCallsUsed,
      errors,
    }
  } catch (err) {
    const finishedAt = new Date().toISOString()
    const fatalError = err instanceof Error ? err.message : String(err)
    errors.push(`Fatal: ${fatalError}`)

    if (syncLogId) {
      await supabaseAdmin
        .from('sync_log')
        .update({
          finished_at: finishedAt,
          records_processed: candidatesSynced + jobOpeningsSynced,
          api_calls_used: apiCallsUsed,
          status: 'error',
          error_message: errors.join(' | '),
        })
        .eq('id', syncLogId)
    }

    return {
      sync_type: 'promo',
      started_at: startedAt,
      finished_at: finishedAt,
      job_openings_synced: jobOpeningsSynced,
      promo_openings_found: 0,
      candidates_synced: candidatesSynced,
      status_changes_detected: statusChangesDetected,
      sla_alerts_created: slaAlertsCreated,
      snapshots_created: snapshotsCreated,
      api_calls_used: apiCallsUsed,
      errors,
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup: remove non-promo candidates from Supabase
// ---------------------------------------------------------------------------

export async function cleanupNonPromoCandidates(): Promise<CleanupResult> {
  const errors: string[] = []
  let candidatesDeleted = 0
  let slaAlertsResolved = 0
  let stageHistoryDeleted = 0
  let nonPromoJobOpenings = 0

  try {
    // Step 1: Get promo job opening IDs
    const promos = await getPromoJobOpeningIds()
    const promoIds = promos.map((p) => p.id)

    if (promoIds.length === 0) {
      errors.push('No promo job openings found — aborting cleanup to avoid deleting everything')
      return { candidates_deleted: 0, sla_alerts_resolved: 0, stage_history_deleted: 0, non_promo_job_openings: 0, errors }
    }

    // Step 2: Find non-promo candidates
    // Get ALL candidate IDs, then filter out promo ones
    // This is safer than complex PostgREST filters
    const { data: allCandidates, error: fetchAllError } = await supabaseAdmin
      .from('candidates')
      .select('id, job_opening_id')

    if (fetchAllError) throw new Error(`Failed to fetch candidates: ${fetchAllError.message}`)

    const promoIdSet = new Set(promoIds)
    const nonPromoCandidates = (allCandidates ?? []).filter(
      (c) => !c.job_opening_id || !promoIdSet.has(c.job_opening_id)
    )

    if (nonPromoCandidates.length === 0) {
      return { candidates_deleted: 0, sla_alerts_resolved: 0, stage_history_deleted: 0, non_promo_job_openings: 0, errors }
    }

    const nonPromoIds = nonPromoCandidates.map((c) => c.id)

    // Step 3: Resolve SLA alerts for these candidates
    for (let i = 0; i < nonPromoIds.length; i += UPSERT_BATCH_SIZE) {
      const batch = nonPromoIds.slice(i, i + UPSERT_BATCH_SIZE)
      const { error } = await supabaseAdmin
        .from('sla_alerts')
        .update({ resolved_at: new Date().toISOString() })
        .in('candidate_id', batch)
        .is('resolved_at', null)

      if (error) {
        errors.push(`SLA alerts resolve batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
      } else {
        slaAlertsResolved += batch.length
      }
    }

    // Step 4: Delete stage history for these candidates
    for (let i = 0; i < nonPromoIds.length; i += UPSERT_BATCH_SIZE) {
      const batch = nonPromoIds.slice(i, i + UPSERT_BATCH_SIZE)
      const { error } = await supabaseAdmin
        .from('stage_history')
        .delete()
        .in('candidate_id', batch)

      if (error) {
        errors.push(`Stage history delete batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
      } else {
        stageHistoryDeleted += batch.length
      }
    }

    // Step 5: Delete the non-promo candidates
    for (let i = 0; i < nonPromoIds.length; i += UPSERT_BATCH_SIZE) {
      const batch = nonPromoIds.slice(i, i + UPSERT_BATCH_SIZE)
      const { error } = await supabaseAdmin
        .from('candidates')
        .delete()
        .in('id', batch)

      if (error) {
        errors.push(`Candidates delete batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
      } else {
        candidatesDeleted += batch.length
      }
    }

    // Step 6: Count non-promo job openings (informational, don't delete them)
    const { count: nonPromoJoCount } = await supabaseAdmin
      .from('job_openings')
      .select('*', { count: 'exact', head: true })
      .not('id', 'in', `(${promoIds.join(',')})`)

    nonPromoJobOpenings = nonPromoJoCount ?? 0

  } catch (err) {
    errors.push(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    candidates_deleted: candidatesDeleted,
    sla_alerts_resolved: slaAlertsResolved,
    stage_history_deleted: stageHistoryDeleted,
    non_promo_job_openings: nonPromoJobOpenings,
    errors,
  }
}

// ---------------------------------------------------------------------------
// Candidate batch processing
// ---------------------------------------------------------------------------

async function processCandidatesBatch(
  zohoCandidates: Record<string, unknown>[],
  jobOpeningId: string
): Promise<{ synced: number; statusChanges: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0
  let statusChangesDetected = 0

  const candidateIds = zohoCandidates.map((c) => String(c.id))
  const existingStatusMap = await getExistingCandidateStatuses(candidateIds)

  // Get job opening title for association
  const { data: joData } = await supabaseAdmin
    .from('job_openings')
    .select('title')
    .eq('id', jobOpeningId)
    .single()
  const jobOpeningTitle = joData?.title ?? null

  const candidateRows: Record<string, unknown>[] = []
  const stageHistoryInserts: Record<string, unknown>[] = []

  for (const zohoCandidate of zohoCandidates) {
    const transformed = transformCandidate(zohoCandidate)
    const existingStatus = existingStatusMap.get(transformed.id) ?? null
    const currentStatus = transformed.current_status

    if (
      currentStatus &&
      existingStatus !== null &&
      existingStatus !== currentStatus
    ) {
      const statusChange = extractStatusChange(
        transformed.id,
        existingStatus,
        currentStatus,
        transformed.modified_time ?? new Date().toISOString()
      )

      if (statusChange) {
        const daysInStage = await getDaysInStage(
          transformed.id,
          statusChange.changed_at
        )

        stageHistoryInserts.push({
          ...statusChange,
          job_opening_id: jobOpeningId,
          days_in_stage: daysInStage,
        })
        statusChangesDetected++
      }
    }

    candidateRows.push({
      ...transformed,
      job_opening_id: jobOpeningId,
      job_opening_title: jobOpeningTitle,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  // Batch upsert candidates
  for (let i = 0; i < candidateRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = candidateRows.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabaseAdmin
      .from('candidates')
      .upsert(batch as any[], { onConflict: 'id' })

    if (error) {
      errors.push(`Candidates upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
    } else {
      synced += batch.length
    }
  }

  // Insert stage history records
  if (stageHistoryInserts.length > 0) {
    for (let i = 0; i < stageHistoryInserts.length; i += UPSERT_BATCH_SIZE) {
      const batch = stageHistoryInserts.slice(i, i + UPSERT_BATCH_SIZE)
      const { error } = await supabaseAdmin
        .from('stage_history')
        .insert(batch as any[])

      if (error) {
        errors.push(`Stage history insert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`)
      }
    }
  }

  return { synced, statusChanges: statusChangesDetected, errors }
}

// ---------------------------------------------------------------------------
// Post-processing (operates only on promo candidates in Supabase)
// ---------------------------------------------------------------------------

async function runPostProcessing(errors: string[]): Promise<void> {
  try {
    await calculateCandidateDays()
  } catch (err) {
    errors.push(
      `Calculate candidate days failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    await updateJobOpeningStats()
  } catch (err) {
    errors.push(
      `Update job opening stats failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    await createDailySnapshot()
  } catch (err) {
    errors.push(
      `Daily snapshot failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    await recalculateSlaAlerts()
  } catch (err) {
    errors.push(
      `SLA alerts recalculation failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

async function getExistingCandidateStatuses(
  candidateIds: string[]
): Promise<Map<string, string | null>> {
  const statusMap = new Map<string, string | null>()

  for (let i = 0; i < candidateIds.length; i += UPSERT_BATCH_SIZE) {
    const batch = candidateIds.slice(i, i + UPSERT_BATCH_SIZE)
    const { data } = await supabaseAdmin
      .from('candidates')
      .select('id, current_status')
      .in('id', batch)

    if (data) {
      for (const row of data) {
        statusMap.set(row.id, row.current_status)
      }
    }
  }

  return statusMap
}

async function getDaysInStage(
  candidateId: string,
  changedAt: string
): Promise<number | null> {
  const { data: lastEntry } = await supabaseAdmin
    .from('stage_history')
    .select('changed_at')
    .eq('candidate_id', candidateId)
    .order('changed_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastEntry?.changed_at) return null

  const prev = new Date(lastEntry.changed_at).getTime()
  const curr = new Date(changedAt).getTime()
  return Math.round((curr - prev) / (1000 * 60 * 60 * 24))
}

async function calculateCandidateDays(): Promise<void> {
  const now = new Date()
  const terminalFilter = `(${TERMINAL_STATUSES.join(',')})`

  // Only process candidates that are in Supabase (which are now only promo candidates)
  const { data: candidates, error } = await supabaseAdmin
    .from('candidates')
    .select('id, created_time, last_activity_time, modified_time')
    .not('current_status', 'in', terminalFilter)

  if (error) throw error
  if (!candidates || candidates.length === 0) return

  const batchSize = 50
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)
    const updates = batch.map((c) => {
      const createdDate = c.created_time ? new Date(c.created_time) : now
      const activityDate = c.last_activity_time
        ? new Date(c.last_activity_time)
        : c.modified_time
          ? new Date(c.modified_time)
          : now

      return supabaseAdmin
        .from('candidates')
        .update({
          days_in_process: differenceInDays(now, createdDate),
          days_since_activity: differenceInDays(now, activityDate),
        })
        .eq('id', c.id)
    })

    const results = await Promise.all(updates)
    for (const result of results) {
      if (result.error) throw result.error
    }
  }
}

async function updateJobOpeningStats(): Promise<void> {
  // Only update stats for promo job openings (since only promo candidates are in DB)
  const promos = await getPromoJobOpeningIds()
  if (promos.length === 0) return

  for (const promo of promos) {
    const { count: totalCandidates, error: totalError } = await supabaseAdmin
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('job_opening_id', promo.id)

    if (totalError) throw totalError

    const { count: hiredCount, error: hiredError } = await supabaseAdmin
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('job_opening_id', promo.id)
      .eq('current_status', 'Hired')

    if (hiredError) throw hiredError

    const { error: updateError } = await supabaseAdmin
      .from('job_openings')
      .update({
        total_candidates: totalCandidates ?? 0,
        hired_count: hiredCount ?? 0,
      })
      .eq('id', promo.id)

    if (updateError) throw updateError
  }
}

async function createDailySnapshot(): Promise<number> {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')

  // Check if snapshot already exists
  const { count: existingCount, error: checkError } = await supabaseAdmin
    .from('daily_snapshot')
    .select('*', { count: 'exact', head: true })
    .eq('snapshot_date', today)

  if (checkError) throw checkError
  if (existingCount && existingCount > 0) return 0

  // Only snapshot promo candidates (which is all that's in the DB now)
  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('candidates')
    .select('job_opening_id, job_opening_title, current_status')

  if (fetchError) throw fetchError
  if (!candidates || candidates.length === 0) return 0

  // Group by (job_opening_id, current_status)
  const groups = new Map<
    string,
    {
      job_opening_id: string | null
      job_opening_title: string | null
      status: string | null
      count: number
    }
  >()

  for (const c of candidates) {
    const key = `${c.job_opening_id ?? 'null'}::${c.current_status ?? 'null'}`
    const existing = groups.get(key)
    if (existing) {
      existing.count++
    } else {
      groups.set(key, {
        job_opening_id: c.job_opening_id,
        job_opening_title: c.job_opening_title,
        status: c.current_status,
        count: 1,
      })
    }
  }

  const rows = Array.from(groups.values()).map((g) => ({
    snapshot_date: today,
    job_opening_id: g.job_opening_id,
    job_opening_title: g.job_opening_title,
    status: g.status,
    count: g.count,
  }))

  const { error: insertError } = await supabaseAdmin
    .from('daily_snapshot')
    .insert(rows)

  if (insertError) throw insertError

  return rows.length
}

async function recalculateSlaAlerts(): Promise<number> {
  const now = new Date()
  const terminalFilter = `(${TERMINAL_STATUSES.join(',')})`

  // Fetch SLA thresholds from config
  const { data: configRow, error: configError } = await supabaseAdmin
    .from('dashboard_config')
    .select('config_value')
    .eq('config_key', 'sla_thresholds')
    .single()

  if (configError) throw configError

  const thresholds = configRow.config_value as unknown as SlaThresholds
  if (!thresholds) return 0

  // Get all active candidates (only promo ones exist in DB now)
  const { data: candidates, error: fetchError } = await supabaseAdmin
    .from('candidates')
    .select(
      'id, full_name, job_opening_id, job_opening_title, current_status, last_activity_time, modified_time, owner'
    )
    .not('current_status', 'in', terminalFilter)

  if (fetchError) throw fetchError
  if (!candidates || candidates.length === 0) return 0

  // Get all unresolved alerts
  const { data: existingAlerts, error: alertsError } = await supabaseAdmin
    .from('sla_alerts')
    .select('id, candidate_id, alert_level')
    .is('resolved_at', null)

  if (alertsError) throw alertsError

  const alertsByCandidate = new Map<
    string,
    { id: number; alert_level: string | null }
  >()
  for (const alert of existingAlerts ?? []) {
    if (alert.candidate_id) {
      alertsByCandidate.set(alert.candidate_id, {
        id: alert.id,
        alert_level: alert.alert_level,
      })
    }
  }

  let alertsCreated = 0
  const activeCandidateIds = new Set<string>()

  for (const candidate of candidates) {
    activeCandidateIds.add(candidate.id)

    const activityDate = candidate.last_activity_time
      ? new Date(candidate.last_activity_time)
      : candidate.modified_time
        ? new Date(candidate.modified_time)
        : now

    const daysStuck = differenceInDays(now, activityDate)
    const status = candidate.current_status ?? ''
    const threshold = thresholds[status]

    if (!threshold) {
      const existing = alertsByCandidate.get(candidate.id)
      if (existing) {
        await supabaseAdmin
          .from('sla_alerts')
          .update({ resolved_at: now.toISOString() })
          .eq('id', existing.id)
      }
      await supabaseAdmin
        .from('candidates')
        .update({ sla_status: 'green' })
        .eq('id', candidate.id)
      continue
    }

    let alertLevel: string | null = null
    let slaStatus = 'green'

    if (daysStuck > threshold.red) {
      alertLevel = 'red'
      slaStatus = 'red'
    } else if (daysStuck > threshold.yellow) {
      alertLevel = 'yellow'
      slaStatus = 'yellow'
    }

    const existingAlert = alertsByCandidate.get(candidate.id)

    if (alertLevel) {
      if (existingAlert) {
        if (existingAlert.alert_level !== alertLevel) {
          await supabaseAdmin
            .from('sla_alerts')
            .update({
              alert_level: alertLevel,
              days_stuck: daysStuck,
              current_status: candidate.current_status,
              updated_at: now.toISOString(),
            })
            .eq('id', existingAlert.id)
        } else {
          await supabaseAdmin
            .from('sla_alerts')
            .update({
              days_stuck: daysStuck,
              updated_at: now.toISOString(),
            })
            .eq('id', existingAlert.id)
        }
      } else {
        const { error } = await supabaseAdmin.from('sla_alerts').insert({
          candidate_id: candidate.id,
          candidate_name: candidate.full_name,
          job_opening_id: candidate.job_opening_id,
          job_opening_title: candidate.job_opening_title,
          current_status: candidate.current_status,
          days_stuck: daysStuck,
          alert_level: alertLevel,
          owner: candidate.owner,
        })
        if (!error) alertsCreated++
      }
    } else {
      if (existingAlert) {
        await supabaseAdmin
          .from('sla_alerts')
          .update({ resolved_at: now.toISOString() })
          .eq('id', existingAlert.id)
      }
    }

    await supabaseAdmin
      .from('candidates')
      .update({ sla_status: slaStatus })
      .eq('id', candidate.id)
  }

  // Resolve alerts for candidates no longer active
  for (const [candidateId, alert] of alertsByCandidate) {
    if (!activeCandidateIds.has(candidateId)) {
      await supabaseAdmin
        .from('sla_alerts')
        .update({ resolved_at: now.toISOString() })
        .eq('id', alert.id)
    }
  }

  return alertsCreated
}

// ---------------------------------------------------------------------------
// Types for SLA
// ---------------------------------------------------------------------------

interface SlaThreshold {
  yellow: number
  red: number
}

type SlaThresholds = Record<string, SlaThreshold>
