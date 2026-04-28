/**
 * scripts/analyze-charlas-sheet.ts
 *
 * One-shot exploratory reader for the "Charlas y Webinars" Google Sheet.
 * Prints:
 *   - tab list with gid + row/col counts
 *   - per-tab headers + 5 sample rows + inferred column types
 *
 * Usage (from kpi-dashboard/):
 *   npx tsx scripts/analyze-charlas-sheet.ts
 *
 * Loads .env.local manually (same approach as fetch-zoho-tags.ts) because
 * --env-file does not handle JSON values with escaped quotes reliably.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Load .env.local manually ───────────────────────────────────────────────
// Handles multi-line quoted values (the GOOGLE_SERVICE_ACCOUNT_JSON often
// spans several lines because the private_key contains literal newlines).
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')

function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  // Match KEY=value where value can be:
  //   - "..."  (double-quoted, possibly multi-line)
  //   - '...'  (single-quoted)
  //   - rest-of-line (unquoted)
  const re =
    /^([A-Za-z_][A-Za-z0-9_]*)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\r\n]*))/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const key = m[1]
    const dq = m[2]
    const sq = m[3]
    const bare = m[4]
    let val: string
    if (dq !== undefined) {
      // double-quoted: interpret \n, \r, \", \\
      val = dq
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    } else if (sq !== undefined) {
      val = sq
    } else {
      val = (bare ?? '').trim()
    }
    out[key] = val
  }
  return out
}

const parsed = parseEnv(envContent)
for (const [k, v] of Object.entries(parsed)) {
  if (!(k in process.env)) process.env[k] = v
}
// Fallback: if GOOGLE_SERVICE_ACCOUNT_JSON is missing/empty in this project,
// reuse GA4_SERVICE_ACCOUNT_KEY (same Google Cloud service account, just
// base64-encoded). The Sheets API will accept it transparently.
if (
  !process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON.length < 50
) {
  const ga4 = process.env.GA4_SERVICE_ACCOUNT_KEY
  if (ga4 && ga4.length > 50) {
    try {
      const decoded = Buffer.from(ga4, 'base64').toString('utf-8')
      // Validate it's JSON before assigning
      JSON.parse(decoded)
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = decoded
      console.error(
        '[info] GOOGLE_SERVICE_ACCOUNT_JSON empty in .env.local — using GA4_SERVICE_ACCOUNT_KEY (base64-decoded) instead.',
      )
    } catch {
      console.error('[warn] GA4_SERVICE_ACCOUNT_KEY found but failed to base64-decode as JSON.')
    }
  }
}

import {
  extractSheetId,
  listSheets,
  readSheetAsRows,
} from '../src/lib/google-sheets/client'

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1q9J9M-w1zA1Yn9myvcWgPq9QhROdrBst4SbBCto0KZE/edit?usp=sharing'

const SAMPLE_ROWS = 5

// ─── Helpers ────────────────────────────────────────────────────────────────

function anonymizeEmail(s: string): string {
  return s.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    'xxx@$2',
  )
}

type InferredType =
  | 'empty'
  | 'email'
  | 'url'
  | 'date'
  | 'datetime'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'categorical'
  | 'text'

function inferCellType(v: string): Exclude<InferredType, 'categorical' | 'empty'> | 'empty' {
  const s = v.trim()
  if (!s) return 'empty'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'email'
  if (/^https?:\/\//i.test(s)) return 'url'
  if (/^-?\d+$/.test(s)) return 'integer'
  if (/^-?\d+([.,]\d+)?$/.test(s)) return 'number'
  // dd/mm/yyyy or yyyy-mm-dd or with time
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(s)) {
    return s.length > 10 ? 'datetime' : 'date'
  }
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}( \d{1,2}:\d{2}(:\d{2})?)?$/.test(s)) {
    return s.includes(':') ? 'datetime' : 'date'
  }
  if (/^(true|false|sí|si|no|yes|y|n)$/i.test(s)) return 'boolean'
  return 'text'
}

function inferColumn(values: string[]): {
  type: InferredType
  uniqueRatio: number
  fillRatio: number
  distinctSample: string[]
} {
  const filled = values.filter((v) => v !== '' && v != null)
  const fillRatio = values.length === 0 ? 0 : filled.length / values.length
  if (filled.length === 0) {
    return { type: 'empty', uniqueRatio: 0, fillRatio: 0, distinctSample: [] }
  }
  const cellTypes = filled.map((v) => inferCellType(String(v)))
  const counts = new Map<string, number>()
  for (const t of cellTypes) counts.set(t, (counts.get(t) ?? 0) + 1)
  // dominant non-empty type
  let dominant: InferredType = 'text'
  let dominantCount = 0
  for (const [t, c] of counts) {
    if (t === 'empty') continue
    if (c > dominantCount) {
      dominant = t as InferredType
      dominantCount = c
    }
  }

  const distinct = new Set(filled.map((v) => String(v).toLowerCase()))
  const uniqueRatio = distinct.size / filled.length

  // categorical heuristic: text dominant, low cardinality, many rows
  if (
    dominant === 'text' &&
    filled.length >= 8 &&
    distinct.size <= Math.max(8, Math.floor(filled.length / 4)) &&
    distinct.size <= 20
  ) {
    dominant = 'categorical'
  }

  const distinctSample = Array.from(distinct).slice(0, 8)
  return { type: dominant, uniqueRatio, fillRatio, distinctSample }
}

function looksLikeIdHeader(h: string): boolean {
  return /^(id|uuid|email|e[-_ ]?mail|correo|dni)$/i.test(h.trim())
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Sanity-check service account is loaded
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  let saEmail = '(unknown)'
  if (!raw) {
    console.error(
      '\n[ERROR] GOOGLE_SERVICE_ACCOUNT_JSON env var is not set.\n' +
        'Run with: npx tsx --env-file=.env.local scripts/analyze-charlas-sheet.ts\n',
    )
    process.exit(1)
  }
  try {
    // Best-effort parse to surface client_email for sharing instructions
    const tryParse = (s: string) => {
      try {
        const p = JSON.parse(s)
        return typeof p === 'object' ? p : JSON.parse(p as string)
      } catch {
        const norm = s
          .replace(/\\\r\n/g, '\\n')
          .replace(/\\\n/g, '\\n')
          .replace(/\\"/g, '"')
        return JSON.parse(norm)
      }
    }
    const sa = tryParse(raw) as { client_email?: string }
    if (sa.client_email) saEmail = sa.client_email
  } catch {
    /* ignore */
  }

  const sheetId = extractSheetId(SHEET_URL)
  console.log('='.repeat(78))
  console.log('Charlas y Webinars — Sheet analysis')
  console.log(new Date().toISOString())
  console.log(`Sheet ID:        ${sheetId}`)
  console.log(`Service account: ${saEmail}`)
  console.log('='.repeat(78))

  let tabs: Array<{ name: string; gid: number }>
  try {
    tabs = await listSheets(sheetId)
  } catch (err) {
    console.error('\n[FATAL] No pude listar las pestañas. Posibles causas:')
    console.error('  - La sheet NO está compartida con la service account')
    console.error('  - Permisos insuficientes')
    console.error(`\nCompartila (Viewer) con: ${saEmail}\n`)
    console.error('Error original:', err instanceof Error ? err.message : err)
    process.exit(2)
  }

  console.log(`\nFound ${tabs.length} tab(s):`)
  for (const t of tabs) {
    console.log(`  • ${t.name} (gid=${t.gid})`)
  }

  // Per-tab analysis
  for (const t of tabs) {
    console.log('\n' + '─'.repeat(78))
    console.log(`TAB: "${t.name}"  (gid=${t.gid})`)
    console.log('─'.repeat(78))

    let headers: string[] = []
    let rows: Record<string, string>[] = []
    try {
      const res = await readSheetAsRows(sheetId, t.gid)
      headers = res.headers
      rows = res.rows
    } catch (err) {
      console.log(`  [ERROR reading tab] ${err instanceof Error ? err.message : err}`)
      continue
    }

    console.log(`Rows (excl. header): ${rows.length}`)
    console.log(`Columns:             ${headers.length}`)

    if (headers.length === 0) {
      console.log('  (empty tab)')
      continue
    }

    console.log('\nHeaders (in order):')
    headers.forEach((h, i) => {
      console.log(`  [${i}] "${h}"`)
    })

    // Per-column inference
    console.log('\nColumn analysis:')
    const colReports: Array<{
      idx: number
      name: string
      type: InferredType
      fillRatio: number
      uniqueRatio: number
      idLike: boolean
      sample: string[]
    }> = []
    headers.forEach((h, i) => {
      const key = h || `col_${i}`
      const values = rows.map((r) => r[key] ?? '')
      const info = inferColumn(values)
      const idLike =
        looksLikeIdHeader(h) ||
        (info.fillRatio >= 0.9 &&
          info.uniqueRatio >= 0.95 &&
          (info.type === 'integer' || info.type === 'text' || info.type === 'email'))
      colReports.push({
        idx: i,
        name: h,
        type: info.type,
        fillRatio: info.fillRatio,
        uniqueRatio: info.uniqueRatio,
        idLike,
        sample: info.distinctSample,
      })
    })

    for (const c of colReports) {
      const pct = (n: number) => `${(n * 100).toFixed(0)}%`
      const idTag = c.idLike ? '  [ID-like]' : ''
      const sampleStr = c.sample
        .map((s) => anonymizeEmail(s).slice(0, 40))
        .join(' | ')
      console.log(
        `  [${c.idx}] ${c.name.padEnd(38)} type=${c.type.padEnd(11)} fill=${pct(c.fillRatio).padStart(4)} unique=${pct(c.uniqueRatio).padStart(4)}${idTag}`,
      )
      if (sampleStr) console.log(`        samples: ${sampleStr}`)
    }

    // Sample rows
    console.log('\nSample rows (anonymized emails):')
    const sample = rows.slice(0, SAMPLE_ROWS)
    sample.forEach((r, idx) => {
      console.log(`  --- row ${idx + 1} ---`)
      headers.forEach((h, i) => {
        const key = h || `col_${i}`
        const v = r[key] ?? ''
        if (v === '') return
        const display = anonymizeEmail(v)
        const truncated = display.length > 120 ? display.slice(0, 120) + '…' : display
        console.log(`    ${h}: ${truncated}`)
      })
    })

    // Quality flags
    const emptyCols = colReports.filter((c) => c.fillRatio === 0).map((c) => c.name)
    const sparseCols = colReports
      .filter((c) => c.fillRatio > 0 && c.fillRatio < 0.2)
      .map((c) => `${c.name} (${(c.fillRatio * 100).toFixed(0)}%)`)
    if (emptyCols.length || sparseCols.length) {
      console.log('\nData-quality flags:')
      if (emptyCols.length) console.log(`  empty columns: ${emptyCols.join(', ')}`)
      if (sparseCols.length) console.log(`  sparse columns: ${sparseCols.join(', ')}`)
    }
  }

  console.log('\n' + '='.repeat(78))
  console.log('Done.')
  console.log('='.repeat(78))
}

main().catch((err) => {
  console.error('\n[FATAL]', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
