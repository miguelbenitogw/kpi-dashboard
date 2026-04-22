/**
 * One-shot backfill: sync tags from Zoho Recruit into candidates_kpi.tags.
 *
 * Usage:
 *   cd kpi-dashboard
 *   npx tsx src/scripts/backfill-candidate-tags.ts
 *
 * What it does:
 *   1. Deletes the garbage header row (id = "ID") if it exists
 *   2. Fetches all candidates from candidates_kpi (id, full_name, tags)
 *   3. Fetches ALL candidates from Zoho (90K+) with Associated_Tags
 *   4. Builds a map: zohoId → tags[]
 *   5. For each candidate in candidates_kpi, looks up tags by ID
 *   6. UPDATEs candidates_kpi.tags only when tags differ
 *   7. Reports: updated, skipped (same), not found in Zoho
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
import { fetchCandidates } from '@/lib/zoho/client'

const SUPABASE_BATCH_SIZE = 100

async function main() {
  console.log('=== Backfill candidate tags from Zoho ===\n')

  // ── Step 0: Delete garbage header row ─────────────────────────────────────
  console.log('Cleaning up garbage header row (id = "ID")...')
  const { error: deleteErr } = await supabaseAdmin
    .from('candidates_kpi')
    .delete()
    .eq('id', 'ID')

  if (deleteErr) {
    console.warn(`  Warning: Could not delete garbage row: ${deleteErr.message}`)
  } else {
    console.log('  Done (deleted if it existed)\n')
  }

  // ── Step 1: Fetch all candidates from Supabase ────────────────────────────
  console.log('Fetching all candidates from candidates_kpi...')
  const { data: supabaseCandidates, error: supErr } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name, tags')

  if (supErr || !supabaseCandidates) {
    console.error('Failed to fetch candidates from Supabase:', supErr?.message)
    process.exit(1)
  }

  console.log(`Found ${supabaseCandidates.length} candidates in candidates_kpi\n`)

  const candidatesWithTags = supabaseCandidates.filter(
    (c) => c.tags && c.tags.length > 0
  ).length
  const candidatesWithoutTags = supabaseCandidates.length - candidatesWithTags
  console.log(`  With tags: ${candidatesWithTags}`)
  console.log(`  Without tags: ${candidatesWithoutTags}\n`)

  // ── Step 2: Fetch ALL candidates from Zoho ────────────────────────────────
  console.log('Pre-fetching all candidates from Zoho for tag lookup...')
  console.log('  (This fetches 90K+ records — may take a few minutes)\n')
  const allZohoCandidates = await fetchCandidates()
  console.log(`Fetched ${allZohoCandidates.length} candidates from Zoho\n`)

  // ── Step 3: Build zohoId → tags[] map ─────────────────────────────────────
  const zohoTagMap = new Map<string, string[]>()
  for (const record of allZohoCandidates) {
    const zohoId = String(record.id ?? '')
    if (!zohoId) continue

    const rawTags = record.Associated_Tags as
      | Array<string | { name: string }>
      | null
      | undefined

    const tags = (rawTags ?? [])
      .map((t) => (typeof t === 'string' ? t : ((t as { name: string }).name ?? '')))
      .filter(Boolean)

    // Always set — even empty arrays are useful to know "we looked it up"
    zohoTagMap.set(zohoId, tags)
  }

  console.log(`Zoho candidates mapped: ${zohoTagMap.size}`)
  console.log(
    `Zoho candidates with tags: ${
      Array.from(zohoTagMap.values()).filter((t) => t.length > 0).length
    }\n`
  )

  // ── Step 4: Determine which candidates need updates ───────────────────────
  type UpdateRow = { id: string; full_name: string | null; newTags: string[] }
  const toUpdate: UpdateRow[] = []
  let skippedSame = 0
  let notFoundInZoho = 0

  for (const candidate of supabaseCandidates) {
    const zohoTags = zohoTagMap.get(candidate.id)

    if (zohoTags === undefined) {
      // Candidate ID not found in Zoho at all
      notFoundInZoho++
      continue
    }

    const currentTags = candidate.tags ?? []

    // Compare: sort both to ignore ordering differences
    const currentSorted = [...currentTags].sort().join('|')
    const newSorted = [...zohoTags].sort().join('|')

    if (currentSorted === newSorted) {
      skippedSame++
      continue
    }

    toUpdate.push({ id: candidate.id, full_name: candidate.full_name, newTags: zohoTags })
  }

  console.log(`Candidates to update: ${toUpdate.length}`)
  console.log(`Candidates already up-to-date: ${skippedSame}`)
  console.log(`Candidates not found in Zoho: ${notFoundInZoho}\n`)

  if (toUpdate.length === 0) {
    console.log('Nothing to update — all tags are already in sync.')
    process.exit(0)
  }

  // ── Step 5: Update Supabase in batches ───────────────────────────────────
  console.log(`Updating ${toUpdate.length} candidates in batches of ${SUPABASE_BATCH_SIZE}...\n`)

  let totalUpdated = 0
  let totalErrors = 0
  const totalBatches = Math.ceil(toUpdate.length / SUPABASE_BATCH_SIZE)

  for (let i = 0; i < toUpdate.length; i += SUPABASE_BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + SUPABASE_BATCH_SIZE)
    const batchNum = Math.floor(i / SUPABASE_BATCH_SIZE) + 1

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} candidates)... `)

    for (const candidate of batch) {
      const { error: updateErr } = await supabaseAdmin
        .from('candidates_kpi')
        .update({ tags: candidate.newTags } as any)
        .eq('id', candidate.id)

      if (updateErr) {
        console.error(
          `\n  ERROR updating ${candidate.id} (${candidate.full_name ?? 'unknown'}): ${updateErr.message}`
        )
        totalErrors++
      } else {
        totalUpdated++
      }
    }

    console.log(`done (updated: ${totalUpdated}, errors: ${totalErrors})`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== DONE ===')
  console.log(`Candidates updated: ${totalUpdated}`)
  console.log(`Candidates already in sync: ${skippedSame}`)
  console.log(`Candidates not found in Zoho: ${notFoundInZoho}`)
  console.log(`Errors: ${totalErrors}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
