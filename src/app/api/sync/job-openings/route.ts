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
    const records: JobOpeningInsert[] = job_openings.map((jo: Record<string, unknown>) => ({
      id: jo.id as string,
      title: jo.title as string,
      status: (jo.status as string) ?? null,
      date_opened: (jo.date_opened as string) ?? null,
      client_name: (jo.client_name as string) ?? null,
      owner: (jo.owner as string) ?? null,
      is_active: (jo.status as string)?.toLowerCase() === 'open',
      last_synced_at: now,
      updated_at: now,
    }))

    const { data, error } = await supabaseAdmin
      .from('job_openings')
      .upsert(records, { onConflict: 'id' })
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 }
      )
    }

    // After upsert, calculate total_candidates and hired_count for each job opening
    const jobIds = records.map((r) => r.id)
    for (const jobId of jobIds) {
      const { count: totalCandidates } = await supabaseAdmin
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('job_opening_id', jobId)

      const { count: hiredCount } = await supabaseAdmin
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('job_opening_id', jobId)
        .ilike('candidate_stage', '%hired%')

      await supabaseAdmin
        .from('job_openings')
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
