import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '../middleware'
import type { JobOpeningInsert } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { job_openings } = body

    if (!Array.isArray(job_openings) || job_openings.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payload: job_openings array is required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    type VacancyInput = Record<string, unknown>

    // Build upsert records.
    // When the payload includes hired_count / total_candidates (from updated n8n
    // workflows that now fetch No_of_Candidates_Hired / No_of_Candidates_Associated
    // from Zoho), use those values directly — they are the source of truth.
    const records: JobOpeningInsert[] = (job_openings as VacancyInput[]).map((jo) => {
      const rawHired = jo.hired_count
      const rawTotal = jo.total_candidates
      const record: JobOpeningInsert = {
        id: jo.id as string,
        title: jo.title as string,
        status: (jo.status as string) ?? null,
        date_opened: (jo.date_opened as string) ?? null,
        client_name: (jo.client_name as string) ?? null,
        owner: (jo.owner as string) ?? null,
        is_active: (jo.status as string)?.toLowerCase() === 'open',
        last_synced_at: now,
        updated_at: now,
      }
      if (rawHired != null && Number.isFinite(Number(rawHired))) {
        record.hired_count = Number(rawHired)
      }
      if (rawTotal != null && Number.isFinite(Number(rawTotal))) {
        record.total_candidates = Number(rawTotal)
      }
      return record
    })

    const { data, error } = await supabaseAdmin
      .from('job_openings_kpi')
      .upsert(records, { onConflict: 'id' })
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 }
      )
    }

    // For vacancies where counts were NOT in the payload, compute them from
    // candidates_kpi as fallback.
    // - total_candidates: all candidates linked to the vacancy
    // - hired_count: candidates with current_status = 'Hired' (exact Zoho status)
    //   NOTE: candidate_stage is always NULL — do NOT use it.
    const jobIdsNeedingCalc = (job_openings as VacancyInput[])
      .filter((jo) => {
        const rawHired = jo.hired_count
        const rawTotal = jo.total_candidates
        return (
          rawHired == null || !Number.isFinite(Number(rawHired)) ||
          rawTotal == null || !Number.isFinite(Number(rawTotal))
        )
      })
      .map((jo) => jo.id as string)

    for (const jobId of jobIdsNeedingCalc) {
      const { count: totalCandidates } = await supabaseAdmin
        .from('candidates_kpi')
        .select('*', { count: 'exact', head: true })
        .eq('job_opening_id', jobId)

      const { count: hiredCount } = await supabaseAdmin
        .from('candidates_kpi')
        .select('*', { count: 'exact', head: true })
        .eq('job_opening_id', jobId)
        .eq('current_status', 'Hired')

      await supabaseAdmin
        .from('job_openings_kpi')
        .update({
          total_candidates: totalCandidates ?? 0,
          hired_count: hiredCount ?? 0,
        })
        .eq('id', jobId)
    }

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      message: `Upserted ${data?.length ?? 0} job openings with candidate counts`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
