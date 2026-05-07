/**
 * Backfill zoho_job_number in job_openings_kpi.
 *
 * For each row with zoho_job_number IS NULL, fetches Job_Opening_ID from Zoho
 * and updates the row in Supabase.
 *
 * Usage:
 *   node backfill-zoho-job-numbers.mjs
 *
 * Rate limiting: 5 concurrent requests, 200ms delay between each.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Env loader (identical to inspect-zoho-vacancy.mjs) ─────────────────────
function loadEnv() {
  const env = {}
  for (const file of ['.env.production-local', '.env.local']) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
      const lines = content.split(/\r?\n/)
      let i = 0
      while (i < lines.length) {
        const line = lines[i]
        const eqIdx = line.indexOf('=')
        if (eqIdx < 0 || line.trim().startsWith('#')) { i++; continue }
        const key = line.slice(0, eqIdx).trim()
        let val = line.slice(eqIdx + 1)

        // Multi-line single-quoted value: KEY='...'
        if (val.startsWith("'")) {
          let raw = val.slice(1)
          while (!raw.endsWith("'") && i + 1 < lines.length) {
            i++
            raw += '\n' + lines[i]
          }
          val = raw.endsWith("'") ? raw.slice(0, -1) : raw
        } else {
          val = val.trim()
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        }

        // Strip literal \n that some .env editors append
        val = val.replace(/\\n$/, '').trim()
        if (!env[key]) env[key] = val
        i++
      }
    } catch {}
  }
  return env
}

const env = loadEnv()
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v
}

// ─── Supabase (service role) ─────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Zoho token (same pattern as inspect-zoho-vacancy.mjs) ───────────────────
async function getToken() {
  const { data } = await supabase
    .from('dashboard_config_kpi')
    .select('config_value')
    .eq('config_key', 'zoho_token')
    .single()

  if (data?.config_value) {
    const cfg = typeof data.config_value === 'string'
      ? JSON.parse(data.config_value)
      : data.config_value
    const expiry = new Date(cfg.expires_at).getTime()
    if (Date.now() < expiry - 5 * 60 * 1000) {
      console.log('[token] Using stored token (expires:', cfg.expires_at, ')')
      return cfg.access_token
    }
  }

  console.log('[token] Refreshing...')
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  })
  const res = await fetch(process.env.ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const tok = await res.json()
  if (!tok.access_token) throw new Error('No access_token: ' + JSON.stringify(tok))

  const expires_at = new Date(Date.now() + tok.expires_in * 1000).toISOString()
  await supabase.from('dashboard_config_kpi').upsert({
    config_key: 'zoho_token',
    config_value: { access_token: tok.access_token, expires_at, scope: tok.scope || '' },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'config_key' })

  return tok.access_token
}

// ─── Fetch Job_Opening_ID for a single vacancy ───────────────────────────────
async function fetchJobOpeningID(token, base, vacancyId) {
  const url = `${base}/JobOpenings/${vacancyId}`
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  // Zoho returns { data: [ { ...fields } ] } for single-record endpoints
  const record = Array.isArray(json.data) ? json.data[0] : json.data
  if (!record) throw new Error('Empty response data')

  const raw = record.Job_Opening_ID
  if (raw == null) return null

  const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(num) ? num : null
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const token = await getToken()
  const base = (process.env.ZOHO_API_BASE_URL || '').replace(/\/$/, '')

  if (!base) {
    console.error('Missing ZOHO_API_BASE_URL')
    process.exit(1)
  }

  // Paginate over all rows with zoho_job_number IS NULL
  const PAGE_SIZE = 1000
  let from = 0
  const allIds = []

  console.log('\n[backfill] Fetching rows with zoho_job_number IS NULL...')

  while (true) {
    const { data, error } = await supabase
      .from('job_openings_kpi')
      .select('id')
      .is('zoho_job_number', null)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[backfill] Supabase fetch error:', error.message)
      process.exit(1)
    }

    const rows = data ?? []
    for (const r of rows) allIds.push(r.id)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  console.log(`[backfill] Found ${allIds.length} rows to backfill.\n`)

  if (allIds.length === 0) {
    console.log('[backfill] Nothing to do. All rows already have zoho_job_number.')
    return
  }

  // Process in batches of 5 with 200ms delay between each request
  const BATCH_SIZE = 5
  const DELAY_MS = 200

  let updated = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE)

    for (const vacancyId of batch) {
      try {
        const jobNumber = await fetchJobOpeningID(token, base, vacancyId)

        if (jobNumber == null) {
          console.log(`  [skip] ${vacancyId} — Job_Opening_ID not found or null`)
          skipped++
        } else {
          const { error: upsertError } = await supabase
            .from('job_openings_kpi')
            .update({ zoho_job_number: jobNumber })
            .eq('id', vacancyId)

          if (upsertError) {
            console.error(`  [error] ${vacancyId} — Supabase upsert failed: ${upsertError.message}`)
            errors++
          } else {
            console.log(`  [ok] ${vacancyId} → #${jobNumber}`)
            updated++
          }
        }
      } catch (err) {
        console.error(`  [error] ${vacancyId} — ${err.message}`)
        errors++
      }

      await sleep(DELAY_MS)
    }

    const done = Math.min(i + BATCH_SIZE, allIds.length)
    console.log(`[backfill] Progress: ${done}/${allIds.length} (updated=${updated}, skipped=${skipped}, errors=${errors})`)
  }

  console.log(`\n[backfill] Done. updated=${updated}, skipped=${skipped}, errors=${errors}`)
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
