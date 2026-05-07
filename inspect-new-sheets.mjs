/**
 * Inspect two new dropout Google Sheets via service account.
 * Handles multi-line GOOGLE_SERVICE_ACCOUNT_JSON in .env.local.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { google } from 'googleapis'

// ─── Env loader that handles multi-line single-quoted values ──────────────
function loadServiceAccountJson() {
  const envPath = resolve(process.cwd(), '.env.local')
  const content = readFileSync(envPath, 'utf-8')

  // Find GOOGLE_SERVICE_ACCOUNT_JSON='...' (multi-line single-quoted)
  const idx = content.indexOf("GOOGLE_SERVICE_ACCOUNT_JSON='")
  if (idx < 0) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not found in .env.local')

  const startQ = idx + "GOOGLE_SERVICE_ACCOUNT_JSON='".length - 1 // position of opening '
  const openIdx = startQ + 1 // first char after '

  // Find closing ' — scan forward
  let closeIdx = -1
  for (let i = openIdx; i < content.length; i++) {
    if (content[i] === "'") { closeIdx = i; break }
  }
  if (closeIdx < 0) throw new Error('Closing quote for GOOGLE_SERVICE_ACCOUNT_JSON not found')

  const jsonStr = content.slice(openIdx, closeIdx)
  return JSON.parse(jsonStr)
}

// ─── Google Sheets auth ───────────────────────────────────────────────────
async function getSheetsClient() {
  const creds = loadServiceAccountJson()

  // Normalize private key (collapse literal \n sequences)
  if (typeof creds.private_key === 'string') {
    creds.private_key = creds.private_key.replace(/\\n/g, '\n')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function extractSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!m) throw new Error('Could not extract sheet ID from URL: ' + url)
  return m[1]
}

// ─── Inspect a single spreadsheet ─────────────────────────────────────────
async function inspectSheet(sheets, spreadsheetId, label) {
  console.log('\n' + '═'.repeat(70))
  console.log(`  ${label}`)
  console.log('  Sheet ID:', spreadsheetId)
  console.log('═'.repeat(70))

  // List all tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
  const tabs = meta.data.sheets ?? []
  console.log('\nTabs (' + tabs.length + '):')
  for (const t of tabs) {
    const p = t.properties
    console.log(`  - "${p.title}" (gid=${p.sheetId}, rows=${p.gridProperties?.rowCount ?? '?'})`)
  }

  // Read first tab + any tab named Dropouts
  const toRead = new Set()
  for (const t of tabs) {
    const name = t.properties.title ?? ''
    if (name.toLowerCase().includes('dropout') || name.toLowerCase().includes('drop')) {
      toRead.add(name)
    }
  }
  if (toRead.size === 0 && tabs.length > 0) {
    toRead.add(tabs[0].properties.title) // fallback: first tab
  }

  for (const tabName of toRead) {
    console.log(`\n── Tab: "${tabName}" ──`)
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:Z50`,
    })
    const rows = resp.data.values ?? []
    if (rows.length === 0) { console.log('  (empty)'); continue }

    const headers = rows[0]
    console.log('  Columns (' + headers.length + '):', JSON.stringify(headers))
    console.log('  Data rows:', rows.length - 1)
    console.log('  First 5 data rows:')
    for (const row of rows.slice(1, 6)) {
      const obj = {}
      headers.forEach((h, i) => { if (row[i] !== undefined) obj[h] = row[i] })
      console.log('   ', JSON.stringify(obj))
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
const SHEETS = [
  {
    label: 'Sheet 1 (Promo 124?)',
    url: 'https://docs.google.com/spreadsheets/d/1bUGyx-QOMQLs88oDeuICrZ5_TQ5hMcFsiRMMkt4fBwk/edit?usp=sharing',
  },
  {
    label: 'Sheet 2 (new)',
    url: 'https://docs.google.com/spreadsheets/d/1NLZrmFzGYnTMj0d4EvzEODDGx3CHp7IAkUdMF9Wya9U/edit?usp=sharing',
  },
]

async function main() {
  const sheets = await getSheetsClient()
  for (const { label, url } of SHEETS) {
    const id = extractSheetId(url)
    await inspectSheet(sheets, id, label)
  }
  console.log('\n✅ Done')
}

main().catch(e => {
  console.error('Fatal:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
