import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

export const maxDuration = 60

/**
 * GET /api/cron/sync-placement
 *
 * Weekly cron that syncs the Global Placement tab from all active Excel Madre sheets.
 * Populates placement fields (agency, status, priority, arrival, etc.) on candidates_kpi.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const startTime = Date.now()

  await supabaseAdmin.from('sync_log_kpi').insert({
    sync_type: 'global_placement_weekly',
    status: 'running',
    started_at: startedAt,
  })

  const results: Array<{
    label: string
    updated: number
    skipped: number
    notMatched: number
    errors: string[]
  }> = []

  const { data: madreSheets } = await supabaseAdmin
    .from('madre_sheets_kpi' as any)
    .select('sheet_id, label')
    .eq('is_active', true)
    .order('year', { ascending: true })

  for (const madre of (madreSheets as Array<{ sheet_id: string; label: string }> | null) ?? []) {
    try {
      const r = await importGlobalPlacement(madre.sheet_id)
      results.push({
        label: madre.label,
        updated: r.updated,
        skipped: r.skipped,
        notMatched: r.notMatched,
        errors: r.errors,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ label: madre.label, updated: 0, skipped: 0, notMatched: 0, errors: [`Fatal: ${msg}`] })
    }
  }

  const totalUpdated = results.reduce((s, r) => s + r.updated, 0)
  const allErrors = results.flatMap((r) => r.errors)
  const status = allErrors.length === 0 ? 'success' : totalUpdated > 0 ? 'partial' : 'failed'
  const finishedAt = new Date().toISOString()

  await supabaseAdmin.from('sync_log_kpi').insert({
    sync_type: 'global_placement_weekly',
    status,
    records_processed: totalUpdated,
    error_message: allErrors.length > 0 ? allErrors.slice(0, 5).join(' | ') : null,
    started_at: startedAt,
    finished_at: finishedAt,
  })

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      status,
      results,
    },
    { status: allErrors.length > 0 && totalUpdated === 0 ? 500 : 200 }
  )
}
