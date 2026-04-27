/**
 * One-off introspection script: fetch the Promo 117 Dropouts tab and print
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
 * Local-only fix: repair triple-escaped GOOGLE_SERVICE_ACCOUNT_JSON so the
 * existing parseServiceAccountJson + googleapis auth can use it unchanged.
 * See inspect-promo114-dropouts.ts for the full rationale.
 */
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
  const pk = obj.private_key ?? ''
  console.log('[repair] pk length:', pk.length, 'has real newline:', pk.includes('\n'), 'head:', JSON.stringify(pk.slice(0, 40)))
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(obj)
}

repairServiceAccountEnv()

import { fetchSingleTab, listSheets, extractSheetId } from '@/lib/google-sheets/client'

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1UpnHAgvQZgDRBtpS1h2idO_0kVz7viYKVZUSQpL4OHg/edit?usp=sharing'
const DEFAULT_DROPOUTS_GID = '1646413473'

async function main() {
  console.log('Attempting fetchSingleTab(gid=' + DEFAULT_DROPOUTS_GID + ') ...')

  let tab
  try {
    tab = await fetchSingleTab(SHEET_URL, DEFAULT_DROPOUTS_GID, 'Dropouts')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log('Default gid failed:', msg)
    console.log('Falling back to listSheets() to locate Dropouts by name ...')

    const spreadsheetId = extractSheetId(SHEET_URL)
    const all = await listSheets(spreadsheetId)
    console.log('All tabs in spreadsheet:')
    for (const s of all) console.log('  -', JSON.stringify(s.name), 'gid=' + s.gid)

    const match = all.find((s) => s.name.toLowerCase().trim() === 'dropouts') ??
      all.find((s) => s.name.toLowerCase().includes('dropout'))
    if (!match) {
      throw new Error('No tab named "Dropouts" found in this spreadsheet.')
    }
    console.log('Using tab', JSON.stringify(match.name), 'gid=' + match.gid)
    tab = await fetchSingleTab(SHEET_URL, String(match.gid), match.name)
  }

  console.log('\n=== TAB NAME ===')
  console.log(JSON.stringify(tab.tabName))

  console.log('\n=== GID ===')
  console.log(tab.gid)

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
