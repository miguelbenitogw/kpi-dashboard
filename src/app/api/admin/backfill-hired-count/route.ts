import { NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { zohoFetch } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'

export const maxDuration = 300 // 5 minutes

const BATCH_SIZE = 50
const INTER_REQUEST_DELAY_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type VacancyRow = {
  id: string
  zoho_id: string
}

type ZohoJobOpeningResponse = {
  data?: Array<Record<string, unknown>>
}

/**
 * POST /api/admin/backfill-hired-count
 *
 * Backfill: reads all closed vacancies (is_active = false) in job_openings_kpi
 * where hired_count = 0 and zoho_id IS NOT NULL, fetches No_of_Candidates_Hired
 * from Zoho Recruit for each, and updates hired_count in Supabase.
 *
 * Processes in batches of 50 to avoid saturating the Zoho API.
 * Protected by x-api-key header (same as all other admin endpoints).
 *
 * Returns: { updated: number, skipped: number, errors: number, error_details: string[] }
 *
 * How to invoke:
 *   curl -X POST https://<your-domain>/api/admin/backfill-hired-count \
 *     -H "x-api-key: <SYNC_API_KEY>"
 */
export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  // ── 1. Load all closed vacancies with hired_count = 0 and a zoho_id ──────────
  const { data: vacanciesRaw, error: fetchError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, zoho_id')
    .eq('is_active', false)
    .eq('hired_count', 0)
    .not('zoho_id', 'is', null)

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to fetch vacancies from Supabase: ${fetchError.message}` },
      { status: 500 }
    )
  }

  const vacancies = (vacanciesRaw ?? []) as VacancyRow[]

  if (vacancies.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, errors: 0, error_details: [] })
  }

  let updated = 0
  let skipped = 0
  let errors = 0
  const errorDetails: string[] = []

  // ── 2. Process in batches of BATCH_SIZE ──────────────────────────────────────
  for (let batchStart = 0; batchStart < vacancies.length; batchStart += BATCH_SIZE) {
    const batch = vacancies.slice(batchStart, batchStart + BATCH_SIZE)

    for (let i = 0; i < batch.length; i++) {
      const vacancy = batch[i]

      try {
        // Fetch the single job opening from Zoho — only the field we need
        const zohoResponse = await zohoFetch<ZohoJobOpeningResponse>(
          `/Job_Openings/${vacancy.zoho_id}`,
          { fields: 'No_of_Candidates_Hired' }
        )

        const record = zohoResponse.data?.[0]
        if (!record) {
          skipped++
          continue
        }

        const rawHiredCount = record['No_of_Candidates_Hired']
        const hiredCount =
          typeof rawHiredCount === 'number'
            ? rawHiredCount
            : typeof rawHiredCount === 'string'
              ? parseInt(rawHiredCount, 10) || 0
              : 0

        // Only update if Zoho reports a value > 0 — skip rows where Zoho also has 0
        if (hiredCount === 0) {
          skipped++
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('job_openings_kpi')
          .update({ hired_count: hiredCount })
          .eq('id', vacancy.id)

        if (updateError) {
          errors++
          errorDetails.push(
            `Update failed for vacancy ${vacancy.id} (zoho_id=${vacancy.zoho_id}): ${updateError.message}`
          )
        } else {
          updated++
        }
      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : String(err)
        errorDetails.push(`Zoho fetch failed for zoho_id=${vacancy.zoho_id}: ${msg}`)
      }

      // Rate-limit: wait between Zoho API calls (skip delay after last item in batch)
      if (i < batch.length - 1) {
        await sleep(INTER_REQUEST_DELAY_MS)
      }
    }

    // Brief pause between batches to avoid burst pressure
    if (batchStart + BATCH_SIZE < vacancies.length) {
      await sleep(INTER_REQUEST_DELAY_MS)
    }
  }

  return NextResponse.json(
    {
      updated,
      skipped,
      errors,
      error_details: errorDetails,
      total_candidates: vacancies.length,
    },
    { status: errors > 0 ? 207 : 200 }
  )
}
