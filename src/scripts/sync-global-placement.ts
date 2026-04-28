import { readFileSync } from 'fs'
import { resolve } from 'path'

// Standard single-line env loader (handles Supabase keys and other plain vars)
function loadEnvFile(p: string) {
  try {
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue
      const i = t.indexOf('='); if (i < 0) continue
      const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      v = v.replace(/\\n$/g, '').trim(); if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

// Bracket-counting extractor for multiline JSON env vars
function extractJsonEnvVar(filePath: string, key: string) {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const keyIdx = raw.indexOf(`${key}=`)
    if (keyIdx < 0) return
    let pos = keyIdx + key.length + 1
    // Skip optional surrounding quote
    while (pos < raw.length && (raw[pos] === "'" || raw[pos] === '"')) pos++
    // Find balanced { }
    let depth = 0, start = -1, end = -1
    for (let i = pos; i < raw.length; i++) {
      if (raw[i] === '{') { if (start < 0) start = i; depth++ }
      else if (raw[i] === '}') { if (--depth === 0) { end = i; break } }
    }
    if (start >= 0 && end >= 0) {
      process.env[key] = raw.slice(start, end + 1)
    }
  } catch {}
}
loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))
// Override with bracket-counted JSON for multiline service account
extractJsonEnvVar(resolve(process.cwd(), '.env.production-local'), 'GOOGLE_SERVICE_ACCOUNT_JSON')
extractJsonEnvVar(resolve(process.cwd(), '.env.local'), 'GOOGLE_SERVICE_ACCOUNT_JSON')


import { supabaseAdmin } from '@/lib/supabase/server'
import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

async function main() {
  const { data: madreSheets, error } = await supabaseAdmin
    .from('madre_sheets_kpi' as any)
    .select('sheet_id, label')
    .eq('is_active', true)
    .order('year', { ascending: true })

  if (error) {
    console.error('Failed to fetch madre sheets:', error.message)
    process.exit(1)
  }

  console.log(`Found ${madreSheets?.length ?? 0} active madre sheet(s)\n`)

  for (const madre of madreSheets ?? []) {
    console.log(`── ${madre.label} (${madre.sheet_id})`)
    const result = await importGlobalPlacement(madre.sheet_id)
    console.log(`   updated:    ${result.updated}`)
    console.log(`   skipped:    ${result.skipped}`)
    console.log(`   notMatched: ${result.notMatched}`)
    if (result.errors.length > 0) {
      console.error(`   errors (${result.errors.length}):`)
      result.errors.slice(0, 10).forEach(e => console.error(`     - ${e}`))
    }
    console.log()
  }

  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
