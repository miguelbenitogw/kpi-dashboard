/**
 * POST /api/admin/sync-all?phase=<phase>
 *
 * Manual trigger for the full sync pipeline. Each phase runs independently
 * so each one fits within the 60s Vercel function limit on hobby plans.
 *
 * Protected by Supabase session (dashboard login).
 *
 * Phases:
 *   excel-madre        — Excel madre sheets (Base Datos + Resumen)
 *   promo-sheets       — Promo sheets KPI
 *   placement          — Norway Global Placement
 *   zoho-vacancies     — Zoho job openings sync
 *   vacancy-cvs        — Vacancy CV weekly/daily KPI
 *   vacancy-stats      — Vacancy status counts
 *   social             — Social media snapshots (YouTube + Instagram)
 *   germany            — Germany Excel madre (Base Datos, Exámenes, Pagos)
 *   germany-candidates — Germany candidates Zoho sync
 *   atraccion-history  — Candidate job history for promo candidates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importPromoSheet } from '@/lib/google-sheets/import'
import { importPlacement } from '@/lib/google-sheets/import-placement'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'
import { importGermanyExcelMadre, GERMANY_SHEET_ID } from '@/lib/google-sheets/import-germany'
import { syncGermanyCandidateData } from '@/lib/zoho/sync-germany-candidates'
import { POST as syncVacancyCvsPost } from '@/app/api/admin/sync-vacancy-cvs/route'
import { POST as syncVacancyStatsPost } from '@/app/api/admin/sync-vacancy-stats/route'
import { POST as syncSocialPost } from '@/app/api/admin/sync-social/route'
import { GET as syncAtraccionHistoryGet } from '@/app/api/cron/sync-atraccion-history/route'

export const maxDuration = 300

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------
async function requireAuth(): Promise<boolean> {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Phase result type
// ---------------------------------------------------------------------------
export interface PhaseSummary {
  phase: string
  duration_ms: number
  updated: number
  inserted: number
  errors: number
  skipped: number
  all_errors: string[]
}

// ---------------------------------------------------------------------------
// Helper — build a proxy Request with x-api-key for admin handlers
// ---------------------------------------------------------------------------
function buildApiKeyRequest(url: string): Request {
  const syncApiKey = process.env.SYNC_API_KEY ?? ''
  return new Request(url, {
    method: 'POST',
    headers: { 'x-api-key': syncApiKey },
  })
}

// Helper — build a GET Request with CRON_SECRET for cron handlers
function buildCronRequest(url: string): NextRequest {
  const cronSecret = process.env.CRON_SECRET ?? ''
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${cronSecret}` },
  })
}

// ---------------------------------------------------------------------------
// Phase 1 — Excel Madre
// ---------------------------------------------------------------------------
async function runExcelMadre(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'excel-madre', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('madre_sheets_kpi')
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .order('year', { ascending: true })

  if (error) { s.all_errors.push(`Failed to fetch madre_sheets_kpi: ${error.message}`); s.errors++; s.duration_ms = Date.now() - t0; return s }

  for (const madre of (sheets ?? [])) {
    try {
      const r = await importExcelMadre(madre.sheet_id)
      s.updated  += r.baseDatos.updated + r.resumen.upserted
      s.inserted += r.baseDatos.inserted
      s.errors   += r.errors.length
      s.all_errors.push(...r.errors.map((e: string) => `[${madre.label}] ${e}`))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.errors++
      s.all_errors.push(`[${madre.label}] Fatal: ${msg}`)
    }
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 2 — Promo Sheets
// ---------------------------------------------------------------------------
async function runPromoSheets(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'promo-sheets', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()
  const TIMEOUT_MS = 270_000

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('promo_sheets_kpi')
    .select('id, sheet_url, sheet_name, promocion_nombre, sync_status, group_filter')
    .neq('sync_status', 'disabled')

  if (error) { s.all_errors.push(`Failed to fetch promo_sheets_kpi: ${error.message}`); s.errors++; s.duration_ms = Date.now() - t0; return s }

  for (const sheet of (sheets ?? [])) {
    if (Date.now() - t0 > TIMEOUT_MS) { s.skipped++; continue }
    if (!sheet.promocion_nombre) { s.skipped++; continue }

    try {
      await (supabaseAdmin as any).from('promo_sheets_kpi').update({ sync_status: 'syncing' }).eq('id', sheet.id)
      const r = await importPromoSheet(sheet.sheet_url, sheet.promocion_nombre, sheet.sheet_name ?? undefined, sheet.group_filter ?? '')
      s.inserted += r.imported ?? 0
      s.updated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.errors++
      s.all_errors.push(`[${sheet.sheet_name}] ${msg}`)
      await (supabaseAdmin as any).from('promo_sheets_kpi').update({ sync_status: 'error', sync_error: msg }).eq('id', sheet.id)
    }
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 3 — Norway Placement
// ---------------------------------------------------------------------------
async function runPlacement(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'placement', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('madre_sheets_kpi')
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .in('year', [2025, 2026])
    .order('year', { ascending: true })

  if (error) { s.all_errors.push(`Failed to fetch madre_sheets_kpi: ${error.message}`); s.errors++; s.duration_ms = Date.now() - t0; return s }

  for (const madre of (sheets ?? [])) {
    try {
      const results = await importPlacement(madre.sheet_id, madre.year)
      for (const r of results) {
        s.updated  += r.updated
        s.inserted += r.inserted
        s.errors   += r.errors.length
        s.all_errors.push(...r.errors.map((e) => `[${madre.label}/${r.source}] ${e}`))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.errors++
      s.all_errors.push(`[${madre.label}] Fatal: ${msg}`)
    }
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 4 — Zoho Vacancies (job openings)
// ---------------------------------------------------------------------------
async function runZohoVacancies(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'zoho-vacancies', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const result = await syncJobOpenings()
    s.inserted = result.synced
    s.errors   = result.errors.length
    s.all_errors.push(...result.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 5 — Vacancy CVs (weekly/daily KPI)
// Uses the same handler as POST /api/admin/sync-vacancy-cvs via proxy Request
// ---------------------------------------------------------------------------
async function runVacancyCvs(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'vacancy-cvs', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const req = buildApiKeyRequest('http://localhost/api/admin/sync-vacancy-cvs')
    const res = await syncVacancyCvsPost(req)
    const data = await res.json() as Record<string, unknown>

    s.updated  = (data.vacancies_synced as number | undefined) ?? 0
    s.skipped  = (data.vacancies_skipped_unchanged as number | undefined) ?? 0
    s.inserted = (data.rows_upserted as number | undefined) ?? 0

    const errs = (data.errors as string[] | undefined) ?? []
    s.errors   = errs.length
    s.all_errors.push(...errs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 6 — Vacancy Stats (status counts per vacancy)
// Uses the same handler as POST /api/admin/sync-vacancy-stats via proxy Request
// ---------------------------------------------------------------------------
async function runVacancyStats(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'vacancy-stats', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const req = buildApiKeyRequest('http://localhost/api/admin/sync-vacancy-stats')
    const res = await syncVacancyStatsPost(req)
    const data = await res.json() as Record<string, unknown>

    s.updated  = (data.vacancies_processed as number | undefined) ?? 0
    s.inserted = (data.total_counts_upserted as number | undefined) ?? 0

    const errs = (data.errors as string[] | undefined) ?? []
    s.errors   = errs.length
    s.all_errors.push(...errs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 7 — Social Media (YouTube + Instagram)
// Uses the same handler as POST /api/admin/sync-social via proxy Request
// ---------------------------------------------------------------------------
async function runSocial(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'social', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const req = buildApiKeyRequest('http://localhost/api/admin/sync-social')
    const res = await syncSocialPost(req)
    const data = await res.json() as Record<string, unknown>

    const summary = (data.summary as Record<string, { synced: number; skipped: number; errors: string[] }> | undefined) ?? {}
    for (const platform of Object.values(summary)) {
      s.inserted += platform.synced ?? 0
      s.skipped  += platform.skipped ?? 0
      s.errors   += (platform.errors ?? []).length
      s.all_errors.push(...(platform.errors ?? []))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 8 — Germany Excel Madre
// ---------------------------------------------------------------------------
async function runGermany(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'germany', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const result = await importGermanyExcelMadre(GERMANY_SHEET_ID)

    s.inserted = result.baseDatos.upserted + result.examenes.upserted + result.pagos.upserted
    s.skipped  = result.baseDatos.skipped  + result.examenes.skipped  + result.pagos.skipped

    const allErrs = [
      ...result.baseDatos.errors,
      ...result.examenes.errors,
      ...result.pagos.errors,
      ...result.errors,
    ]
    s.errors = allErrs.length
    s.all_errors.push(...allErrs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 9 — Germany Candidates (Zoho tags + history)
// ---------------------------------------------------------------------------
async function runGermanyCandidates(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'germany-candidates', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const result = await syncGermanyCandidateData()
    s.updated  = result.tags_updated + result.history_updated
    s.skipped  = result.history_skipped
    s.errors   = result.errors.length
    s.all_errors.push(...result.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 10 — Atraccion History (candidate_job_history_kpi)
// Uses the same handler as GET /api/cron/sync-atraccion-history via proxy
// ---------------------------------------------------------------------------
async function runAtraccionHistory(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'atraccion-history', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  try {
    const req = buildCronRequest('http://localhost/api/cron/sync-atraccion-history')
    const res = await syncAtraccionHistoryGet(req)
    const data = await res.json() as Record<string, unknown>

    s.inserted = (data.inserted as number | undefined) ?? 0
    s.skipped  = (data.skipped  as number | undefined) ?? 0

    const errs = (data.errors as string[] | undefined) ?? []
    s.errors   = errs.length
    s.all_errors.push(...errs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.errors++
    s.all_errors.push(`Fatal: ${msg}`)
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const phase = new URL(req.url).searchParams.get('phase') ?? 'excel-madre'

    let result: PhaseSummary
    if      (phase === 'excel-madre')        result = await runExcelMadre()
    else if (phase === 'promo-sheets')       result = await runPromoSheets()
    else if (phase === 'placement')          result = await runPlacement()
    else if (phase === 'zoho-vacancies')     result = await runZohoVacancies()
    else if (phase === 'vacancy-cvs')        result = await runVacancyCvs()
    else if (phase === 'vacancy-stats')      result = await runVacancyStats()
    else if (phase === 'social')             result = await runSocial()
    else if (phase === 'germany')            result = await runGermany()
    else if (phase === 'germany-candidates') result = await runGermanyCandidates()
    else if (phase === 'atraccion-history')  result = await runAtraccionHistory()
    else return NextResponse.json({ error: `Unknown phase: ${phase}` }, { status: 400 })

    return NextResponse.json(result, { status: result.errors > 0 ? 207 : 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-all] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
