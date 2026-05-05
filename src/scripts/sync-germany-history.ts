import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Env loading — handles multiline single-quoted values (e.g. service account JSON)
// ---------------------------------------------------------------------------

function loadEnvFile(p: string) {
  try {
    const content = readFileSync(p, 'utf-8')
    const lines = content.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const t = line.trim()
      if (!t || t.startsWith('#')) { i++; continue }
      const eqIdx = t.indexOf('=')
      if (eqIdx < 0) { i++; continue }
      const k = t.slice(0, eqIdx).trim()
      let v = t.slice(eqIdx + 1).trim()

      // Multiline single-quoted value: KEY='{\n...\n}'
      if (v.startsWith("'") && !v.endsWith("'")) {
        const parts = [v]
        i++
        while (i < lines.length) {
          parts.push(lines[i])
          if (lines[i].endsWith("'")) { i++; break }
          i++
        }
        v = parts.join('\n')
      } else {
        i++
      }

      // Strip surrounding quotes (single or double)
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      v = v.replace(/\\n$/g, '').trim()
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

function repairServiceAccountEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  let obj: Record<string, string> | null = null
  try {
    obj = JSON.parse(raw)
  } catch {
    try {
      const unescaped = raw.replace(/\\"/g, '"')
      const fixed = unescaped.replace(
        /"private_key":"([\s\S]*?)"/,
        (_m, key) => {
          const safe = key
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
          return `"private_key":"${safe}"`
        },
      )
      obj = JSON.parse(fixed)
    } catch {
      return
    }
  }
  if (!obj) return
  if (typeof obj.private_key === 'string') {
    obj.private_key = obj.private_key.replace(/\\+n/g, '\n').replace(/\\+\n/g, '\n')
  }
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(obj)
}

repairServiceAccountEnv()

// ---------------------------------------------------------------------------
// Library imports (must come AFTER env repair)
// ---------------------------------------------------------------------------

import { syncGermanyCandidateHistory } from '@/lib/zoho/sync-germany-candidates'

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log(`║  Germany Candidate History Sync — ${new Date().toISOString().slice(0, 16)}  ║`)
  console.log('╚══════════════════════════════════════════════════════╝\n')

  console.log('[sync-germany-history] Starting vacancy-first sync...\n')

  const startTime = Date.now()

  try {
    const result = await syncGermanyCandidateHistory()

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n╔══════════════════════════════════════════════════════╗')
    console.log('║  Sync complete                                       ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log(`  Duration:              ${duration}s`)
    console.log(`  Vacancies processed:   ${result.vacancies_processed}`)
    console.log(`  Associations upserted: ${result.associations_upserted}`)
    console.log(`  Stage changes:         ${result.stage_changes_detected}`)
    console.log(`  Errors:                ${result.errors}`)

    if (result.errors > 0) {
      console.warn('\n[sync-germany-history] Completed with errors — check logs above for details.')
      process.exit(1)
    }
  } catch (err) {
    console.error('\n[sync-germany-history] Fatal error:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main().catch(console.error)
