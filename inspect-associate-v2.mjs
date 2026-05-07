/**
 * Inspects /Job_Openings/{id}/associate endpoint — what date fields does Zoho return?
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function cleanVal(v) {
  // v is already a string after stripping quotes
  // Remove literal backslash-n at end (Vercel CLI artifact)
  // char 92 = '\', char 110 = 'n'
  while (v.length >= 2 && v.charCodeAt(v.length - 2) === 92 && v.charCodeAt(v.length - 1) === 110) {
    v = v.slice(0, -2)
  }
  return v.trim()
}

function readEnvFile(file) {
  const env = {}
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split(/\r?\n/)) {
      const eqIdx = line.indexOf('=')
      if (eqIdx < 0 || line.trim().startsWith('#')) continue
      const key = line.slice(0, eqIdx).trim()
      let val = line.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      val = cleanVal(val)
      env[key] = val
    }
  } catch {}
  return env
}

const prodEnv = readEnvFile('.env.production-local')
const localEnv = readEnvFile('.env.local')
const cfg = { ...prodEnv, ...localEnv }

const supabaseUrl = cfg['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = cfg['SUPABASE_SERVICE_ROLE_KEY']
const zohoBase = cfg['ZOHO_API_BASE_URL']
const zohoTokenUrl = cfg['ZOHO_TOKEN_URL']
const zohoClientId = cfg['ZOHO_CLIENT_ID']
const zohoClientSecret = cfg['ZOHO_CLIENT_SECRET']
const zohoRefreshToken = cfg['ZOHO_REFRESH_TOKEN']

console.log('Supabase URL:', supabaseUrl)
console.log('Service key (last 8):', supabaseKey.slice(-8))

const supabase = createClient(supabaseUrl, supabaseKey)

// 1. Get an active vacancy
const { data: vacancy, error: vacError } = await supabase
  .from('job_openings_kpi')
  .select('id, title, total_candidates')
  .eq('es_proceso_atraccion_actual', true)
  .gt('total_candidates', 0)
  .order('total_candidates', { ascending: false })
  .limit(1)
  .single()

if (vacError) {
  console.error('Supabase error:', vacError.message)
  process.exit(1)
}

console.log('\nVacancy:', vacancy.id, '|', vacancy.title, '| total:', vacancy.total_candidates)

// 2. Get Zoho token
const { data: tokenRow } = await supabase
  .from('dashboard_config_kpi')
  .select('config_value')
  .eq('config_key', 'zoho_token')
  .single()

let zohoToken = null
if (tokenRow?.config_value) {
  const t = typeof tokenRow.config_value === 'string'
    ? JSON.parse(tokenRow.config_value)
    : tokenRow.config_value
  if (Date.now() < new Date(t.expires_at).getTime() - 5 * 60 * 1000) {
    zohoToken = t.access_token
    console.log('[token] Using stored token, expires:', t.expires_at)
  }
}

if (!zohoToken) {
  console.log('[token] Refreshing...')
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: zohoClientId,
    client_secret: zohoClientSecret,
    refresh_token: zohoRefreshToken,
  })
  const r = await fetch(zohoTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const t = await r.json()
  if (!t.access_token) throw new Error('No token: ' + JSON.stringify(t))
  zohoToken = t.access_token
  console.log('[token] Got fresh token')
}

// 3. Call /associate endpoint
const url = `${zohoBase}/Job_Openings/${vacancy.id}/associate?per_page=5&page=1`
console.log('\nCalling:', url)

const res = await fetch(url, {
  headers: { Authorization: `Zoho-oauthtoken ${zohoToken}` },
})

console.log('HTTP:', res.status)

if (!res.ok) {
  console.error('Error body:', await res.text())
  process.exit(1)
}

const json = await res.json()
const candidates = json.data ?? []

console.log('\nResponse info:', JSON.stringify(json.info, null, 2))
console.log('Candidates returned:', candidates.length)

if (candidates.length === 0) {
  console.log('No candidates — try a different vacancy')
  process.exit(0)
}

// 4. Dump all fields, date fields highlighted
const DATE_KW = ['time', 'date', '_on', '_at', 'created', 'modified', 'associated', 'application', 'updated']

for (const [i, cand] of candidates.slice(0, 3).entries()) {
  console.log(`\n─── Candidate ${i+1} of ${candidates.length} ───`)
  const entries = Object.entries(cand).sort(([a], [b]) => a.localeCompare(b))

  console.log('\nDATE-RELATED FIELDS (contains: time/date/on/at/created/modified/associated/updated):')
  for (const [k, v] of entries) {
    if (DATE_KW.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) {
      console.log(`  ★ ${k}: ${JSON.stringify(v)}`)
    }
  }

  console.log('\nOTHER FIELDS:')
  for (const [k, v] of entries) {
    if (!DATE_KW.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) {
      if (v !== null && v !== undefined && v !== '') {
        const display = typeof v === 'object' ? JSON.stringify(v) : String(v)
        console.log(`    ${k}: ${display}`)
      }
    }
  }
}

// 5. Summary of all field names
console.log('\n\n=== ALL UNIQUE FIELD NAMES across returned candidates ===')
const allKeys = new Set()
for (const c of candidates) Object.keys(c).forEach(k => allKeys.add(k))
console.log([...allKeys].sort().join('\n'))

// 6. Hypothesis check
const thisWeekMonday = (() => {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
})()

console.log('\n\n=== HYPOTHESIS CHECK ===')
console.log(`Current week (Monday): ${thisWeekMonday}`)
console.log('The sync code buckets candidates by candidate["Created_Time"]')

let thisWeek = 0, beforeThisWeek = 0, noDate = 0
for (const c of candidates) {
  const ct = c['Created_Time']
  if (!ct || typeof ct !== 'string') { noDate++; continue }
  const d = new Date(ct).toISOString().slice(0, 10)
  if (d >= thisWeekMonday) thisWeek++
  else beforeThisWeek++
}

console.log(`  Created_Time THIS week: ${thisWeek}`)
console.log(`  Created_Time BEFORE this week: ${beforeThisWeek}`)
console.log(`  No Created_Time: ${noDate}`)

if (beforeThisWeek > 0) {
  console.log('\n✅ HYPOTHESIS CONFIRMED: Candidates exist with Created_Time before current week.')
  console.log('   These are pre-existing Zoho candidates associated to this vacancy.')
  console.log('   The sync INCORRECTLY places them in old weeks based on Created_Time.')
} else {
  console.log('\n⚠️  Cannot confirm from this sample — all sampled candidates were created this week.')
}
