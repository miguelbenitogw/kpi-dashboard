import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '../middleware'

export async function GET(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    // Get last sync log entry
    const { data: lastSync } = await supabaseAdmin
      .from('sync_log_kpi')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    // Get last failed sync
    const { data: lastError } = await supabaseAdmin
      .from('sync_log_kpi')
      .select('*')
      .eq('status', 'failed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    // Get record counts for all tables
    const [candidates, jobOpenings, stageHistory, slaAlerts, dailySnapshots, syncLogs] =
      await Promise.all([
        supabaseAdmin.from('candidates_kpi').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('job_openings_kpi').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('stage_history_kpi').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('sla_alerts_kpi').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('daily_snapshot_kpi').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('sync_log_kpi').select('*', { count: 'exact', head: true }),
      ])

    return NextResponse.json({
      success: true,
      last_sync: lastSync
        ? {
            sync_type: lastSync.sync_type,
            status: lastSync.status,
            started_at: lastSync.started_at,
            finished_at: lastSync.finished_at,
            records_processed: lastSync.records_processed,
            api_calls_used: lastSync.api_calls_used,
          }
        : null,
      last_error: lastError
        ? {
            sync_type: lastError.sync_type,
            started_at: lastError.started_at,
            error_message: lastError.error_message,
          }
        : null,
      record_counts: {
        candidates: candidates.count ?? 0,
        job_openings: jobOpenings.count ?? 0,
        stage_history: stageHistory.count ?? 0,
        sla_alerts: slaAlerts.count ?? 0,
        daily_snapshots: dailySnapshots.count ?? 0,
        sync_logs: syncLogs.count ?? 0,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
