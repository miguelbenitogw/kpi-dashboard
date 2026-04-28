import { readFileSync } from 'fs'
import { resolve } from 'path'

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

function extractJsonEnvVar(filePath: string, key: string) {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const keyIdx = raw.indexOf(`${key}=`)
    if (keyIdx < 0) return
    let pos = keyIdx + key.length + 1
    while (pos < raw.length && (raw[pos] === "'" || raw[pos] === '"')) pos++
    let depth = 0, start = -1, end = -1
    for (let i = pos; i < raw.length; i++) {
      if (raw[i] === '{') { if (start < 0) start = i; depth++ }
      else if (raw[i] === '}') { if (--depth === 0) { end = i; break } }
    }
    if (start >= 0 && end >= 0) process.env[key] = raw.slice(start, end + 1)
  } catch {}
}

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))
extractJsonEnvVar(resolve(process.cwd(), '.env.production-local'), 'GOOGLE_SERVICE_ACCOUNT_JSON')
extractJsonEnvVar(resolve(process.cwd(), '.env.local'), 'GOOGLE_SERVICE_ACCOUNT_JSON')

import { syncCandidatesForActiveVacancies } from '@/lib/zoho/sync-candidates'

async function main() {
  console.log('Syncing candidates for active vacancies...\n')
  const result = await syncCandidatesForActiveVacancies()
  console.log(`vacancies_processed:  ${result.vacancies_processed}`)
  console.log(`candidates_synced:    ${result.candidates_synced}`)
  console.log(`status_changes_logged:${result.status_changes_logged}`)
  console.log(`api_calls:            ${result.api_calls}`)
  if (result.errors.length > 0) {
    console.error(`\nerrors (${result.errors.length}):`)
    result.errors.slice(0, 20).forEach(e => console.error(`  - ${e}`))
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
