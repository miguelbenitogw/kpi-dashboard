/**
 * TEMPORAL — delete after single use.
 * GET /api/admin/do-backfill — called from the admin button in ClosedVacancyCvsView.
 * No auth: this route exists only for the temporary UI button and will be removed.
 */
import { NextResponse } from 'next/server'
import { zohoFetch } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'

export const maxDuration = 300

const DELAY_MS = 250
const BATCH_SIZE = 50

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function POST() {
  const { data: rows, error } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id')
    .eq('is_active', false)
    .eq('hired_count', 0)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const vacancies = (rows ?? []) as { id: string }[]
  let updated = 0, skipped = 0, errors = 0

  for (let i = 0; i < vacancies.length; i += BATCH_SIZE) {
    const batch = vacancies.slice(i, i + BATCH_SIZE)
    for (let j = 0; j < batch.length; j++) {
      const v = batch[j]
      try {
        // v.id IS the Zoho record ID (e.g. "179458000010180096")
        const res = await zohoFetch<{ data?: Array<Record<string, unknown>> }>(
          `/Job_Openings/${v.id}`,
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

        if (upErr) errors++; else updated++
      } catch { errors++ }

      if (j < batch.length - 1) await sleep(DELAY_MS)
    }
    if (i + BATCH_SIZE < vacancies.length) await sleep(DELAY_MS)
  }

  return NextResponse.json({ total: vacancies.length, updated, skipped, errors })
}
