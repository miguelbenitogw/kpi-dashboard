/**
 * Inspection script: fetch the Global Placement tab and show 5 example rows
 * that do NOT match any candidate in candidates_kpi.
 *
 * READ-ONLY. No DB writes.
 */

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
loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (raw) {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\+n/g, '\n')
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsed)
    }
  } catch {}
}

import { readSheetAsRows } from '@/lib/google-sheets/client'
import { supabaseAdmin } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHEET_ID = '1jNmyHejPA4iGoSm-AiIzqL6d3m4E0cJa3gGmKfQDAs0'
const GP_GID = 1470777220

// ---------------------------------------------------------------------------
// Name normalization — strip accents, lowercase, non-alphanumeric, collapse spaces
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\([^)]*\)/g, '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Column alias resolution (matches import-global-placement.ts logic)
// ---------------------------------------------------------------------------

const PLACEMENT_COLUMN_MAP: Record<string, string[]> = {
  id: ['id', 'zoho id', 'zoho_id', 'candidate id', 'candidateid'],
  full_name: ['nombre y apellidos', 'nombre completo', 'nombre', 'name'],
  promocion: ['promocion', 'promoción', 'promo'],
  gp_training_status: ['status (training)', 'training status', 'estado formación', 'estado formacion'],
}

function mapHeader(header: string): string | null {
  const lower = header.toLowerCase().trim()
  for (const [canonical, variants] of Object.entries(PLACEMENT_COLUMN_MAP)) {
    if (variants.some((v) => lower === v)) return canonical
  }
  for (const [canonical, variants] of Object.entries(PLACEMENT_COLUMN_MAP)) {
    if (variants.some((v) => v.length >= 4 && lower.includes(v))) return canonical
  }
  return null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Reading Global Placement tab (gid=%d) …', GP_GID)
  const { headers, rows } = await readSheetAsRows(SHEET_ID, GP_GID)

  console.log('GP tab headers:', headers)
  console.log('GP row count:', rows.length)

  // Build a reverse header map: raw header -> canonical field
  const headerMap = new Map<string, string>()
  for (const h of headers) {
    const canonical = mapHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  // Identify which raw headers carry each field
  const rawOf = (canonical: string) =>
    headers.find((h) => headerMap.get(h) === canonical) ?? null

  const rawId     = rawOf('id')
  const rawName   = rawOf('full_name')
  const rawPromo  = rawOf('promocion') ?? headers.find((h) => /^group$/i.test(h.trim())) ?? null
  const rawStatus = rawOf('gp_training_status')

  console.log('\nColumn resolution:')
  console.log('  id     →', rawId)
  console.log('  name   →', rawName)
  console.log('  promo  →', rawPromo)
  console.log('  status →', rawStatus)

  // Fetch all candidates
  console.log('\nFetching candidates_kpi …')
  const { data: candidates, error } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name')

  if (error) throw new Error(`Supabase error: ${error.message}`)
  console.log('Candidates fetched:', candidates?.length ?? 0)

  const knownIds   = new Set<string>((candidates ?? []).map((c) => c.id))
  const knownNames = new Set<string>(
    (candidates ?? []).filter((c) => c.full_name).map((c) => normalizeName(c.full_name!))
  )

  // Collect not-matched rows
  const notMatched: { rowNum: number; name: string; zohoId: string; status: string; promo: string }[] = []
  let totalRefErrors = 0
  let totalEmpty = 0
  let totalScanned = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const zohoId = rawId   ? (row[rawId]   ?? '').trim() : ''
    const name   = rawName ? (row[rawName]  ?? '').trim() : ''
    const status = rawStatus ? (row[rawStatus] ?? '').trim() : ''
    const promo  = rawPromo  ? (row[rawPromo]  ?? '').trim() : ''

    // Skip completely empty rows
    if (!zohoId && !name) { totalEmpty++; continue }

    // Skip sheet formula error rows (broken cross-sheet references)
    if (zohoId === '#REF!' || name === '#REF!') { totalRefErrors++; continue }

    totalScanned++

    const matchedById   = zohoId && knownIds.has(zohoId)
    const matchedByName = name && knownNames.has(normalizeName(name))

    if (!matchedById && !matchedByName) {
      notMatched.push({ rowNum: i + 2, name, zohoId, status, promo })
    }
  }

  console.log('\nRow breakdown:')
  console.log('  Total GP rows:   ', rows.length)
  console.log('  Empty (skipped): ', totalEmpty)
  console.log('  #REF! (skipped): ', totalRefErrors)
  console.log('  Scanned:         ', totalScanned)
  console.log('  Not-matched:     ', notMatched.length)

  console.log('\n=== FIRST 5 NOT-MATCHED ROWS (excluding #REF! and empty) ===')
  if (notMatched.length === 0) {
    console.log('All rows matched — no notMatched cases found (all real rows have a matching candidate).')
  } else {
    for (const r of notMatched.slice(0, 5)) {
      console.log(`\nRow ${r.rowNum}:`)
      console.log('  Name:             ', r.name)
      console.log('  Zoho ID:          ', r.zohoId || '(empty)')
      console.log('  Status (Training):', r.status || '(empty)')
      console.log('  Group/Promo:      ', r.promo  || '(empty)')
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
