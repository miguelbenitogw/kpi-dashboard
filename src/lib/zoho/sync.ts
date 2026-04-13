import { supabaseAdmin } from '../supabase/server'
import { fetchCandidates, fetchCandidatesPage, fetchJobOpenings } from './client'
import {
  transformCandidate,
  transformJobOpening,
  extractStatusChange,
  TERMINAL_STATUSES,
} from './transform'
import { differenceInDays, format, startOfDay } from 'date-fns'
import type { Json } from '../supabase/types'

export interface SyncResult {
  sync_type: 'incremental' | 'full'
  started_at: string
  finished_at: string
  job_openings_synced: number
  candidates_synced: number
  status_changes_detected: number
  sla_alerts_created: number
  snapshots_created: number
  api_calls_used: number
  errors: string[]
}

export interface SyncCursor {
  page: number
  completed: boolean
  sync_id: number
  candidates_so_far: number
  started_at: string
}

export interface ChunkedSyncResult {
  page: number
  candidates_so_far: number
  candidates_this_chunk: number
  completed: boolean
  errors: string[]
  api_calls_used: number
}

// --- Cursor helpers ---

export async function getSyncCursor(): Promise<SyncCursor | null> {
  const { data, error } = await supabaseAdmin
    .from('dashboard_config')
    .select('config_value')
    .eq('config_key', 'sync_cursor')
    .single()

  if (error || !data?.config_value) return null
  const cursor = data.config_value as unknown as SyncCursor
  if (!cursor.page) return null
  return cursor
}

