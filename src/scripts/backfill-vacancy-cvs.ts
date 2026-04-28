/**
 * One-shot backfill: populate vacancy_cv_weekly_kpi for ALL closed vacancies
 * pulling candidate Created_Time from Zoho Recruit.
 *
 * Usage (from kpi-dashboard/):
 *   npx tsx src/scripts/backfill-vacancy-cvs.ts
 *
 * Optional flags:
 *   --limit 50          → process at most N vacancies (default: all)
 *   --offset 0          → skip the first N vacancies (for resuming)
 *   --all               → include ACTIVE vacancies too (default: inactive only)
 *   --vacancy <id>      → process a single specific vacancy ID
 *
 * Progress is logged to stdout. Errors are collected and printed at the end.
 * Safe to re-run: upsert on (vacancy_id, week_start) is idempotent.
 */

// ── Load env vars ─────────────────────────────────────────────────────────────
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      value = value.replace(/\\n$/g, '').trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* file doesn't exist — skip */
  }
}

const cwd = process.cwd()
loadEnvFile(resolve(cwd, '.env.production-local'))
loadEnvFile(resolve(cwd, '.env.local'))

// ── Imports (after env is loaded) ─────────────────────────────────────────────
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'

// ── Config ────────────────────────────────────────────────────────────────────
const INTER_VACANCY_DELAY_MS = 400
const UPSERT_BATCH_SIZE = 200

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getIsoWeekStart(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utc.getUTCDay()
  // Weekend → attribute to prior Friday's week
  if (day === 6) utc.setUTCDate(utc.getUTCDate() - 1)
  else if (day === 0) utc.setUTCDate(utc.getUTCDate() - 2)

  const adjusted = utc.getUTCDay()
  const diffToMonday = adjusted === 0 ? -6 : 1 - adjusted
  utc.setUTCDate(utc.getUTCDate() + diffToMonday)
  return toIsoDate(utc)
}

function getCandidateWeekStart(
  candidate: Record<string, unknown>,
  fallback: Date,
): string {
  const raw = candidate['Created_Time']
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return getIsoWeekStart(parsed)
  }
  return getIsoWeekStart(fallback)
}

interface WeeklyRow {
  vacancy_id: string
  week_start: string
  candidate_count: number
  synced_at: string
}

function buildWeeklyRows(
  vacancyId: string,
  candidates: Record<string, unknown>[],
  syncedAt: string,
): WeeklyRow[] {
  const fallback = new Date(syncedAt)
  const counts = new Map<string, number>()
  for (const c of candidates) {
    const w = getCandidateWeekStart(c, fallback)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([week_start, candidate_count]) => ({
    vacancy_id: vacancyId,
    week_start,
    candidate_count,
    synced_at: syncedAt,
  }))
}

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : undefined
}

const limitArg = getArg('--limit')
const offsetArg = getArg('--offset')
const singleVacancy = getArg('--vacancy')
const includeActive = args.includes('--all')

const LIMIT = limitArg ? Math.max(1, parseInt(limitArg, 10)) : Infinity
const OFFSET = offsetArg ? Math.max(0, parseInt(offsetArg, 10)) : 0

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Backfill vacancy_cv_weekly_kpi from Zoho')
  console.log('═══════════════════════════════════════════════')

  const startedAt = Date.now()
  const syncedAtIso = new Date().toISOString()

  // 1. Fetch vacancy list from Supabase
  let vacancies: { id: string; title: string }[] = []

  if (singleVacancy) {
    vacancies = [{ id: singleVacancy, title: `(single: ${singleVacancy})` }]
  } else {
    // Use supabaseAdmin.from which returns the standard postgrest-js builder
    const baseQuery = supabaseAdmin
      .from('job_openings_kpi')
      .select('id, title')

    const query = includeActive
      ? baseQuery
      : baseQuery.eq('es_proceso_atraccion_actual', false)

    const { data, error } = await query

    if (error) {
      console.error('❌ Error fetching vacancies from Supabase:', error.message)
      process.exit(1)
    }

    vacancies = (data ?? []) as { id: string; title: string }[]
  }

  // Apply offset + limit
  const slice = vacancies.slice(OFFSET, OFFSET + (isFinite(LIMIT) ? LIMIT : vacancies.length))

  console.log(`\nVacantes encontradas : ${vacancies.length}`)
  console.log(`Procesando           : ${slice.length} (offset=${OFFSET}, limit=${isFinite(LIMIT) ? LIMIT : 'all'})`)
  console.log(`Modo                 : ${includeActive ? 'activas + cerradas' : 'solo cerradas'}`)
  console.log(`Fecha de sync        : ${syncedAtIso}\n`)

  const errors: string[] = []
  let totalRows = 0
  let vacanciesOk = 0
  let vacanciesFailed = 0
  let vacanciesSkipped = 0 // 0 candidates → nothing to upsert

  // 2. Process each vacancy
  for (let i = 0; i < slice.length; i++) {
    const vacancy = slice[i]
    const label = `[${i + 1}/${slice.length}] ${vacancy.id} — ${(vacancy.title ?? '').slice(0, 50)}`

    process.stdout.write(`${label} ... `)

    let candidates: Record<string, unknown>[] = []
    try {
      candidates = await fetchAllCandidatesByJobOpening(vacancy.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`❌ Zoho error: ${msg}\n`)
      errors.push(`${vacancy.id}: Zoho fetch failed — ${msg}`)
      vacanciesFailed++
      await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    if (candidates.length === 0) {
      process.stdout.write(`⬜ 0 candidatos\n`)
      vacanciesSkipped++
      await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    const rows = buildWeeklyRows(vacancy.id, candidates, syncedAtIso)

    // Upsert in batches
    let upsertOk = true
    for (let b = 0; b < rows.length; b += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(b, b + UPSERT_BATCH_SIZE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertErr } = await (supabaseAdmin as any)
        .from('vacancy_cv_weekly_kpi')
        .upsert(batch, { onConflict: 'vacancy_id,week_start' })

      if (upsertErr) {
        upsertOk = false
        errors.push(`${vacancy.id}: Supabase upsert failed — ${upsertErr.message}`)
        break
      }
    }

    if (upsertOk) {
      totalRows += rows.length
      vacanciesOk++
      process.stdout.write(`✅ ${candidates.length} candidatos → ${rows.length} semanas\n`)
    } else {
      vacanciesFailed++
      process.stdout.write(`❌ Upsert error (ver resumen)\n`)
    }

    await sleep(INTER_VACANCY_DELAY_MS)
  }

  // 3. Summary
  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('\n═══════════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('═══════════════════════════════════════════════')
  console.log(`Vacantes OK          : ${vacanciesOk}`)
  console.log(`Vacantes sin candid. : ${vacanciesSkipped}`)
  console.log(`Vacantes con error   : ${vacanciesFailed}`)
  console.log(`Filas upserted       : ${totalRows}`)
  console.log(`Tiempo total         : ${durationSec}s`)

  if (errors.length > 0) {
    console.log('\n⚠️  ERRORES:')
    errors.forEach((e) => console.log(`  • ${e}`))
  } else {
    console.log('\n✅ Sin errores')
  }

  console.log('═══════════════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
