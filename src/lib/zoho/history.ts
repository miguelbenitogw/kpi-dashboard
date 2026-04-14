import { zohoFetch } from './client'
import { supabaseAdmin } from '../supabase/server'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface ZohoSearchResponse {
  data: Array<{ id: string; Full_Name?: string; [key: string]: unknown }>
  info?: { more_records: boolean; count: number }
}

interface ZohoAssociateResponse {
  data: Array<{
    id: string
    Job_Opening_Name?: string
    Candidate_Status?: string
    [key: string]: unknown
  }>
  info?: { more_records: boolean; count: number }
}

/**
 * Look up the long Zoho record ID for a candidate by their short Candidate_ID.
 * Uses the Zoho search endpoint: /Candidates/search?criteria=(Candidate_ID:equals:{id})
 */
export async function fetchCandidateZohoId(
  candidateId: string
): Promise<{ zohoRecordId: string; fullName: string | null } | null> {
  try {
    const response = await zohoFetch<ZohoSearchResponse>('/Candidates/search', {
      criteria: `(Candidate_ID:equals:${candidateId})`,
    })

    if (!response.data || response.data.length === 0) {
      return null
    }

    const record = response.data[0]
    return {
      zohoRecordId: record.id,
      fullName: record.Full_Name ?? null,
    }
  } catch (error) {
    console.error(`[history] Failed to search Zoho for candidate ${candidateId}:`, error)
    return null
  }
}

/**
 * Fetch all job openings associated with a candidate via the associate endpoint.
 * GET /Candidates/{zohoRecordId}/associate
 */
export async function fetchCandidateJobOpenings(
  zohoRecordId: string
): Promise<ZohoAssociateResponse['data']> {
  const allData: ZohoAssociateResponse['data'] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    try {
      const response = await zohoFetch<ZohoAssociateResponse>(
        `/Candidates/${zohoRecordId}/associate`,
        {
          per_page: '200',
          page: String(page),
        }
      )

      if (response.data && response.data.length > 0) {
        allData.push(...response.data)
      }

      hasMore = response.info?.more_records ?? false
      page++

      if (hasMore) {
        await sleep(200)
      }
    } catch {
      // No more data or error — stop pagination
      break
    }
  }

  return allData
}

/**
 * Classify a job opening as 'atraccion', 'formacion', or 'unknown'
 * based on the title. If it contains 'promo' it's formacion, else atraccion.
 */
function classifyJobOpening(title: string | null | undefined): string {
  if (!title) return 'unknown'
  const lower = title.toLowerCase()
  if (lower.includes('promo')) return 'formacion'
  if (lower.includes('intern') || lower.includes('prácticas') || lower.includes('practicas'))
    return 'interna'
  return 'atraccion'
}

interface HistoryResult {
  processed: number
  totalJobOpenings: number
  errors: string[]
}

/**
 * Fetch and store job opening history for a batch of candidate IDs.
 * For each candidate:
 *   1. Search Zoho for the long record ID
 *   2. Get all associated job openings
 *   3. Upsert into candidate_job_history
 *
 * Rate limited at 200ms between Zoho API calls.
 * Has a timeout (default 55s) to stay within Vercel limits.
 */
export async function fetchAllCandidateHistories(
  candidateIds: string[],
  timeoutMs: number = 55000
): Promise<HistoryResult> {
  const startTime = Date.now()
  let processed = 0
  let totalJobOpenings = 0
  const errors: string[] = []

  for (const candidateId of candidateIds) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      console.log(`[history] Timeout reached after processing ${processed} candidates`)
      break
    }

    try {
      // Step 1: Get the Zoho record ID
      const zohoInfo = await fetchCandidateZohoId(candidateId)
      await sleep(200)

      if (!zohoInfo) {
        errors.push(`Candidate ${candidateId}: not found in Zoho`)
        processed++
        continue
      }

      // Step 2: Get associated job openings
      const jobOpenings = await fetchCandidateJobOpenings(zohoInfo.zohoRecordId)
      await sleep(200)

      if (jobOpenings.length === 0) {
        // Still mark as processed, no JOs to store
        processed++
        continue
      }

      // Step 3: Upsert into Supabase
      const rows = jobOpenings.map((jo) => ({
        candidate_id: candidateId,
        candidate_name: zohoInfo.fullName,
        zoho_record_id: zohoInfo.zohoRecordId,
        job_opening_id: jo.id,
        job_opening_title: jo.Job_Opening_Name ?? null,
        candidate_status_in_jo: jo.Candidate_Status ?? null,
        association_type: classifyJobOpening(jo.Job_Opening_Name),
        fetched_at: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabaseAdmin
        .from('candidate_job_history')
        .upsert(rows, { onConflict: 'candidate_id,job_opening_id' })

      if (upsertError) {
        errors.push(`Candidate ${candidateId}: upsert error - ${upsertError.message}`)
      } else {
        totalJobOpenings += jobOpenings.length
      }

      processed++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`Candidate ${candidateId}: ${msg.slice(0, 200)}`)
      processed++
    }
  }

  return { processed, totalJobOpenings, errors }
}
