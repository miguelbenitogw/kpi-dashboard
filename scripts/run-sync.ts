/**
 * scripts/run-sync.ts
 *
 * Runs the full daily sync locally: job openings + candidate associations.
 * Uses .env.local credentials — same logic as /api/cron/sync.
 *
 * Usage: npx tsx --env-file=.env.local scripts/run-sync.ts
 */

import { syncJobOpenings } from '../src/lib/zoho/sync-job-openings'
import { syncCandidatesForActiveVacancies } from '../src/lib/zoho/sync-candidates'

async function main() {
  console.log('='.repeat(60))
  console.log('KPI Dashboard — Manual Sync')
  console.log(new Date().toISOString())
  console.log('='.repeat(60))

  // ── Step 1: Job openings ─────────────────────────────────────
  console.log('\n[1/2] Syncing job openings (active only)…')
  const t1 = Date.now()

  const joResult = await syncJobOpenings('active_only')

  console.log(`  ✓ synced:          ${joResult.synced}`)
  console.log(`  · skipped inactive: ${joResult.skipped_inactive}`)
  console.log(`  · api calls:        ${joResult.api_calls}`)
  if (joResult.errors.length > 0) {
    console.log(`  ⚠ errors (${joResult.errors.length}):`)
    joResult.errors.forEach((e) => console.log(`    - ${e}`))
  }
  console.log(`  ⏱ ${Date.now() - t1} ms`)

  // ── Step 2: Candidate associations ──────────────────────────
  console.log('\n[2/2] Syncing candidates for active vacancies…')
  const t2 = Date.now()

  const candResult = await syncCandidatesForActiveVacancies()

  console.log(`  ✓ vacancies processed:   ${candResult.vacancies_processed}`)
  console.log(`  ✓ candidates synced:     ${candResult.candidates_synced}`)
  console.log(`  ✓ status changes logged: ${candResult.status_changes_logged}`)
  console.log(`  · api calls:             ${candResult.api_calls}`)
  if (candResult.errors.length > 0) {
    console.log(`  ⚠ errors (${candResult.errors.length}):`)
    candResult.errors.forEach((e) => console.log(`    - ${e}`))
  }
  console.log(`  ⏱ ${Date.now() - t2} ms`)

  // ── Summary ──────────────────────────────────────────────────
  const allErrors = [...joResult.errors, ...candResult.errors]
  console.log('\n' + '='.repeat(60))
  console.log(allErrors.length === 0 ? '✅ Sync completed successfully' : `⚠️  Sync completed with ${allErrors.length} error(s)`)
  console.log('='.repeat(60))

  process.exit(allErrors.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
