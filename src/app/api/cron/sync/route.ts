import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'
import { syncCandidatesForActiveVacancies } from '@/lib/zoho/sync-candidates'

// Candidates sync across ~23 vacancies with 500 ms delays between each =
// up to ~12 s of sleep alone, plus Zoho round-trips.  Raise the timeout
// ceiling so Vercel does not cut the function short.
export const maxDuration = 300

/**
 * GET /api/cron/sync
 *
 * Daily cron — syncs job openings AND their candidate associations from Zoho
 * Recruit into job_openings_kpi / candidate_job_history_kpi.
 * Scheduled: 0 2 * * * (every day at 02:00 UTC)
 *
 * Protected by Bearer CRON_SECRET (same as all cron routes).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const startTime = Date.now()

  // Log start
  const { data: logRow } = await supabaseAdmin
    .from('sync_log_kpi')
    .insert({
      sync_type: 'zoho_job_openings_daily',
      status: 'running',
      started_at: startedAt,
    })
    .select('id')
    .single()

  const logId = logRow?.id ?? null

  try {
    // Step 1 — Job openings: only touch vacancies tagged "Proceso atracción actual"
    const jobOpeningsResult = await syncJobOpenings('active_only')

    // Step 2 — Candidate associations: pull all candidates per active vacancy
    // and upsert into candidate_job_history_kpi so the status pivot table has data.
    const candidatesResult = await syncCandidatesForActiveVacancies()

    const finishedAt = new Date().toISOString()
    const allErrors = [...jobOpeningsResult.errors, ...candidatesResult.errors]
    const hasErrors = allErrors.length > 0
    const totalApiCalls = jobOpeningsResult.api_calls + candidatesResult.api_calls

    // Update log entry
    if (logId) {
      await supabaseAdmin
        .from('sync_log_kpi')
        .update({
          status: hasErrors ? 'partial' : 'success',
          finished_at: finishedAt,
          records_processed: jobOpeningsResult.synced + candidatesResult.candidates_synced,
          api_calls_used: totalApiCalls,
          error_message: hasErrors ? allErrors.join(' | ') : null,
        })
        .eq('id', logId)
    }

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        job_openings: {
          synced: jobOpeningsResult.synced,
          skipped_inactive: jobOpeningsResult.skipped_inactive,
          api_calls: jobOpeningsResult.api_calls,
          errors: jobOpeningsResult.errors,
        },
        candidates: {
          vacancies_processed: candidatesResult.vacancies_processed,
          synced: candidatesResult.candidates_synced,
          api_calls: candidatesResult.api_calls,
          errors: candidatesResult.errors,
        },
      },
      { status: hasErrors ? 207 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (logId) {
      await supabaseAdmin
        .from('sync_log_kpi')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq('id', logId)
    }

    return NextResponse.json(
      { success: false, error: message, duration_ms: Date.now() - startTime },
      { status: 500 }
    )
  }
}
