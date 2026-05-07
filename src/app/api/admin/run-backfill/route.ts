/**
 * TEMPORAL — delete this file after running once.
 * GET /api/admin/run-backfill
 * Triggers the hired_count backfill for closed vacancies from Zoho.
 * No auth required — calls backfill logic directly server-side.
 */
import { NextResponse } from 'next/server'
import { zohoFetch } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'

const BATCH_SIZE = 50
const DELAY_MS = 250

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function GET() {
  const { data: rows, error } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, zoho_id')
    .eq('is_active', false)
    .eq('hired_count', 0)
    .not('zoho_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const vacancies = (rows ?? []) as { id: string; zoho_id: string }[]
  let updated = 0, skipped = 0, errors = 0

  for (let i = 0; i < vacancies.length; i += BATCH_SIZE) {
    const batch = vacancies.slice(i, i + BATCH_SIZE)
    for (const v of batch) {
      try {
        const res = await zohoFetch<{ data?: Array<Record<string, unknown>> }>(
          `/Job_Openings/${v.zoho_id}`,
          { fields: 'No_of_Candidates_Hired' }
        )
        const record = res.data?.[0]
        if (!record) { skipped++; continue }

        const raw = record['No_of_Candidates_Hired']
        const count = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw) || 0 : 0

        if (count === 0) { skipped++; continue }

        const { error: upErr } = await supabaseAdmin
          .from('job_openings_kpi')
          .update({ hired_count: count })
          .eq('id', v.id)

        if (upErr) errors++; else updated++
      } catch { errors++ }

      await sleep(DELAY_MS)
    }
  }

  return NextResponse.json({ total: vacancies.length, updated, skipped, errors })
}
