/**
 * sync-germany-candidates.mjs
 *
 * Syncs Zoho tags and job history for Germany candidates.
 *
 * Usage:
 *   node sync-germany-candidates.mjs [--tags-only | --history-only]
 *
 * Sin argumento: ejecuta tags primero, luego historia.
 *
 * What it does:
 *   1. Tags: fetches all Zoho candidates (/Candidates?fields=Associated_Tags,...),
 *      filters those matching germany_candidates_kpi.zoho_candidate_id,
 *      and batch-updates tags.
 *
 *   2. History: for each Germany candidate, calls
 *      /Candidates/{id}/Associate_Job_Openings and stores
 *      [{job_opening_id, title, status}] as zoho_history JSONB.
 *      300ms delay between calls to respect Zoho rate limits.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Env loader (multi-line single-quoted values) ────────────────────────────
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

// ─── Zoho token (same pattern as backfill-zoho-job-numbers.mjs) ──────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function chunks(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// ─── STEP 1: Tags ─────────────────────────────────────────────────────────────
async function syncTags(token, base, germanyIds) {
  const germanyIdSet = new Set(germanyIds.map((r) => r.zoho_candidate_id))
  const tagsMap = new Map() // zoho_candidate_id → string[]

  console.log('\n[tags] Fetching all Zoho candidates with Associated_Tags...')

  let page = 1
  let hasMore = true
  let totalFetched = 0

  while (hasMore) {
    const url = new URL(`${base}/Candidates`)
    url.searchParams.set('fields', 'Candidate_ID,Associated_Tags')
    url.searchParams.set('per_page', '200')
    url.searchParams.set('page', String(page))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })

    if (res.status === 204 || res.status === 200 && res.headers.get('content-length') === '0') {
      break
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Zoho API ${res.status} on /Candidates page ${page}: ${body.slice(0, 200)}`)
    }

    const json = await res.json()
    const records = json.data ?? []
    totalFetched += records.length

    for (const record of records) {
      const candidateId = String(record.Candidate_ID ?? '')
      if (!candidateId || !germanyIdSet.has(candidateId)) continue

      const rawTags = record.Associated_Tags ?? []
      const tags = rawTags
        .map((t) => (typeof t === 'string' ? t : (t?.name ?? '')))
        .filter(Boolean)

      tagsMap.set(candidateId, tags)
    }

    hasMore = json.info?.more_records ?? false
    page++

    if (hasMore) await sleep(200)
  }

  console.log(`[tags] Fetched ${totalFetched} Zoho candidates, matched ${tagsMap.size} Germany candidates`)

  // Update in parallel batches of 50 (individual updates, not upsert — avoids NOT NULL constraint)
  let updated = 0
  const toUpdate = germanyIds.filter((r) => tagsMap.has(r.zoho_candidate_id))
  const batches = chunks(toUpdate, 50)

  for (const batch of batches) {
    const updatePromises = batch.map((r) =>
      supabase
        .from('germany_candidates_kpi')
        .update({ tags: tagsMap.get(r.zoho_candidate_id) ?? [] })
        .eq('id', r.id)
    )

    const results = await Promise.all(updatePromises)
    let batchOk = 0
    for (const { error } of results) {
      if (error) {
        console.error(`  [error] Tags update: ${error.message}`)
      } else {
        batchOk++
      }
    }
    updated += batchOk
  }

  console.log(`[tags] Done: updated=${updated}, no_match=${germanyIds.length - toUpdate.length}`)
  return { updated, no_match: germanyIds.length - toUpdate.length }
}

// ─── STEP 2: History ──────────────────────────────────────────────────────────
async function syncHistory(token, base, germanyRows) {
  const BATCH_SIZE = 20
  const DELAY_MS = 300

  console.log(`\n[history] Fetching job history for ${germanyRows.length} candidates...`)

  let updated = 0
  let skipped = 0
  let errors = 0

  const batches = chunks(germanyRows, BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]

    for (const row of batch) {
      const candidateId = row.zoho_candidate_id

      try {
        // Paginate over all associated job openings
        const allJobOpenings = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          const url = new URL(`${base}/Candidates/${candidateId}/Associate_Job_Openings`)
          url.searchParams.set('per_page', '200')
          url.searchParams.set('page', String(page))

          const res = await fetch(url.toString(), {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
          })

          // 204 or empty = no associations
          if (res.status === 204) {
            hasMore = false
            break
          }

          if (!res.ok) {
            const body = await res.text()
            // "no data" responses from Zoho for candidates with no history
            if (res.status === 204 || body.includes('no data') || body.includes('INVALID_DATA')) {
              hasMore = false
              break
            }
            throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
          }

          const text = await res.text()
          if (!text || text.trim().length === 0) {
            hasMore = false
            break
          }

          let json
          try {
            json = JSON.parse(text)
          } catch {
            hasMore = false
            break
          }

          const records = json.data ?? []
          for (const record of records) {
            const id = String(record.id ?? record.Job_Opening_ID ?? '')
            const title = String(record.Job_Opening_Name ?? record.Posting_Title ?? record.id ?? '')
            const status = record.Job_Opening_Status ?? null

            if (id) allJobOpenings.push({ job_opening_id: id, title, status })
          }

          hasMore = json.info?.more_records ?? false
          page++
          if (hasMore) await sleep(DELAY_MS)
        }

        const newHistory = allJobOpenings
        const existingJson = JSON.stringify(row.zoho_history ?? [])
        const newJson = JSON.stringify(newHistory)

        if (existingJson === newJson) {
          skipped++
          await sleep(DELAY_MS)
          continue
        }

        const { error: updateError } = await supabase
          .from('germany_candidates_kpi')
          .update({
            zoho_history: newHistory,
            zoho_synced_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        if (updateError) {
          console.error(`  [error] ${candidateId}: ${updateError.message}`)
          errors++
        } else {
          updated++
          if (updated <= 5 || updated % 50 === 0) {
            console.log(`  [ok] ${candidateId} → ${newHistory.length} job openings`)
          }
        }
      } catch (err) {
        console.error(`  [error] ${candidateId}: ${err.message}`)
        errors++
      }

      await sleep(DELAY_MS)
    }

    const done = Math.min((batchIdx + 1) * BATCH_SIZE, germanyRows.length)
    console.log(
      `[history] Progress: ${done}/${germanyRows.length} — updated=${updated}, skipped=${skipped}, errors=${errors}`
    )
  }

  console.log(`[history] Done: updated=${updated}, skipped=${skipped}, errors=${errors}`)
  return { updated, skipped, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2] ?? ''
  const tagsOnly = arg === '--tags-only'
  const historyOnly = arg === '--history-only'

  console.log(`\n╔══════════════════════════════════════════════════════╗`)
  console.log(`║  Germany Zoho Sync — ${new Date().toISOString().slice(0, 16)}          ║`)
  console.log(`╚══════════════════════════════════════════════════════╝`)

  const token = await getToken()
  const base = (process.env.ZOHO_API_BASE_URL || '').replace(/\/$/, '')

  if (!base) {
    console.error('Missing ZOHO_API_BASE_URL')
    process.exit(1)
  }

  // Fetch all Germany candidates with zoho_candidate_id populated
  console.log('\n[main] Loading Germany candidates from Supabase...')
  const PAGE_SIZE = 1000
  let from = 0
  const germanyRows = []

  while (true) {
    const { data, error } = await supabase
      .from('germany_candidates_kpi')
      .select('id, zoho_candidate_id, zoho_history')
      .not('zoho_candidate_id', 'is', null)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[main] Supabase fetch error:', error.message)
      process.exit(1)
    }

    const rows = data ?? []
    for (const r of rows) germanyRows.push(r)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  console.log(`[main] Found ${germanyRows.length} Germany candidates with zoho_candidate_id`)

  const results = {}

  if (!historyOnly) {
    results.tags = await syncTags(token, base, germanyRows)
  }

  if (!tagsOnly) {
    results.history = await syncHistory(token, base, germanyRows)
  }

  console.log('\n╔══════ RESUMEN FINAL ══════╗')
  if (results.tags) {
    console.log(`  Tags    : updated=${results.tags.updated}, no_match=${results.tags.no_match}`)
  }
  if (results.history) {
    console.log(
      `  History : updated=${results.history.updated}, skipped=${results.history.skipped}, errors=${results.history.errors}`
    )
  }
  console.log('╚═══════════════════════════╝\n')
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
