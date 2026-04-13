import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '../middleware'
import type { CandidateInsert } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { candidates } = body

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payload: candidates array is required' },
        { status: 400 }
      )
    }

    const now = new Date()
    const records: CandidateInsert[] = candidates.map((c: Record<string, unknown>) => {
      const createdTime = c.created_time ? new Date(c.created_time as string) : null
      const daysInProcess = createdTime
        ? Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        id: c.id as string,
        full_name: (c.full_name as string) ?? null,
        email: (c.email as string) ?? null,
        phone: (c.phone as string) ?? null,
        job_opening_id: (c.job_opening_id as string) ?? null,
        job_opening_title: (c.job_opening_title as string) ?? null,
        current_status: (c.current_status as string) ?? null,
        candidate_stage: (c.candidate_stage as string) ?? null,
        owner: (c.owner as string) ?? null,
        source: (c.source as string) ?? null,
        created_time: (c.created_time as string) ?? null,
        modified_time: (c.modified_time as string) ?? null,
        days_in_process: daysInProcess,
        last_synced_at: now.toISOString(),
        updated_at: now.toISOString(),
      }
    })

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .upsert(records, { onConflict: 'id' })
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
      message: `Upserted ${data?.length ?? 0} candidates`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
