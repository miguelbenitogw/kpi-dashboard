import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Env loading — mismo patrón que sync-germany-dropouts.ts
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

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))
repairServiceAccountEnv()

// ---------------------------------------------------------------------------
// Library imports (must come AFTER env loading)
// ---------------------------------------------------------------------------

import {
  enrichGermanyCandidatesWithRecordId,
  syncGermanyCandidateNotes,
} from '@/lib/zoho/sync-germany-candidates'

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Germany Candidate Notes Sync                             ║`)
  console.log(`║  ${new Date().toISOString()}                  ║`)
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // ── Step 1: Enrich candidates with zoho_record_id (long ID) ───────────────
  console.log('[step 1/2] Enriching candidates with zoho_record_id...\n')

  const enrichResult = await enrichGermanyCandidatesWithRecordId()

  console.log('\n[step 1/2] Enrich result:')
  console.log(`  Total without record_id : ${enrichResult.total_without_record_id}`)
  console.log(`  Enriched                : ${enrichResult.enriched}`)
  console.log(`  Not found in Zoho       : ${enrichResult.not_found}`)
  console.log(`  Errors                  : ${enrichResult.errors.length}`)
  if (enrichResult.errors.length > 0) {
    enrichResult.errors.forEach((e) => console.error(`  [ERROR] ${e}`))
  }

  // ── Step 2: Sync notes ─────────────────────────────────────────────────────
  console.log('\n[step 2/2] Syncing candidate notes...\n')

  const notesResult = await syncGermanyCandidateNotes()

  console.log('\n[step 2/2] Notes sync result:')
  console.log(`  Candidates with record_id : ${notesResult.total_candidates_with_record_id}`)
  console.log(`  Notes upserted            : ${notesResult.notes_upserted}`)
  console.log(`  Errors                    : ${notesResult.errors.length}`)
  if (notesResult.errors.length > 0) {
    notesResult.errors.forEach((e) => console.error(`  [ERROR] ${e}`))
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('  SYNC COMPLETE')
  console.log('═'.repeat(60))
  console.log(`  Record IDs enriched : ${enrichResult.enriched}`)
  console.log(`  Notes upserted      : ${notesResult.notes_upserted}`)
  const totalErrors = enrichResult.errors.length + notesResult.errors.length
  console.log(`  Total errors        : ${totalErrors}`)
  console.log()

  if (totalErrors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})

// ---------------------------------------------------------------------------
// Instrucciones de ejecución:
//
//   npx tsx --tsconfig tsconfig.json src/scripts/sync-germany-notes.ts
//
// Requiere las siguientes env vars (leídas automáticamente de .env.production-local
// o .env.local en la raíz del proyecto):
//
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ZOHO_API_BASE_URL         (ej: https://recruit.zoho.eu/recruit/v2)
//   ZOHO_TOKEN_URL
//   ZOHO_CLIENT_ID
//   ZOHO_CLIENT_SECRET
//   ZOHO_REFRESH_TOKEN
// ---------------------------------------------------------------------------
