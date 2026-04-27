/**
 * One-off introspection script: fetch the Promo 114 Dropouts tab and print
 * its actual headers + a few sample rows, so we can verify the importer's
 * column maps are complete.
 *
 * READ-ONLY. No DB writes, no imports from @/lib/supabase.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(p: string) {
  try {
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
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

/**
 * Local-only fix: the service-account JSON in .env.production-local is stored
 * in backslash-escaped form (``\"type\":\"service_account\"...``) AND the
 * inner `private_key` has literal backslash-n sequences. The client's
 * parseServiceAccountJson handles the outer layer but leaves the PEM with
 * literal `\n` chars, which Node's crypto decoder rejects.
 *
 * We repair the env var here (in-memory only, no writes) so fetchSingleTab
 * can authenticate via the existing client code path unchanged.
 */
function repairServiceAccountEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  let obj: Record<string, string> | null = null
  // Try as-is
  try {
    obj = JSON.parse(raw)
  } catch {
    // Try unescaping \" → " (but replace literal \n in PK to sentinel first
    // to avoid JSON.parse choking on the unescaped key)
    try {
      const unescaped = raw.replace(/\\"/g, '"')
      // In the unescaped form, the private_key field has raw newlines (bad JSON)
      // because the original `\\n` became `\n` (backslash + n) then the outer
      // JSON reader sees it as an escape. We need to double-escape so the PEM
      // newlines survive the JSON.parse step as real '\n' in the string value.
      const fixed = unescaped.replace(
        /"private_key":"([\s\S]*?)"/,
        (_m, key) => {
          const safe = key
            .replace(/\\/g, '\\\\') // escape any literal backslash
            .replace(/\n/g, '\\n')   // escape real newlines
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
    // Collapse any run of backslashes before 'n' or a real newline into a single real newline.
    obj.private_key = obj.private_key.replace(/\\+n/g, '\n').replace(/\\+\n/g, '\n')
  }
  const pk = obj.private_key ?? ''
  console.log('[repair] pk length:', pk.length, 'has real newline:', pk.includes('\n'), 'head:', JSON.stringify(pk.slice(0, 40)))
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(obj)
}

repairServiceAccountEnv()

import { fetchSingleTab } from '@/lib/google-sheets/client'

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/10vh-BfOh9dq2yxH_xClAusA9FgyA4jlZlu2znIR58cg/edit?usp=sharing'
const DROPOUTS_GID = '1646413473'

async function main() {
  console.log('Fetching Dropouts tab (gid=' + DROPOUTS_GID + ') ...')
  const tab = await fetchSingleTab(SHEET_URL, DROPOUTS_GID, 'Dropouts')

  console.log('\n=== TAB NAME ===')
  console.log(JSON.stringify(tab.tabName))

  console.log('\n=== RAW HEADERS (' + tab.rawHeaders.length + ') ===')
  console.log(JSON.stringify(tab.rawHeaders, null, 2))

  console.log('\n=== ROW COUNT ===')
  console.log(tab.rows.length)

  console.log('\n=== FIRST 3 ROWS ===')
  console.log(JSON.stringify(tab.rows.slice(0, 3), null, 2))
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
