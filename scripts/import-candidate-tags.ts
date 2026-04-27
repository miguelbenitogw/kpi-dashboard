/**
 * scripts/import-candidate-tags.ts
 *
 * Imports Associated_Tags from Zoho candidates into the tags column
 * of candidates_kpi in Supabase. Only updates rows that already exist.
 *
 * Usage: npx tsx scripts/import-candidate-tags.ts
 */

// Load .env.local FIRST using @next/env (handles multiline values like GOOGLE JSON)
import { loadEnvConfig } from '@next/env'
const projectDir = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
loadEnvConfig(projectDir)

import { fetchCandidates } from '../src/lib/zoho/client'
import { supabaseAdmin } from '../src/lib/supabase/server'

const BATCH_SIZE = 50

interface TagObject {
  name: string
  id: string
}

function extractTags(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((t) => {
        if (typeof t === 'string') return t.trim()
        if (typeof t === 'object' && t !== null && 'name' in t) {
          return String((t as TagObject).name).trim()
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [raw.trim()]
  }
  return []
}

async function main() {
  console.log('='.repeat(60))
  console.log('KPI Dashboard — Import Candidate Tags from Zoho')
  console.log(new Date().toISOString())
  console.log('='.repeat(60))

  // ── Step 1: Fetch all candidates from Zoho ───────────────────
  console.log('\n[1/4] Fetching all candidates from Zoho...')
  const t1 = Date.now()
  const zohoRecords = await fetchCandidates()
  console.log(`  -> ${zohoRecords.length} candidates fetched (${Date.now() - t1} ms)`)

  // ── Step 2: Extract tags ──────────────────────────────────────
  console.log('\n[2/4] Extracting tags from Zoho records...')
  const withTags = zohoRecords
    .map((r) => ({
      id: String(r.id),
      tags: extractTags(r.Associated_Tags),
    }))
    .filter((c) => c.tags.length > 0)

  console.log(`  -> ${withTags.length} of ${zohoRecords.length} candidates have tags`)

  if (withTags.length === 0) {
    console.log('\nNo candidates with tags found in Zoho. Nothing to update.')
    process.exit(0)
  }

  // ── Step 3: Get existing IDs from candidates_kpi ─────────────
  console.log('\n[3/4] Fetching existing IDs from candidates_kpi...')
  const t3 = Date.now()

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id')

  if (fetchError) {
    throw new Error(`Failed to fetch existing candidates: ${fetchError.message}`)
  }

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id))
  console.log(`  -> ${existingIds.size} candidates exist in candidates_kpi (${Date.now() - t3} ms)`)

  // ── Step 4: Update in batches ─────────────────────────────────
  const toUpdate = withTags.filter((c) => existingIds.has(c.id))
  const skippedNotFound = withTags.length - toUpdate.length

  console.log(`\n[4/4] Updating ${toUpdate.length} candidates in batches of ${BATCH_SIZE}...`)
  if (skippedNotFound > 0) {
    console.log(`  -> ${skippedNotFound} skipped (not in candidates_kpi)`)
  }

  let updated = 0
  let errors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(toUpdate.length / BATCH_SIZE)

    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} records)... `)

    // Supabase upsert with onConflict on id — only updates existing rows
    const { error: upsertError } = await supabaseAdmin
      .from('candidates_kpi')
      .upsert(
        batch.map((c) => ({ id: c.id, tags: c.tags })),
        { onConflict: 'id', ignoreDuplicates: false }
      )

    if (upsertError) {
      console.log('ERROR')
      errors += batch.length
      errorDetails.push(`Batch ${batchNum}: ${upsertError.message}`)
    } else {
      console.log('OK')
      updated += batch.length
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`  Zoho total candidates:      ${zohoRecords.length}`)
  console.log(`  Zoho candidates with tags:  ${withTags.length}`)
  console.log(`  Existing in candidates_kpi: ${existingIds.size}`)
  console.log(`  Skipped (not in table):     ${skippedNotFound}`)
  console.log(`  Successfully updated:       ${updated}`)
  console.log(`  Errors:                     ${errors}`)

  if (errorDetails.length > 0) {
    console.log('\nError details:')
    errorDetails.forEach((e) => console.log(`  - ${e}`))
  }

  console.log('='.repeat(60))

  if (errors > 0) {
    console.log('COMPLETED WITH ERRORS')
    process.exit(1)
  } else {
    console.log('COMPLETED SUCCESSFULLY')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
