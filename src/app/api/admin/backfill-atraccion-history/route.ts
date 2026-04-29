import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { deriveTipoVacante } from '@/lib/utils/vacancy-type'

export const maxDuration = 300 // 5 minutes — call in chunks, not all at once

const INTER_VACANCY_DELAY_MS = 250
const PREVIEW_MAX = 30

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET /api/admin/backfill-atraccion-history
 *
 * Backfill: for every atracción vacancy, fetches its candidates from Zoho
 * (using the confirmed-working /Job_Openings/{id}/associate endpoint),
 * cross-references with promo candidates in Supabase, and upserts matches
 * into candidate_job_history_kpi with association_type = 'atraccion'.
 *
 * Strategy (vacancy-first, not candidate-first):
 *   - "candidate → their job openings"  endpoint is broken in Zoho Recruit v2
 *   - "job opening → its candidates"    endpoint (/associate) WORKS
 *   → iterate atracción vacancies, intersect with promo candidate set
 *
 * Query params:
 *   limit   — atracción vacancies to process per call (default 20, max 100)
 *   offset  — vacancy pagination cursor (default 0)
 *   dryRun  — "true" (default) logs what WOULD be inserted; "false" writes to DB
 *
 * Example:
 *   GET /api/admin/backfill-atraccion-history?limit=20&offset=0&dryRun=true
 *   GET /api/admin/backfill-atraccion-history?limit=20&offset=0&dryRun=false
 *   GET /api/admin/backfill-atraccion-history?limit=20&offset=20&dryRun=false
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const dryRun = searchParams.get('dryRun') !== 'false' // default true

  const errors: string[] = []
  let inserted = 0
  let skipped = 0
  const preview: Array<{
    candidate: string
    promo: string
    vacancy: string
    tipo: string
    status: string | null
  }> = []

  // ── 1. Load all promo candidates into a fast lookup map ─────────────────────
  // We need this to cross-reference Zoho candidate IDs with our promo list.
  const { data: promoCandidatesRaw, error: promoCandidatesErr } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name, promocion_nombre')
    .not('promocion_nombre', 'is', null)

  if (promoCandidatesErr) {
    return NextResponse.json(
      { error: `Failed to load promo candidates: ${promoCandidatesErr.message}` },
      { status: 500 }
    )
  }

  const promoCandidates = promoCandidatesRaw ?? []
  // Map: zoho candidate id → { full_name, promocion_nombre }
  const promoCandidateMap = new Map<string, { full_name: string | null; promocion_nombre: string }>(
    promoCandidates
      .filter((c): c is typeof c & { promocion_nombre: string } => !!c.promocion_nombre)
      .map((c) => [c.id, { full_name: c.full_name, promocion_nombre: c.promocion_nombre }])
  )

  // ── 2. Fetch atracción vacancies batch ──────────────────────────────────────
  // Exclude BBDD (talent pools) — they have 1000s of candidates but promo
  // candidates are never associated through talent pools. Including them
  // causes timeouts without any benefit.
  const { data: vacanciesRaw, count: totalAtraccionVacancies, error: vacanciesErr } =
    await (supabaseAdmin as any)
      .from('job_openings_kpi')
      .select('id, title, tipo_vacante', { count: 'exact' })
      .eq('tipo_vacante', 'atraccion')
      .not('title', 'ilike', 'BBDD%')
      .order('id')
      .range(offset, offset + limit - 1)

  if (vacanciesErr) {
    return NextResponse.json(
      { error: `Failed to fetch atracción vacancies: ${vacanciesErr.message}` },
      { status: 500 }
    )
  }

  const vacancyBatch = (vacanciesRaw ?? []) as Array<{
    id: string
    title: string
    tipo_vacante: string
  }>

  const fetchedAt = new Date().toISOString()

  // ── 3. For each vacancy, fetch its candidates from Zoho ────────────────────
  for (let i = 0; i < vacancyBatch.length; i++) {
    const vacancy = vacancyBatch[i]

    let zohoCandiates: Record<string, unknown>[]

    try {
      // fetchAllCandidatesByJobOpening uses /Job_Openings/{id}/associate — CONFIRMED WORKING
      zohoCandiates = await fetchAllCandidatesByJobOpening(vacancy.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Vacancy ${vacancy.id} (${vacancy.title}): ${msg}`)
      if (i < vacancyBatch.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    if (zohoCandiates.length === 0) {
      skipped++
      if (i < vacancyBatch.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    // ── 4. Cross-reference: only process promo candidates ──────────────────
    for (const zohoCandidate of zohoCandiates) {
      // candidates_kpi.id stores Candidate_ID (short sequential, e.g. "88082"),
      // NOT the internal Zoho record id (long 18-digit, e.g. "179458000031006174").
      // Always prefer Candidate_ID for matching against candidates_kpi.id.
      const candidateId = String(zohoCandidate.Candidate_ID ?? zohoCandidate.id ?? '')
      if (!candidateId) continue

      const promoCandidate = promoCandidateMap.get(candidateId)
      if (!promoCandidate) continue // not a promo candidate — skip

      const candidateStatusInJo =
        (zohoCandidate.Candidate_Status as string) ??
        (zohoCandidate.Candidate_Stage as string) ??
        null

      const tipoVacante = vacancy.tipo_vacante ?? deriveTipoVacante(vacancy.title)

      if (preview.length < PREVIEW_MAX) {
        preview.push({
          candidate: promoCandidate.full_name ?? candidateId,
          promo: promoCandidate.promocion_nombre,
          vacancy: vacancy.title,
          tipo: tipoVacante,
          status: candidateStatusInJo,
        })
      }

      // ── 5. Upsert (only when dryRun = false) ───────────────────────────
      if (!dryRun) {
        const row = {
          candidate_id: candidateId,                                    // Candidate_ID (short)
          candidate_name: promoCandidate.full_name ?? null,
          zoho_record_id: String(zohoCandidate.id ?? candidateId),      // internal id (long)
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
          errors.push(
            `Upsert failed for candidate ${candidateId} / vacancy ${vacancy.id}: ${upsertErr.message}`
          )
        } else {
          inserted++
        }
      } else {
        // dryRun: count as "would insert"
        inserted++
      }
    }

    if (i < vacancyBatch.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
  }

  const processed = vacancyBatch.length
  const nextOffset = offset + processed
  const hasMore = nextOffset < (totalAtraccionVacancies ?? 0)

  return NextResponse.json({
    processed,
    offset,
    nextOffset,
    totalAtraccionVacancies: totalAtraccionVacancies ?? 0,
    totalPromoCandidates: promoCandidateMap.size,
    hasMore,
    inserted,
    skipped,
    errors,
    dryRun,
    preview,
  })
}
