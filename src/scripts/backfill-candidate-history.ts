/**
 * One-shot backfill: populate candidate_job_history_kpi for all candidates.
 *
 * Usage:
 *   cd kpi-dashboard
 *   npx tsx src/scripts/backfill-candidate-history.ts
 *
 * What it does:
 *
 * PHASE 1 — Sync history from all linked vacancies:
 *   1. Fetches ALL vacancies from promo_job_link_kpi (formacion vacancies)
 *   2. Fetches ALL atraccion vacancies (es_proceso_atraccion_actual = true)
 *   3. Deduplicates the combined list
 *   4. For each vacancy, calls fetchAllCandidatesByJobOpening()
 *   5. Upserts rows into candidate_job_history_kpi (conflict: candidate_id,job_opening_id)
 *   6. Rate-limited: 300ms between Zoho calls
 *
 * PHASE 2 — Find Promo 115/116 vacancies (if candidates still missing history):
 *   1. Identifies candidates from Promo 115/116 still with no history
 *   2. Fetches ALL active Job Openings from Zoho
 *   3. For each job opening, checks overlap with our Promo 115/116 candidate IDs
 *   4. If overlap > 5 → likely the promo vacancy → logs ID + title
 *
 * PHASE 3 — Summary report
 */

// Load env vars from .env files (no dotenv dependency)
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
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      // Vercel CLI adds literal \n at end of some values — strip it
      value = value.replace(/\\n$/g, '').trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* file doesn't exist, skip */
  }
}

const cwd = process.cwd()
// Production-local has all the real keys — load it first
loadEnvFile(resolve(cwd, '.env.production-local'))
loadEnvFile(resolve(cwd, '.env.local'))

import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllCandidatesByJobOpening, zohoFetch } from '@/lib/zoho/client'

const INTER_VACANCY_DELAY_MS = 300
const UPSERT_BATCH_SIZE = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface VacancyRef {
  id: string
  title: string
  association_type: 'formacion' | 'atraccion'
}

interface ZohoListResponse<T> {
  data: T[]
  info: {
    more_records: boolean
    per_page: number
    count: number
    page: number
  }
}

async function fetchAllZohoJobOpenings(): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
      '/Job_Openings',
      {
        fields: 'id,Job_Opening_Name,Date_Opened,Job_Opening_Status',
        per_page: '200',
        page: String(page),
      }
    )

    if (response.data && response.data.length > 0) {
      allItems.push(...response.data)
    }

    hasMore = response.info?.more_records ?? false
    page++

    if (hasMore) {
      await sleep(INTER_VACANCY_DELAY_MS)
    }
  }

  return allItems
}

// ── Phase 1 ─────────────────────────────────────────────────────────────────

