import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAssociatedJobOpeningsForCandidate } from '@/lib/zoho/client'
import { deriveTipoVacante } from '@/lib/utils/vacancy-type'

export const maxDuration = 300 // 5 minutes — call in chunks, not all at once

const INTER_CANDIDATE_DELAY_MS = 100
const PREVIEW_MAX = 20

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET /api/admin/backfill-atraccion-history
 *
 * One-shot backfill endpoint that fetches each promo candidate's full Zoho
 * job history and classifies associations using tipo_vacante (or deriveTipoVacante
 * as fallback). Supports limit/offset pagination and dryRun mode.
 *
 * Query params:
 *   limit   — candidates to process per call (default 50, max 200)
 *   offset  — pagination cursor (default 0)
 *   dryRun  — "true" (default) logs what WOULD be inserted; "false" writes to DB
 *
 * Example:
 *   GET /api/admin/backfill-atraccion-history?limit=50&offset=0&dryRun=true
 *   GET /api/admin/backfill-atraccion-history?limit=50&offset=0&dryRun=false
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
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
  }> = []

  // ── 1. Count total promo candidates ─────────────────────────────────────────
  const { count: totalCandidates, error: countErr } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id', { count: 'exact', head: true })
    .not('promocion_nombre', 'is', null)

  if (countErr) {
    return NextResponse.json(
      { error: `Failed to count promo candidates: ${countErr.message}` },
      { status: 500 }
    )
  }

  // ── 2. Fetch candidate batch ─────────────────────────────────────────────────
  const { data: candidates, error: candidatesErr } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name, promocion_nombre')
    .not('promocion_nombre', 'is', null)
    .order('id')
    .range(offset, offset + limit - 1)

  if (candidatesErr) {
    return NextResponse.json(
      { error: `Failed to fetch candidates: ${candidatesErr.message}` },
      { status: 500 }
    )
  }

  const batch = candidates ?? []

  // ── 3. Pre-load all job_openings_kpi for tipo_vacante lookup ─────────────────
  // Load title + tipo_vacante (if column exists) for all known vacancies.
  // We cast to any because tipo_vacante was added after the types were generated.
  const { data: knownVacancies } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')

  // Build a fast lookup map: vacancy id → { title, tipo_vacante }
  const vacancyMap = new Map<string, { title: string; tipoVacante: string }>(
    (knownVacancies ?? []).map((v) => {
      const raw = v as unknown as { id: string; title: string; tipo_vacante?: string | null }
      return [
        raw.id,
        {
          title: raw.title,
          tipoVacante: raw.tipo_vacante ?? deriveTipoVacante(raw.title),
        },
      ]
    })
  )

  const fetchedAt = new Date().toISOString()

  // ── 4. For each candidate, fetch Zoho job associations ──────────────────────
  for (let i = 0; i < batch.length; i++) {
    const candidate = batch[i]

    let zohoJobOpenings: Array<{
      id: string
      title: string
      status: string | null
    }>

    try {
      zohoJobOpenings = await fetchAssociatedJobOpeningsForCandidate(candidate.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Candidate ${candidate.id} (${candidate.full_name ?? ''}): ${msg}`)
      if (i < batch.length - 1) await sleep(INTER_CANDIDATE_DELAY_MS)
      continue
    }

    if (zohoJobOpenings.length === 0) {
      skipped++
      if (i < batch.length - 1) await sleep(INTER_CANDIDATE_DELAY_MS)
      continue
    }

    // ── 5. For each job opening, resolve tipo_vacante ────────────────────────
    for (const jo of zohoJobOpenings) {
      const knownVacancy = vacancyMap.get(jo.id)
      const jobOpeningTitle = knownVacancy?.title ?? jo.title
      const tipoVacante = knownVacancy?.tipoVacante ?? deriveTipoVacante(jo.title)

      if (preview.length < PREVIEW_MAX) {
        preview.push({
          candidate: candidate.full_name ?? candidate.id,
          promo: candidate.promocion_nombre ?? '',
          vacancy: jobOpeningTitle,
          tipo: tipoVacante,
        })
      }

      // ── 6. Upsert (only when dryRun = false) ─────────────────────────────
      if (!dryRun) {
        const row = {
          candidate_id: candidate.id,
          candidate_name: candidate.full_name ?? null,
          zoho_record_id: candidate.id,
          job_opening_id: jo.id,
          job_opening_title: jobOpeningTitle,
          association_type: tipoVacante,
          candidate_status_in_jo: jo.status ?? null,
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
            `Upsert failed for candidate ${candidate.id} / vacancy ${jo.id}: ${upsertErr.message}`
          )
        } else {
          inserted++
        }
      } else {
        // dryRun: count as "would insert"
        inserted++
      }
    }

    if (i < batch.length - 1) await sleep(INTER_CANDIDATE_DELAY_MS)
  }

  const processed = batch.length
  const nextOffset = offset + processed
  const hasMore = nextOffset < (totalCandidates ?? 0)

  return NextResponse.json({
    processed,
    offset,
    nextOffset,
    totalCandidates: totalCandidates ?? 0,
    hasMore,
    inserted,
    skipped,
    errors,
    dryRun,
    preview,
  })
}
