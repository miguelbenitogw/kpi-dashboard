/**
 * One-shot backfill: compute candidate-status counts for ALL closed vacancies via Zoho API.
 *
 * Usage:
 *   cd kpi-dashboard
 *   npx tsx src/scripts/backfill-vacancy-status-counts.ts
 *
 * What it does:
 *   1. Reads closed vacancy IDs from job_openings_kpi (is_active = false)
 *   2. Skips vacancies that already have data in vacancy_status_counts_kpi
 *   3. For each vacancy: calls Zoho /Job_Openings/{id}/associate to get associated candidates
 *   4. Reads each candidate's Candidate_Status field
 *   5. Aggregates status counts per vacancy
 *   6. Upserts to vacancy_status_counts_kpi
 *
 * Rate-limited: 200ms between Zoho API calls.
 * Progress is logged so you can restart if it times out — already-processed vacancies are skipped.
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
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'

const BATCH_SIZE = 30
const RATE_LIMIT_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('=== Backfill vacancy status counts (closed vacancies) ===\n')

  // ── Step 1: Get all closed vacancy IDs ──────────────────────────────────
  const { data: closedVacancies, error: vacErr } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('is_active', false)
    .order('title', { ascending: true })

  if (vacErr || !closedVacancies) {
    console.error('Failed to fetch closed vacancies:', vacErr?.message)
    process.exit(1)
  }

  console.log(`Found ${closedVacancies.length} closed vacancies total`)

  // ── Step 2: Skip vacancies already processed ─────────────────────────────
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('vacancy_status_counts_kpi')
    .select('vacancy_id')

  if (existErr) {
    console.error('Failed to check existing status counts:', existErr.message)
    process.exit(1)
  }

  const alreadyDone = new Set((existing ?? []).map((r) => r.vacancy_id))

  // Only keep closed vacancies not yet in the table
  const toProcess = closedVacancies.filter((v) => !alreadyDone.has(v.id))

  console.log(`Already processed (any vacancy): ${alreadyDone.size}`)
  console.log(`Closed vacancies to process: ${toProcess.length}\n`)

  if (toProcess.length === 0) {
    console.log('Nothing to do — all closed vacancies already have status counts.')
    process.exit(0)
  }

  // ── Step 3: Process in batches ───────────────────────────────────────────
  let totalProcessed = 0
  let totalUpserted = 0
  let totalErrors = 0
  let totalSkippedEmpty = 0

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE)

    console.log(`--- Batch ${batchNum}/${totalBatches} (${batch.length} vacancies) ---`)

    for (const vacancy of batch) {
      try {
        // Fetch all candidates associated to this vacancy from Zoho
        const candidates = await fetchAllCandidatesByJobOpening(vacancy.id)

        if (candidates.length === 0) {
          totalSkippedEmpty++
          totalProcessed++
          await sleep(RATE_LIMIT_MS)
          continue
        }

        // Aggregate counts by Candidate_Status
        const statusMap = new Map<string, number>()
        for (const c of candidates) {
          const status = (c.Candidate_Status as string) ?? 'Sin estado'
          statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
        }

        if (statusMap.size === 0) {
          totalSkippedEmpty++
          totalProcessed++
          await sleep(RATE_LIMIT_MS)
          continue
        }

        // Build rows and upsert
        const now = new Date().toISOString()
        const rows = Array.from(statusMap.entries()).map(([status, count]) => ({
          vacancy_id: vacancy.id,
          status,
          count,
          synced_at: now,
        }))

        const { error: upsertErr } = await supabaseAdmin
          .from('vacancy_status_counts_kpi')
          .upsert(rows, { onConflict: 'vacancy_id,status' })

        if (upsertErr) {
          console.error(`  ERROR upsert ${vacancy.title} (${vacancy.id}): ${upsertErr.message}`)
          totalErrors++
        } else {
          totalUpserted += rows.length
          console.log(
            `  OK  ${vacancy.title.slice(0, 50)} — ${candidates.length} candidatos, ${rows.length} estados`
          )
        }

        totalProcessed++
      } catch (err) {
        console.error(
          `  ERROR ${vacancy.title} (${vacancy.id}): ${err instanceof Error ? err.message : String(err)}`
        )
        totalErrors++
        totalProcessed++
      }

      await sleep(RATE_LIMIT_MS)
    }

    console.log(
      `  Progress: ${totalProcessed}/${toProcess.length} | Upserted rows: ${totalUpserted} | Empty: ${totalSkippedEmpty} | Errors: ${totalErrors}\n`
    )
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('=== DONE ===')
  console.log(`Vacancies processed: ${totalProcessed}`)
  console.log(`Status rows upserted: ${totalUpserted}`)
  console.log(`Vacancies with no candidates: ${totalSkippedEmpty}`)
  console.log(`Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
