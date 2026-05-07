/**
 * TEMPORAL — delete this file after running once.
 * POST /api/admin/run-backfill
 * Triggers the hired_count backfill for closed vacancies from Zoho.
 * Protected by x-api-key header (same as all other admin endpoints).
 */
import { NextResponse } from 'next/server'
import { zohoFetch } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'

export const maxDuration = 300 // 5 minutes — needed for large vacancy sets

const BATCH_SIZE = 50
const DELAY_MS = 250

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const { data: rows, error } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, zoho_id')
    .eq('is_active', false)
    .eq('hired_count', 0)
    .not('zoho_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const vacancies = (rows ?? []) as { id: string; zoho_id: string }[]
  let updated = 0, skipped = 0, errors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < vacancies.length; i += BATCH_SIZE) {
    const batch = vacancies.slice(i, i + BATCH_SIZE)
    for (let j = 0; j < batch.length; j++) {
      const v = batch[j]
      try {
        const res = await zohoFetch<{ data?: Array<Record<string, unknown>> }>(
          `/Job_Openings/${v.zoho_id}`,
          { fields: 'No_of_Candidates_Hired' }
        )
        const record = res.data?.[0]
        if (!record) { skipped++; continue }

        const raw = record['No_of_Candidates_Hired']
        const count = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) || 0 : 0

        if (count === 0) { skipped++; continue }

        const { error: upErr } = await supabaseAdmin
          .from('job_openings_kpi')
          .update({ hired_count: count })
          .eq('id', v.id)

        if (upErr) {
          errors++
          errorDetails.push(`Update failed for ${v.id} (zoho_id=${v.zoho_id}): ${upErr.message}`)
        } else {
          updated++
        }
      } catch (err) {
        errors++
        errorDetails.push(`Zoho fetch failed for zoho_id=${v.zoho_id}: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Rate-limit: skip delay after last item in batch
      if (j < batch.length - 1) {
        await sleep(DELAY_MS)
      }
    }

    // Brief pause between batches
    if (i + BATCH_SIZE < vacancies.length) {
      await sleep(DELAY_MS)
    }
  }

  return NextResponse.json(
    { total: vacancies.length, updated, skipped, errors, error_details: errorDetails },
    { status: errors > 0 ? 207 : 200 }
  )
}