async function phase1SyncFromVacancies(): Promise<{
  totalUpserted: number
  totalErrors: number
  vacanciesProcessed: number
}> {
  console.log('══════════════════════════════════════════════')
  console.log('PHASE 1: Sync history from all linked vacancies')
  console.log('══════════════════════════════════════════════\n')

  // 1a. Fetch all vacancies from promo_job_link_kpi
  const { data: promoLinks, error: promoErr } = await supabaseAdmin
    .from('promo_job_link_kpi')
    .select('job_opening_id, promocion_nombre')

  if (promoErr) {
    console.error('Failed to fetch promo_job_link_kpi:', promoErr.message)
    process.exit(1)
  }

  // 1b. Fetch job opening titles for promo-linked vacancies
  const promoVacancyIds = (promoLinks ?? [])
    .map((p) => p.job_opening_id)
    .filter((id): id is string => Boolean(id))

  let promoVacancies: VacancyRef[] = []
  if (promoVacancyIds.length > 0) {
    const { data: promoJobOpenings, error: pjoErr } = await supabaseAdmin
      .from('job_openings_kpi')
      .select('id, title')
      .in('id', promoVacancyIds)

    if (pjoErr) {
      console.error('Failed to fetch job_openings_kpi for promo links:', pjoErr.message)
      process.exit(1)
    }

    promoVacancies = (promoJobOpenings ?? []).map((jo) => ({
      id: jo.id,
      title: jo.title,
      association_type: 'formacion' as const,
    }))
  }

  console.log(`Promo-linked vacancies (formacion): ${promoVacancies.length}`)

  // 1c. Fetch atraccion vacancies
  const { data: atraccionVacancies, error: atracErr } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)

  if (atracErr) {
    console.error('Failed to fetch atraccion vacancies:', atracErr.message)
    process.exit(1)
  }

  const atraccionRefs: VacancyRef[] = (atraccionVacancies ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    association_type: 'atraccion' as const,
  }))

  console.log(`Atraccion vacancies (es_proceso_atraccion_actual): ${atraccionRefs.length}`)

  // 1d. Deduplicate — if a vacancy appears in both, prefer 'atraccion' type
  const vacancyMap = new Map<string, VacancyRef>()

  for (const v of promoVacancies) {
    vacancyMap.set(v.id, v)
  }
  for (const v of atraccionRefs) {
    // Atraccion wins over formacion if same ID appears in both
    vacancyMap.set(v.id, v)
  }

  const allVacancies = Array.from(vacancyMap.values())
  console.log(`Total unique vacancies to process: ${allVacancies.length}\n`)

  if (allVacancies.length === 0) {
    console.log('No vacancies found. Skipping Phase 1.\n')
    return { totalUpserted: 0, totalErrors: 0, vacanciesProcessed: 0 }
  }

  // 1e. For each vacancy, fetch candidates and upsert
  const fetchedAt = new Date().toISOString()
  let totalUpserted = 0
  let totalErrors = 0
  let vacanciesProcessed = 0

  for (let i = 0; i < allVacancies.length; i++) {
    const vacancy = allVacancies[i]

    console.log(
      `[${i + 1}/${allVacancies.length}] ${vacancy.title} (${vacancy.id}) [${vacancy.association_type}]`
    )

    try {
      const zohoRecords = await fetchAllCandidatesByJobOpening(vacancy.id)

      if (zohoRecords.length === 0) {
        console.log(`  → 0 candidates found in Zoho\n`)
        vacanciesProcessed++
        if (i < allVacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
        continue
      }

      console.log(`  → ${zohoRecords.length} candidates fetched from Zoho`)

      // Build rows
      const rows = zohoRecords.map((record) => ({
        candidate_id: String(record.id),
        candidate_name: (record.Full_Name as string) || null,
        zoho_record_id: String(record.id),
        job_opening_id: vacancy.id,
        job_opening_title: vacancy.title,
        candidate_status_in_jo: (record.Candidate_Status as string) || null,
        association_type: vacancy.association_type,
        fetched_at: fetchedAt,
      }))

      // Upsert in batches of UPSERT_BATCH_SIZE
      let batchUpserted = 0
      let batchErrors = 0
      const batchCount = Math.ceil(rows.length / UPSERT_BATCH_SIZE)

      for (let j = 0; j < rows.length; j += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(j, j + UPSERT_BATCH_SIZE)
        const batchNum = Math.floor(j / UPSERT_BATCH_SIZE) + 1

        const { error: upsertErr } = await supabaseAdmin
          .from('candidate_job_history_kpi')
          .upsert(batch, {
            onConflict: 'candidate_id,job_opening_id',
            ignoreDuplicates: false,
          })

        if (upsertErr) {
          console.error(
            `  ERROR upsert batch ${batchNum}/${batchCount}: ${upsertErr.message}`
          )
          batchErrors += batch.length
          totalErrors += batch.length
        } else {
          batchUpserted += batch.length
          totalUpserted += batch.length
        }
      }

      console.log(
        `  → Upserted: ${batchUpserted} | Errors: ${batchErrors} | Total so far: ${totalUpserted}\n`
      )

      vacanciesProcessed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR fetching from Zoho: ${message}\n`)
      totalErrors++
      vacanciesProcessed++
    }

    if (i < allVacancies.length - 1) await sleep(INTER_VACANCY_DELAY_MS)
  }

  console.log(`Phase 1 complete: ${totalUpserted} rows upserted, ${totalErrors} errors\n`)

  return { totalUpserted, totalErrors, vacanciesProcessed }
}

// ── Phase 2 ─────────────────────────────────────────────────────────────────

async function phase2FindMissingPromoVacancies(): Promise<void> {
  console.log('══════════════════════════════════════════════')
  console.log('PHASE 2: Find Promo 115/116 missing vacancies')
  console.log('══════════════════════════════════════════════\n')

  // Find candidates from Promo 115/116 who still have no history
  const { data: promo115_116Candidates, error: promoErr } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name, promocion_nombre')
    .in('promocion_nombre', ['Promo 115', 'Promo 116', '115', '116'])

  if (promoErr) {
    console.error('Failed to fetch Promo 115/116 candidates:', promoErr.message)
    return
  }

  if (!promo115_116Candidates || promo115_116Candidates.length === 0) {
    console.log('No Promo 115/116 candidates found — skipping Phase 2.\n')
    return
  }

  console.log(`Found ${promo115_116Candidates.length} Promo 115/116 candidates in candidates_kpi`)

  const promo115_116Ids = new Set(promo115_116Candidates.map((c) => c.id))

  // Check which of them already have history
  const { data: existingHistory, error: histErr } = await supabaseAdmin
    .from('candidate_job_history_kpi')
    .select('candidate_id')
    .in('candidate_id', Array.from(promo115_116Ids))

  if (histErr) {
    console.error('Failed to fetch existing history:', histErr.message)
    return
  }

  const idsWithHistory = new Set((existingHistory ?? []).map((h) => h.candidate_id))
  const idsWithoutHistory = Array.from(promo115_116Ids).filter((id) => !idsWithHistory.has(id))

  console.log(`  With history already: ${idsWithHistory.size}`)
  console.log(`  Without history: ${idsWithoutHistory.length}\n`)

  if (idsWithoutHistory.length === 0) {
    console.log('All Promo 115/116 candidates already have history — Phase 2 skipped.\n')
    return
  }

  const missingIds = new Set(idsWithoutHistory)

  console.log(
    `Fetching ALL active Job Openings from Zoho to find Promo 115/116 vacancies...`
  )
  console.log('  (This may take a moment)\n')

  let allZohoJobOpenings: Record<string, unknown>[]
  try {
    allZohoJobOpenings = await fetchAllZohoJobOpenings()
  } catch (err) {
    console.error(
      'Failed to fetch Zoho job openings:',
      err instanceof Error ? err.message : String(err)
    )
    return
  }

  console.log(`Fetched ${allZohoJobOpenings.length} job openings from Zoho`)
  console.log('Checking overlap with Promo 115/116 candidates...\n')

  const OVERLAP_THRESHOLD = 5
  const foundVacancies: Array<{ id: string; title: string; overlapCount: number }> = []

  for (let i = 0; i < allZohoJobOpenings.length; i++) {
    const jo = allZohoJobOpenings[i]
    const joId = String(jo.id ?? '')
    const joTitle = String(jo.Job_Opening_Name ?? jo.Posting_Title ?? '')

    if (!joId) continue

    // Skip job openings already in our database (we already processed those)
    const { count: existsInDb } = await supabaseAdmin
      .from('job_openings_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('id', joId)
      .then((r) => ({ count: r.count ?? 0 }))

    if (existsInDb > 0) continue

    // Fetch associated candidates for this job opening
    let candidates: Record<string, unknown>[]
    try {
      candidates = await fetchAllCandidatesByJobOpening(joId)
    } catch {
      // Some job openings may return errors — skip
      await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    if (candidates.length === 0) {
      await sleep(INTER_VACANCY_DELAY_MS)
      continue
    }

    // Check overlap with our missing Promo 115/116 candidate IDs
    const overlapCount = candidates.filter((c) => missingIds.has(String(c.id ?? ''))).length

    if (overlapCount >= OVERLAP_THRESHOLD) {
      foundVacancies.push({ id: joId, title: joTitle, overlapCount })
      console.log(
        `  FOUND Promo 115/116 vacancy: "${joTitle}" (${joId}) — ${overlapCount} matches`
      )
    }

    if (i % 20 === 0 && i > 0) {
      console.log(`  Checked ${i + 1}/${allZohoJobOpenings.length} job openings...`)
    }

    await sleep(INTER_VACANCY_DELAY_MS)
  }

  if (foundVacancies.length === 0) {
    console.log('\nNo matching vacancies found for Promo 115/116 candidates.')
    console.log(
      'Consider checking if these candidates are associated to a different vacancy in Zoho.'
    )
  } else {
    console.log('\n══ ACTION REQUIRED ══')
    console.log('Add these vacancies to promo_job_link_kpi to link them to their promo:\n')
    for (const v of foundVacancies) {
      console.log(`  INSERT INTO promo_job_link_kpi (job_opening_id, promocion_nombre)`)
      console.log(`  VALUES ('${v.id}', 'Promo 115');  -- "${v.title}" (${v.overlapCount} matches)`)
    }
  }

  console.log()
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Backfill candidate job history ===\n')

  // Baseline: how many candidates have history BEFORE we start
  const { count: beforeCount, error: beforeErr } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id', { count: 'exact', head: true })

  const { count: historyBeforeCount } = await supabaseAdmin
    .from('candidate_job_history_kpi')
    .select('candidate_id', { count: 'exact', head: true })

  const { data: noHistoryCandidatesBefore } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id')

  // Get IDs of candidates with existing history
  const { data: existingHistoryBefore } = await supabaseAdmin
    .from('candidate_job_history_kpi')
    .select('candidate_id')

  const idsWithHistoryBefore = new Set(
    (existingHistoryBefore ?? []).map((h) => h.candidate_id)
  )
  const candidatesWithoutHistoryBefore =
    (noHistoryCandidatesBefore ?? []).filter((c) => !idsWithHistoryBefore.has(c.id)).length

  if (!beforeErr) {
    console.log(`Total candidates in candidates_kpi: ${beforeCount ?? '?'}`)
    console.log(`Total history rows before: ${historyBeforeCount ?? '?'}`)
    console.log(`Candidates WITHOUT history before: ${candidatesWithoutHistoryBefore}\n`)
  }

  // ── Run phases ────────────────────────────────────────────────────────────
  const phase1Result = await phase1SyncFromVacancies()

  await phase2FindMissingPromoVacancies()

  // ── Final summary ─────────────────────────────────────────────────────────
  const { count: historyAfterCount } = await supabaseAdmin
    .from('candidate_job_history_kpi')
    .select('candidate_id', { count: 'exact', head: true })

  const { data: noHistoryCandidatesAfter } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id')

  const { data: existingHistoryAfter } = await supabaseAdmin
    .from('candidate_job_history_kpi')
    .select('candidate_id')

  const idsWithHistoryAfter = new Set(
    (existingHistoryAfter ?? []).map((h) => h.candidate_id)
  )
  const candidatesWithoutHistoryAfter =
    (noHistoryCandidatesAfter ?? []).filter((c) => !idsWithHistoryAfter.has(c.id)).length

  console.log('══════════════════════════════════════════════')
  console.log('PHASE 3: Summary')
  console.log('══════════════════════════════════════════════\n')
  console.log(`Vacancies processed: ${phase1Result.vacanciesProcessed}`)
  console.log(`History rows upserted: ${phase1Result.totalUpserted}`)
  console.log(`Errors: ${phase1Result.totalErrors}`)
  console.log()
  console.log(`History rows before: ${historyBeforeCount ?? '?'}`)
  console.log(`History rows after:  ${historyAfterCount ?? '?'}`)
  console.log()
  console.log(`Candidates without history BEFORE: ${candidatesWithoutHistoryBefore}`)
  console.log(`Candidates without history AFTER:  ${candidatesWithoutHistoryAfter}`)

  if (candidatesWithoutHistoryAfter > 0) {
    console.log(
      `\n⚠ ${candidatesWithoutHistoryAfter} candidates still have no history.`
    )
    console.log(
      'These may be from vacancies not yet linked in promo_job_link_kpi.'
    )
    console.log('Check Phase 2 output above for suggested vacancy IDs to add.\n')
  } else {
    console.log('\nAll candidates have at least one history entry.\n')
  }

  console.log('=== DONE ===')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
