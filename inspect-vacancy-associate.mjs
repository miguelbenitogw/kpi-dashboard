/**
 * Inspects the /Job_Openings/{id}/associate endpoint to see what date fields
 * Zoho returns for each candidate association.
 *
 * This is the EXACT endpoint used by fetchCandidatesByJobOpening() in client.ts.
 * Key question: does Zoho return Created_Time (candidate creation date) or
 * a date reflecting when the candidate was ASSOCIATED to this vacancy?
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Env loader (same pattern as inspect-zoho-vacancy.mjs) ───────────────────
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

// ─── Supabase admin ───────────────────────────────────────────────────────────
// Read AFTER env is loaded (top-level await not needed — we read process.env directly)
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', url)
    console.error('KEY exists:', !!key)
    process.exit(1)
  }

  return createClient(url, key)
}

const supabase = getSupabaseClient()

// ─── Get Zoho token ───────────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const token = await getToken()
  const base = (process.env.ZOHO_API_BASE_URL || '').replace(/\/$/, '')

  // Step 1: get an active vacancy ID from Supabase
  console.log('\n[1] Fetching active vacancy from Supabase...')
  const { data: vacancy, error: vacError } = await supabase
    .from('job_openings_kpi')
    .select('id, title, total_candidates')
    .eq('es_proceso_atraccion_actual', true)
    .gt('total_candidates', 0)
    .order('total_candidates', { ascending: false })
    .limit(1)
    .single()

  if (vacError || !vacancy) {
    console.error('Could not find active vacancy:', vacError?.message)
    process.exit(1)
  }

  console.log(`  → Using vacancy: "${vacancy.title}" (id: ${vacancy.id}, total_candidates: ${vacancy.total_candidates})`)

  // Step 2: call the /associate endpoint (same as fetchCandidatesByJobOpening)
  const associateUrl = `${base}/Job_Openings/${vacancy.id}/associate?per_page=5&page=1`
  console.log(`\n[2] Calling: ${associateUrl}`)

  const res = await fetch(associateUrl, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })

  console.log(`  → HTTP status: ${res.status}`)

  if (!res.ok) {
    const body = await res.text()
    console.error('Error response:', body)
    process.exit(1)
  }

  const json = await res.json()
  const candidates = json.data ?? []
  const info = json.info ?? {}

  console.log(`\n[3] Response info:`, JSON.stringify(info, null, 2))
  console.log(`\n[4] Total candidates returned: ${candidates.length}`)

  if (candidates.length === 0) {
    console.log('No candidates returned — vacancy might have 0 associations')
    return
  }

  // Step 3: dump ALL fields for first 3 candidates, highlighting date fields
  const DATE_KEYWORDS = ['time', 'date', 'on', 'at', 'created', 'modified', 'associated', 'application', 'updated', 'joined']

  console.log('\n=== ALL FIELDS — first 3 candidates ===\n')

  for (const [i, cand] of candidates.slice(0, 3).entries()) {
    console.log(`\n─── Candidate ${i + 1} ───`)
    const entries = Object.entries(cand).sort(([a], [b]) => a.localeCompare(b))

    // Date fields first
    const dateFields = entries.filter(([k]) => {
      const lower = k.toLowerCase()
      return DATE_KEYWORDS.some(kw => lower.includes(kw))
    })
    const otherFields = entries.filter(([k]) => {
      const lower = k.toLowerCase()
      return !DATE_KEYWORDS.some(kw => lower.includes(kw))
    })

    console.log('  📅 DATE-RELATED FIELDS:')
    if (dateFields.length === 0) {
      console.log('  (none)')
    }
    for (const [key, val] of dateFields) {
      const display = val === null || val === undefined ? 'null' :
        typeof val === 'object' ? JSON.stringify(val) : String(val)
      console.log(`  ★ ${key}: ${display}`)
    }

    console.log('  📋 OTHER FIELDS:')
    for (const [key, val] of otherFields) {
      if (val === null || val === undefined || val === '') continue
      const display = typeof val === 'object' ? JSON.stringify(val) : String(val)
      console.log(`    ${key}: ${display}`)
    }
  }

  // Step 4: print unique field names across ALL candidates
  console.log('\n=== ALL FIELD NAMES (across all returned candidates) ===')
  const allKeys = new Set()
  for (const c of candidates) Object.keys(c).forEach(k => allKeys.add(k))
  const sortedKeys = [...allKeys].sort()
  console.log(sortedKeys.join('\n'))

  // Step 5: Check if Created_Time matches candidate creation date in Supabase
  // vs when they were associated to this vacancy
  console.log('\n=== HYPOTHESIS CHECK ===')
  console.log('The sync code uses: candidate["Created_Time"]')
  console.log('This is the date the CANDIDATE RECORD was created in Zoho.')
  console.log('If a candidate existed before this vacancy was opened, their')
  console.log('Created_Time will predate their association to this vacancy.')
  console.log()

  const thisWeekMonday = (() => {
    const now = new Date()
    const day = now.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    monday.setUTCDate(monday.getUTCDate() + diff)
    return monday.toISOString().slice(0, 10)
  })()

  console.log(`Current week starts: ${thisWeekMonday}`)

  let countCreatedThisWeek = 0
  let countCreatedBefore = 0
  let countNoCreatedTime = 0

  for (const cand of candidates) {
    const ct = cand['Created_Time']
    if (!ct || typeof ct !== 'string') {
      countNoCreatedTime++
      continue
    }
    const createdDate = new Date(ct).toISOString().slice(0, 10)
    if (createdDate >= thisWeekMonday) {
      countCreatedThisWeek++
    } else {
      countCreatedBefore++
    }
  }

  console.log(`Of the ${candidates.length} candidates:`)
  console.log(`  Created THIS week (${thisWeekMonday}): ${countCreatedThisWeek}`)
  console.log(`  Created BEFORE this week: ${countCreatedBefore}`)
  console.log(`  No Created_Time: ${countNoCreatedTime}`)
  console.log()

  if (countCreatedBefore > 0) {
    console.log('✅ HYPOTHESIS CONFIRMED: Some candidates have Created_Time BEFORE the current week.')
    console.log('   These are existing Zoho candidates associated/assigned to this vacancy.')
    console.log('   The current sync code would bucket them into OLDER weeks based on Created_Time,')
    console.log('   NOT into the week they were actually associated to this vacancy.')
  } else if (countCreatedThisWeek > 0) {
    console.log('⚠️  All sampled candidates were created THIS week — cannot confirm hypothesis from this sample.')
    console.log('   Try with more candidates (per_page=200) or an older vacancy.')
  }
}

main().catch(e => {
  console.error('Fatal:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
