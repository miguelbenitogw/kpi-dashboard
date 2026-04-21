import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'

export const maxDuration = 60

/**
 * GET /api/cron/sync
 *
 * Daily cron — syncs active job openings from Zoho Recruit into job_openings_kpi.
 * Scheduled: 0 2 * * * (every day at 02:00 UTC)
 *
 * Protected by Bearer CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const startTime = Date.now()

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
    const jobOpeningsResult = await syncJobOpenings('active_only')

    const finishedAt = new Date().toISOString()
    const hasErrors = jobOpeningsResult.errors.length > 0

    if (logId) {
      await supabaseAdmin
        .from('sync_log_kpi')
        .update({
          status: hasErrors ? 'partial' : 'success',
          finished_at: finishedAt,
          records_processed: jobOpeningsResult.synced,
          api_calls_used: jobOpeningsResult.api_calls,
          error_message: hasErrors ? jobOpeningsResult.errors.join(' | ') : null,
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
