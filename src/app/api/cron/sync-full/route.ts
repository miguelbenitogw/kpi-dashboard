import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const maxDuration = 300

interface DispatchTarget {
  name: string
  path: string
  method: 'GET' | 'POST'
  authType: 'cron' | 'api-key'
  body?: Record<string, unknown>
}

interface DispatchResult {
  name: string
  status: number
  duration_ms: number
  data: Record<string, unknown> | null
  error: string | null
}

const TARGETS: DispatchTarget[] = [
  { name: 'zoho_job_openings',     path: '/api/cron/sync',                      method: 'GET',  authType: 'cron' },
  { name: 'excel_madre',           path: '/api/cron/sync-madre',                method: 'GET',  authType: 'cron' },
  { name: 'candidate_tags',        path: '/api/admin/sync-candidate-tags',      method: 'POST', authType: 'api-key' },
  { name: 'vacancy_tags_local',    path: '/api/admin/sync-vacancy-tags',        method: 'POST', authType: 'api-key' },
  { name: 'vacancy_tags_zoho',     path: '/api/admin/sync-vacancy-tags-zoho',   method: 'POST', authType: 'api-key', body: { onlyActive: true } },
  { name: 'atraccion_history',     path: '/api/cron/sync-atraccion-history',    method: 'GET',  authType: 'cron' },
]

/**
 * GET /api/cron/sync-full
 *
 * Weekly full sync — runs every Sunday at 03:00 UTC.
 * Dispatches all sub-syncs in PARALLEL via fetch(). Each sub-sync runs in its
 * own serverless function instance with its own 300s timeout budget.
 *
 * Schedule: 0 3 * * 0
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
      sync_type: 'full_weekly',
      status: 'running',
      started_at: startedAt,
    })
    .select('id')
    .single()

  const logId = logRow?.id ?? null

  const baseUrl = deriveBaseUrl(request)
  const syncApiKey = process.env.SYNC_API_KEY ?? ''

  const settled = await Promise.allSettled(
    TARGETS.map(async (target): Promise<DispatchResult> => {
      const t0 = Date.now()
      try {
        const headers: Record<string, string> =
          target.authType === 'cron'
            ? { authorization: `Bearer ${cronSecret}` }
            : { 'x-api-key': syncApiKey }

        if (target.body) headers['content-type'] = 'application/json'

        const res = await fetch(`${baseUrl}${target.path}`, {
          method: target.method,
          headers,
          body: target.body ? JSON.stringify(target.body) : undefined,
        })

        const data = await res.json().catch(() => null)
        return { name: target.name, status: res.status, duration_ms: Date.now() - t0, data, error: null }
      } catch (err) {
        return {
          name: target.name,
          status: 0,
          duration_ms: Date.now() - t0,
          data: null,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  const results: Record<string, DispatchResult> = {}
  const allErrors: string[] = []

  for (const outcome of settled) {
    const result = outcome.status === 'fulfilled'
      ? outcome.value
      : { name: 'unknown', status: 0, duration_ms: 0, data: null, error: String(outcome.reason) }

    results[result.name] = result

    if (result.error) allErrors.push(`[${result.name}] ${result.error}`)
    if (result.status >= 400) allErrors.push(`[${result.name}] HTTP ${result.status}`)
  }

  const hasErrors = allErrors.length > 0

  if (logId) {
    await supabaseAdmin
      .from('sync_log_kpi')
      .update({
        status: hasErrors ? 'partial' : 'success',
        finished_at: new Date().toISOString(),
        records_processed: Object.keys(results).length,
        error_message: hasErrors ? allErrors.slice(0, 10).join(' | ') : null,
      })
      .eq('id', logId)
  }

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      dispatched: TARGETS.length,
      results,
      all_errors: allErrors,
    },
    { status: hasErrors ? 207 : 200 },
  )
}

function deriveBaseUrl(request: NextRequest): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const url = new URL(request.url)
  return url.origin
}
