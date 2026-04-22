import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { syncCandidateTags } from '@/lib/zoho/sync-candidate-tags'
import { syncVacancyTagCountsLocal } from '@/lib/supabase/sync-vacancy-tags-local'
import { syncVacancyTagCountsFromZoho } from '@/lib/zoho/sync-vacancy-tags-zoho'

export const maxDuration = 60

/**
 * GET /api/cron/sync-full
 *
 * Weekly full sync — runs every Sunday at 03:00 UTC.
 * Combines Zoho job openings sync + Excel madre import in one pass.
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

  const results: {
    zoho_job_openings: { synced: number; api_calls: number; errors: string[] } | null
    excel_madre: {
      base_datos: { updated: number; inserted: number; skipped: number } | null
      resumen: { upserted: number; skipped: number } | null
      errors: string[]
    }
    candidate_tags: {
      total_fetched: number
      updated: number
      skipped_no_match: number
      api_calls: number
      errors: string[]
    } | null
    vacancy_tag_counts_local: { processed: number; skipped_closed: number; upserted_rows: number; errors: string[] } | null
    vacancy_tag_counts_zoho: {
      vacancies_processed: number
      vacancies_skipped_closed: number
      tag_rows_upserted: number
      zoho_api_calls: number
      errors: string[]
    } | null
  } = {
    zoho_job_openings: null,
    excel_madre: { base_datos: null, resumen: null, errors: [] },
    candidate_tags: null,
    vacancy_tag_counts_local: null,
    vacancy_tag_counts_zoho: null,
  }

  // ---- Phase 1: Zoho job openings ----------------------------------------
  try {
    const joResult = await syncJobOpenings()
    results.zoho_job_openings = {
      synced: joResult.synced,
      api_calls: joResult.api_calls,
      errors: joResult.errors,
    }
  } catch (err) {
    results.zoho_job_openings = {
      synced: 0,
      api_calls: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
  }

  // ---- Phase 2: Excel madre -----------------------------------------------
  try {
    const madreResult = await importExcelMadre()
    results.excel_madre = {
      base_datos: {
        updated: madreResult.baseDatos.updated,
        inserted: madreResult.baseDatos.inserted,
        skipped: madreResult.baseDatos.skipped,
      },
      resumen: {
        upserted: madreResult.resumen.upserted,
        skipped: madreResult.resumen.skipped,
      },
      errors: madreResult.errors,
    }
  } catch (err) {
    results.excel_madre.errors.push(
      `Fatal: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // ---- Phase 3: Candidate tags from Zoho ------------------------------------
  try {
    const tagsResult = await syncCandidateTags()
    results.candidate_tags = tagsResult
  } catch (err) {
    results.candidate_tags = {
      total_fetched: 0,
      updated: 0,
      skipped_no_match: 0,
      api_calls: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
  }

  // ---- Phase 4: Vacancy tag counts — local (Supabase-only, all vacancies) -----
  // Reads candidate_job_history_kpi + candidates_kpi.tags. No Zoho API.
  // Closed vacancies are skipped if already computed (frozen).
  try {
    const vtcLocalResult = await syncVacancyTagCountsLocal()
    results.vacancy_tag_counts_local = vtcLocalResult
  } catch (err) {
    results.vacancy_tag_counts_local = {
      processed: 0,
      skipped_closed: 0,
      upserted_rows: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
  }

  // ---- Phase 5: Vacancy tag counts from Zoho API (active only) ---------------
  // Covers candidates associated in Zoho but not yet in candidate_job_history_kpi.
  try {
    const vtcZohoResult = await syncVacancyTagCountsFromZoho({ onlyActive: true })
    results.vacancy_tag_counts_zoho = vtcZohoResult
  } catch (err) {
    results.vacancy_tag_counts_zoho = {
      vacancies_processed: 0,
      vacancies_skipped_closed: 0,
      tag_rows_upserted: 0,
      zoho_api_calls: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
  }

  const allErrors = [
    ...(results.zoho_job_openings?.errors ?? []),
    ...results.excel_madre.errors,
    ...(results.candidate_tags?.errors ?? []),
    ...(results.vacancy_tag_counts_local?.errors ?? []),
    ...(results.vacancy_tag_counts_zoho?.errors ?? []),
  ]
  const hasErrors = allErrors.length > 0
  const totalRecords =
    (results.zoho_job_openings?.synced ?? 0) +
    (results.excel_madre.base_datos?.updated ?? 0) +
    (results.excel_madre.base_datos?.inserted ?? 0)

  if (logId) {
    await supabaseAdmin
      .from('sync_log_kpi')
      .update({
        status: hasErrors ? 'partial' : 'success',
        finished_at: new Date().toISOString(),
        records_processed: totalRecords,
        api_calls_used: results.zoho_job_openings?.api_calls ?? 0,
        error_message: hasErrors ? allErrors.join(' | ') : null,
      })
      .eq('id', logId)
  }

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      ...results,
      all_errors: allErrors,
    },
    { status: hasErrors ? 207 : 200 }
  )
}