export async function saveSyncCursor(cursor: SyncCursor): Promise<void> {
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

// --- Chunked candidates sync ---

export async function syncCandidatesChunked(
  maxPages: number = 5
): Promise<ChunkedSyncResult> {
  const errors: string[] = []
  let apiCallsUsed = 0
  let candidatesSynced = 0

  // Get or create cursor
  let cursor = await getSyncCursor()

  if (!cursor || cursor.completed) {
    // Start a new sync
    const { data: syncLogEntry } = await supabaseAdmin
      .from('sync_log')
      .insert({
        sync_type: 'full',
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single()

    cursor = {
      page: 1,
      completed: false,
      sync_id: syncLogEntry?.id ?? 0,
      candidates_so_far: 0,
      started_at: new Date().toISOString(),
    }
    await saveSyncCursor(cursor)
  }

  let currentPage = cursor.page
  let pagesProcessed = 0

  while (pagesProcessed < maxPages) {
    try {
      const result = await fetchCandidatesPage(currentPage)
      apiCallsUsed++

      if (result.candidates.length === 0) {
        // No more data
        cursor.completed = true
        break
      }

      // Process this page
      const processResult = await processCandidatesBatch(result.candidates)
      candidatesSynced += processResult.synced
      if (processResult.errors.length > 0) {
        errors.push(...processResult.errors)
      }

      pagesProcessed++

      if (!result.more_records) {
        cursor.completed = true
        break
      }

      currentPage++
    } catch (err) {
      errors.push(
        `Page ${currentPage} failed: ${err instanceof Error ? err.message : String(err)}`
      )
      break
    }
  }

  // Update cursor
  cursor.page = cursor.completed ? currentPage : currentPage + 1
  cursor.candidates_so_far += candidatesSynced
  await saveSyncCursor(cursor)

  // If completed, run post-processing and update sync log
  if (cursor.completed) {
    try {
      await runPostProcessing(errors)
    } catch (err) {
      errors.push(
        `Post-processing failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Update sync log
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
    page: currentPage,
    candidates_so_far: cursor.candidates_so_far,
    candidates_this_chunk: candidatesSynced,
    completed: cursor.completed,
    errors,
    api_calls_used: apiCallsUsed,
  }
}

async function processCandidatesBatch(
  zohoCandidates: Record<string, unknown>[]
): Promise<{ synced: number; statusChanges: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0
  let statusChangesDetected = 0

  const candidateIds = zohoCandidates.map((c) => String(c.id))
  const existingStatusMap = await getExistingCandidateStatuses(candidateIds)

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
          job_opening_id: transformed.global_status
            ? undefined
            : undefined,
          days_in_stage: daysInStage,
        })
        statusChangesDetected++
      }
    }

    candidateRows.push({
      ...transformed,
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
      errors.push(
        `Candidates upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`
      )
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
        errors.push(
          `Stage history insert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`
        )
      }
    }
  }

  return { synced, statusChanges: statusChangesDetected, errors }
}

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

// --- Sync job openings (fast, does not need chunking) ---

export async function syncJobOpenings(): Promise<{
  synced: number
  errors: string[]
  api_calls: number
}> {
  const errors: string[] = []
  let synced = 0

  try {
    const zohoJobOpenings = await fetchJobOpenings()
    const apiCalls = estimateApiCalls(zohoJobOpenings.length)

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
        errors.push(
          `Job openings upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`
        )
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

interface SlaThreshold {
  yellow: number
  red: number
}

type SlaThresholds = Record<string, SlaThreshold>

const UPSERT_BATCH_SIZE = 100

export async function runSync(
  type: 'incremental' | 'full'
): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const errors: string[] = []
  let apiCallsUsed = 0
  let jobOpeningsSynced = 0
  let candidatesSynced = 0
  let statusChangesDetected = 0
  let slaAlertsCreated = 0
  let snapshotsCreated = 0

  // Step 1: Log sync start
  const { data: syncLogEntry, error: logError } = await supabaseAdmin
    .from('sync_log')
    .insert({
      sync_type: type,
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
    // Step 2: Fetch and sync job openings
    try {
      const zohoJobOpenings = await fetchJobOpenings()
      apiCallsUsed += estimateApiCalls(zohoJobOpenings.length)

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
          errors.push(
            `Job openings upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`
          )
        } else {
          jobOpeningsSynced += batch.length
        }
      }
    } catch (err) {
      errors.push(
        `Job openings sync failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Step 3: Fetch and sync candidates
    let modifiedSince: string | undefined
    if (type === 'incremental') {
      modifiedSince = await getLastSuccessfulSyncTime()
    }

    try {
      const zohoCandidates = await fetchCandidates(modifiedSince)
      apiCallsUsed += estimateApiCalls(zohoCandidates.length)

      // Get existing candidates' current statuses for change detection
      const candidateIds = zohoCandidates.map((c) => String(c.id))
      const existingStatusMap = await getExistingCandidateStatuses(candidateIds)

      const candidateRows: Record<string, unknown>[] = []
      const stageHistoryInserts: Record<string, unknown>[] = []

      for (const zohoCandidate of zohoCandidates) {
        const transformed = transformCandidate(zohoCandidate)

        // Check for status change
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
            // Calculate days_in_stage
            const daysInStage = await getDaysInStage(
              transformed.id,
              statusChange.changed_at
            )

            stageHistoryInserts.push({
              ...statusChange,
              job_opening_id: transformed.global_status
                ? undefined
                : undefined,
              days_in_stage: daysInStage,
            })
            statusChangesDetected++
          }
        }

        candidateRows.push({
          ...transformed,
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
          errors.push(
            `Candidates upsert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`
          )
        } else {
          candidatesSynced += batch.length
        }
      }

      // Insert stage history records
      if (stageHistoryInserts.length > 0) {
        for (
          let i = 0;
          i < stageHistoryInserts.length;
          i += UPSERT_BATCH_SIZE
        ) {
          const batch = stageHistoryInserts.slice(i, i + UPSERT_BATCH_SIZE)
          const { error } = await supabaseAdmin
            .from('stage_history')
            .insert(batch as any[])

          if (error) {
            errors.push(
              `Stage history insert batch ${i / UPSERT_BATCH_SIZE}: ${error.message}`
            )
          }
        }
      }
    } catch (err) {
      errors.push(
        `Candidates sync failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Step 4: Run processing
    // 4a: Calculate days_in_process and days_since_activity for active candidates
    try {
      await calculateCandidateDays()
    } catch (err) {
      errors.push(
        `Calculate candidate days failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // 4b: Update job opening stats
    try {
      await updateJobOpeningStats()
    } catch (err) {
      errors.push(
        `Update job opening stats failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // 4c: Create daily snapshot
    try {
      snapshotsCreated = await createDailySnapshot()
    } catch (err) {
      errors.push(
        `Daily snapshot failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // 4d: Recalculate SLA alerts
    try {
      slaAlertsCreated = await recalculateSlaAlerts()
    } catch (err) {
      errors.push(
        `SLA alerts recalculation failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // Step 5: Log sync completion
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
          error_message:
            errors.length > 0 ? errors.join(' | ') : null,
        })
        .eq('id', syncLogId)
    }

    return {
      sync_type: type,
      started_at: startedAt,
      finished_at: finishedAt,
      job_openings_synced: jobOpeningsSynced,
      candidates_synced: candidatesSynced,
      status_changes_detected: statusChangesDetected,
      sla_alerts_created: slaAlertsCreated,
      snapshots_created: snapshotsCreated,
      api_calls_used: apiCallsUsed,
      errors,
    }
  } catch (err) {
    // Fatal error - log to sync_log
    const finishedAt = new Date().toISOString()
    const fatalError =
      err instanceof Error ? err.message : String(err)
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
      sync_type: type,
      started_at: startedAt,
      finished_at: finishedAt,
      job_openings_synced: jobOpeningsSynced,
      candidates_synced: candidatesSynced,
      status_changes_detected: statusChangesDetected,
      sla_alerts_created: slaAlertsCreated,
      snapshots_created: snapshotsCreated,
      api_calls_used: apiCallsUsed,
      errors,
    }
  }
}

// --- Helper functions ---

function estimateApiCalls(recordCount: number): number {
  // Zoho returns max 200 per page
  return Math.max(1, Math.ceil(recordCount / 200))
}

async function getLastSuccessfulSyncTime(): Promise<string | undefined> {
  const { data } = await supabaseAdmin
    .from('sync_log')
    .select('finished_at')
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .single()

  return data?.finished_at ?? undefined
}

async function getExistingCandidateStatuses(
  candidateIds: string[]
): Promise<Map<string, string | null>> {
  const statusMap = new Map<string, string | null>()

  // Fetch in batches to avoid query size limits
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
  const { data: openings, error: openingsError } = await supabaseAdmin
    .from('job_openings')
    .select('id')
    .eq('is_active', true)

  if (openingsError) throw openingsError
  if (!openings || openings.length === 0) return

  for (const opening of openings) {
    const { count: totalCandidates, error: totalError } = await supabaseAdmin
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('job_opening_id', opening.id)

    if (totalError) throw totalError

    const { count: hiredCount, error: hiredError } = await supabaseAdmin
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('job_opening_id', opening.id)
      .eq('current_status', 'Hired')

    if (hiredError) throw hiredError

    const { error: updateError } = await supabaseAdmin
      .from('job_openings')
      .update({
        total_candidates: totalCandidates ?? 0,
        hired_count: hiredCount ?? 0,
      })
      .eq('id', opening.id)

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

  // Get all active candidates
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
