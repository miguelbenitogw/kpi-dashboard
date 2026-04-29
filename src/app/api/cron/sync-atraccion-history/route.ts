import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { deriveTipoVacante } from '@/lib/utils/vacancy-type'

export const maxDuration = 300

const INTER_VACANCY_DELAY_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET /api/cron/sync-atraccion-history
 *
 * Weekly cron — keeps candidate_job_history_kpi up to date for promo candidates.
 *
 * Strategy (vacancy-first, same as admin backfill):
 *   1. Load all promo candidates into a Map
 *   2. Fetch atracción vacancies that are active OR opened in last 90 days
 *   3. For each vacancy, call /Job_Openings/{id}/associate (CONFIRMED WORKING)
 *   4. Cross-reference returned candidates with promo candidate map
 *   5. Upsert matches into candidate_job_history_kpi
 *
 * Why vacancy-first? The candidate→job_openings Zoho endpoint is broken.
 * Limiting to recent/active vacancies keeps each cron run under 5 minutes.
 *
 * Schedule: 0 5 * * 1 (every Monday at 05:00 UTC, after sync-full on Sunday)
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
      sync_type: 'atraccion_history_weekly',
      status: 'running',
      started_at: startedAt,
    })
    .select('id')
    .single()

  const logId = logRow?.id ?? null

  const errors: string[] = []
  let inserted = 0
  let skipped = 0

  try {
    // ── 1. Load all promo candidates ──────────────────────────────────────────
    const { data: promoCandidatesRaw, error: promoCandidatesErr } = await supabaseAdmin
      .from('candidates_kpi')
      .select('id, full_name, promocion_nombre')
      .not('promocion_nombre', 'is', null)

    if (promoCandidatesErr) throw new Error(`Failed to load promo candidates: ${promoCandidatesErr.message}`)

    const promoCandidateMap = new Map<string, { full_name: string | null; promocion_nombre: string }>(
      (promoCandidatesRaw ?? [])
        .filter((c): c is typeof c & { promocion_nombre: string } => !!c.promocion_nombre)
        .map((c) => [c.id, { full_name: c.full_name, promocion_nombre: c.promocion_nombre }])
    )

    // ── 2. Fetch relevant atracción vacancies ─────────────────────────────────
    // Active vacancies + those opened in the last 90 days (recently closed)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data: vacanciesRaw, error: vacanciesErr } = await (supabaseAdmin as any)
      .from('job_openings_kpi')
      .select('id, title, tipo_vacante, is_active, date_opened')
      .eq('tipo_vacante', 'atraccion')
      .or(`is_active.eq.true,date_opened.gte.${ninetyDaysAgo}`)
      .order('date_opened', { ascending: false })

    if (vacanciesErr) throw new Error(`Failed to fetch atracción vacancies: ${vacanciesErr.message}`)

    const vacancies = (vacanciesRaw ?? []) as Array<{
      id: string
      title: string
      tipo_vacante: string
      is_active: boolean
      date_opened: string | null
    }>

    const fetchedAt = new Date().toISOString()

    // ── 3. For each vacancy, fetch candidates from Zoho and cross-reference ───
    for (let i = 0; i < vacancies.length; i++) {
      const vacancy = vacancies[i]

      let zohoCandiates: Record<string, unknown>[]

      try {
        zohoCandiates = await fetchAllCandidatesByJobOpening(vacancy.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Vacancy ${vacancy.id} (${vacancy.title}): ${msg}`)
        if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
        continue
      }

      if (zohoCandiates.length === 0) {
        skipped++
        if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
        continue
      }

      for (const zohoCandidate of zohoCandiates) {
        // candidates_kpi.id stores Candidate_ID (short sequential, e.g. "88082"),
        // NOT the internal Zoho record id (long 18-digit, e.g. "179458000031006174").
        const candidateId = String(zohoCandidate.Candidate_ID ?? zohoCandidate.id ?? '')
        if (!candidateId) continue

        const promoCandidate = promoCandidateMap.get(candidateId)
        if (!promoCandidate) continue

        const candidateStatusInJo =
          (zohoCandidate.Candidate_Status as string) ??
          (zohoCandidate.Candidate_Stage as string) ??
          null

        const tipoVacante = vacancy.tipo_vacante ?? deriveTipoVacante(vacancy.title)

        const row = {
          candidate_id: candidateId,                                  // Candidate_ID (short)
          candidate_name: promoCandidate.full_name ?? null,
          zoho_record_id: String(zohoCandidate.id ?? candidateId),   // internal id (long)
          job_opening_id: vacancy.id,
          job_opening_title: vacancy.title,
          association_type: tipoVacante,
          candidate_status_in_jo: candidateStatusInJo,
          fetched_at: fetchedAt,
        }

        const { error: upsertErr } = await supabaseAdmin
          .from('candidate_job_history_kpi')
          .upsert(row, {
            onConflict: 'candidate_id,job_opening_id',
            ignoreDuplicates: false,
          })

        if (upsertErr) {
          errors.push(`Upsert failed for candidate ${candidateId} / vacancy ${vacancy.id}: ${upsertErr.message}`)
        } else {
          inserted++
        }
      }

      if (i < vacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
    }

    const duration = Date.now() - startTime
    const hasErrors = errors.length > 0

    if (logId) {
      await supabaseAdmin
        .from('sync_log_kpi')
        .update({
          status: hasErrors ? 'partial' : 'success',
          finished_at: new Date().toISOString(),
          records_processed: inserted,
          error_message: hasErrors ? errors.slice(0, 5).join(' | ') : null,
        })
        .eq('id', logId)
    }

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      vacancies_processed: vacancies.length,
      promo_candidates_loaded: promoCandidateMap.size,
      inserted,
      skipped,
      errors: errors.slice(0, 10),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (logId) {
      await supabaseAdmin
        .from('sync_log_kpi')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          error_message: msg,
        })
        .eq('id', logId)
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
