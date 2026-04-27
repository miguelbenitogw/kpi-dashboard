/**
 * One-shot script: sync Associated_Tags from Zoho → candidates_kpi.tags
 * Run: npx tsx scripts/sync-tags.ts
 *
 * Uses dynamic import so env vars are loaded BEFORE the Supabase/Zoho clients initialize.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// 1. Load .env.local manually before anything else accesses process.env
const envPath = resolve(process.cwd(), '.env.production-local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const raw = trimmed.slice(eqIdx + 1).trim()
  // Strip surrounding quotes if present
  const val = raw.replace(/^["']|["']$/g, '')
  if (key && !(key in process.env)) {
    process.env[key] = val
  }
}

// 2. Dynamic import so clients initialize AFTER env is set
async function main() {
  // Debug: verify env loaded
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ SET' : '✗ MISSING')
  console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SET' : '✗ MISSING')
  console.log('ZOHO_TOKEN_URL:', process.env.ZOHO_TOKEN_URL ? '✓ SET' : '✗ MISSING')
  console.log('ZOHO_CLIENT_ID:', process.env.ZOHO_CLIENT_ID ? '✓ SET' : '✗ MISSING')

  const { syncCandidateTags } = await import('../src/lib/zoho/sync-candidate-tags')

  console.log('⏳ Fetching candidates from Zoho...')

  try {
    const result = await syncCandidateTags()

    console.log('\n✅ Sync complete')
    console.log(`   Zoho candidates fetched  : ${result.total_fetched}`)
    console.log(`   Updated in candidates_kpi : ${result.updated}`)
    console.log(`   Skipped (no match in DB)  : ${result.skipped_no_match}`)
    console.log(`   API calls used            : ${result.api_calls}`)

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      result.errors.forEach((e) => console.log('  -', e))
    }
  } catch (err) {
    console.error('❌ Fatal error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
