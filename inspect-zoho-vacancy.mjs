/**
 * Inspect a single Zoho Job Opening to find the 3-digit identifier field.
 * Loads env → gets token from Supabase → fetches 1 job opening → dumps ALL fields.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Env loader (handles multi-line single-quoted values) ────────────────────
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
          // Strip surrounding double-quotes
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

// ─── Supabase admin (to read stored Zoho token) ──────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Get Zoho token ───────────────────────────────────────────────────────────
async function getToken() {
  // Try stored token first
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

  // Refresh
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

  // Store it
  const expires_at = new Date(Date.now() + tok.expires_in * 1000).toISOString()
  await supabase.from('dashboard_config_kpi').upsert({
    config_key: 'zoho_token',
    config_value: { access_token: tok.access_token, expires_at, scope: tok.scope || '' },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'config_key' })

  return tok.access_token
}

// ─── Fetch one job opening ────────────────────────────────────────────────────
async function main() {
  const token = await getToken()
  const base = (process.env.ZOHO_API_BASE_URL || '').replace(/\/$/, '')

  const url = `${base}/JobOpenings?per_page=2&page=1`
  console.log('\nFetching:', url)

  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Error', res.status, body)
    process.exit(1)
  }

  const json = await res.json()
  const vacancies = json.data ?? []

  if (vacancies.length === 0) {
    console.log('No vacancies returned')
    return
  }

  console.log(`\n=== Got ${vacancies.length} vacancies — ALL FIELDS ===\n`)

  for (const [i, v] of vacancies.entries()) {
    console.log(`\n─── Vacancy ${i + 1}: ${v.Job_Opening_Name ?? v.Posting_Title ?? '(no title)'} ───`)
    console.log('ID (Zoho internal):', v.id)

    // Print all fields sorted
    const entries = Object.entries(v).sort(([a], [b]) => a.localeCompare(b))
    for (const [key, val] of entries) {
      if (val === null || val === undefined || val === '') continue
      const display = typeof val === 'object' ? JSON.stringify(val) : String(val)
      // Highlight potential 3-digit numeric fields
      const isNumeric = typeof val === 'number' || /^\d+$/.test(String(val))
      const len = String(val).replace(/\D/g, '').length
      const flag = isNumeric && len >= 2 && len <= 5 ? ' ◀◀◀ POSIBLE ID' : ''
      console.log(`  ${key}: ${display}${flag}`)
    }
  }

  // Also try fetching with all fields explicitly
  console.log('\n=== Field names summary (non-null fields across all vacancies) ===')
  const allKeys = new Set()
  for (const v of vacancies) Object.keys(v).forEach(k => allKeys.add(k))
  console.log([...allKeys].sort().join('\n'))
}

main().catch(e => {
  console.error('Fatal:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
