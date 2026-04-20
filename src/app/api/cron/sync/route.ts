import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'

export const maxDuration = 60

/**
 * GET /api/cron/sync
 *
 * Daily cron — syncs job openings from Zoho Recruit into job_openings_kpi.
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
    const result = await syncJobOpenings()

    const finishedAt = new Date().toISOString()
    const hasErrors = result.errors.length > 0

    // Update log entry
    if (logId) {
      await supabaseAdmin
        .from('sync_log_kpi')
        .update({
          status: hasErrors ? 'partial' : 'success',
          finished_at: finishedAt,
          records_processed: result.synced,
          api_calls_used: result.api_calls,
          error_message: hasErrors ? result.errors.join(' | ') : null,
        })
        .eq('id', logId)
    }

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        synced: result.synced,
        api_calls: result.api_calls,
        errors: result.errors,
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
