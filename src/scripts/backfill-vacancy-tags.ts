/**
 * One-shot backfill: compute tag counts for ALL closed vacancies via Zoho API.
 *
 * Usage:
 *   cd kpi-dashboard
 *   npx tsx src/scripts/backfill-vacancy-tags.ts
 *
 * What it does:
 *   1. Reads closed vacancy IDs from job_openings_kpi (is_active = false)
 *   2. Skips vacancies that already have data in vacancy_tag_counts_kpi
 *   3. For each vacancy (in batches of 30): calls Zoho API to get associated candidates
 *   4. Reads each candidate's Associated_Tags
 *   5. Aggregates tag counts per vacancy
 *   6. Writes to vacancy_tag_counts_kpi
 *
 * Rate-limited: 200ms between Zoho API calls.
 * Progress is logged so you can restart if it times out.
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      // Vercel CLI adds literal \n at end of some values — strip it
      value = value.replace(/\\n$/g, '').trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch { /* file doesn't exist, skip */ }
}

const cwd = process.cwd()
// Production-local has all the real keys — load it first
loadEnvFile(resolve(cwd, '.env.production-local'))
loadEnvFile(resolve(cwd, '.env.local'))

import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllCandidatesByJobOpening, fetchCandidates } from '@/lib/zoho/client'

const BATCH_SIZE = 30

async function main() {
  console.log('=== Backfill vacancy tag counts (closed vacancies) ===\n')

  // ── Step 1: Get all closed vacancy IDs ──────────────────────────────────
  const { data: closedVacancies, error: vacErr } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('is_active', false)

  if (vacErr || !closedVacancies) {
    console.error('Failed to fetch closed vacancies:', vacErr?.message)
    process.exit(1)
  }

  console.log(`Found ${closedVacancies.length} closed vacancies total`)

  // ── Step 2: Skip vacancies already processed ─────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('vacancy_tag_counts_kpi')
    .select('vacancy_id')

  const alreadyDone = new Set((existing ?? []).map((r) => r.vacancy_id))
  const toProcess = closedVacancies.filter((v) => !alreadyDone.has(v.id))

  console.log(`Already processed: ${alreadyDone.size}`)
  console.log(`To process: ${toProcess.length}\n`)

  if (toProcess.length === 0) {
    console.log('Nothing to do — all closed vacancies already have tag counts.')
    process.exit(0)
  }

  // ── Step 3: Pre-fetch ALL candidates from Zoho (bulk, paginated) ─────────
  console.log('Pre-fetching all candidates from Zoho for tag lookup...')
  const allCandidates = await fetchCandidates()
  console.log(`Fetched ${allCandidates.length} candidates from Zoho\n`)

  // Build map: 18-digit Zoho ID → tag names
  const candidateTagMap = new Map<string, string[]>()
  for (const record of allCandidates) {
    const zohoId = String(record.id ?? '')
    if (!zohoId) continue

    const rawTags = record.Associated_Tags as
      | Array<string | { name: string }>
      | null
      | undefined

    const tags = (rawTags ?? [])
      .map((t) => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
      .filter(Boolean)

    if (tags.length > 0) {
      candidateTagMap.set(zohoId, tags)
    }
  }

  console.log(`Candidates with tags: ${candidateTagMap.size}\n`)

  // ── Step 4: Process in batches ───────────────────────────────────────────
  let totalProcessed = 0
  let totalUpserted = 0
  let totalErrors = 0

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE)

    console.log(`--- Batch ${batchNum}/${totalBatches} (${batch.length} vacancies) ---`)

    for (const vacancy of batch) {
      try {
        // Get associated candidates for this vacancy from Zoho
        const associated = await fetchAllCandidatesByJobOpening(vacancy.id)

        if (associated.length === 0) {
          totalProcessed++
          continue
        }

        // Aggregate tags
        const tagCounts = new Map<string, number>()
        for (const candidate of associated) {
          const zohoId = String(candidate.id ?? '')
          if (!zohoId) continue

          const tags = candidateTagMap.get(zohoId) ?? []
          for (const tag of tags) {
            tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
          }
        }

        if (tagCounts.size === 0) {
          totalProcessed++
          continue
        }

        // Build rows and upsert
        const now = new Date().toISOString()
        const rows = Array.from(tagCounts.entries()).map(([tag, count]) => ({
          vacancy_id: vacancy.id,
          tag,
          count,
          synced_at: now,
        }))

        const { error: upsertErr } = await supabaseAdmin
          .from('vacancy_tag_counts_kpi')
          .upsert(rows, { onConflict: 'vacancy_id,tag' })

        if (upsertErr) {
          console.error(`  ERROR ${vacancy.id}: ${upsertErr.message}`)
          totalErrors++
        } else {
          totalUpserted += rows.length
        }

        totalProcessed++
      } catch (err) {
        console.error(`  ERROR ${vacancy.id}: ${err instanceof Error ? err.message : String(err)}`)
        totalErrors++
        totalProcessed++
      }
    }

    console.log(`  Processed: ${totalProcessed}/${toProcess.length} | Tags upserted: ${totalUpserted} | Errors: ${totalErrors}\n`)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('=== DONE ===')
  console.log(`Vacancies processed: ${totalProcessed}`)
  console.log(`Tag rows upserted: ${totalUpserted}`)
  console.log(`Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
