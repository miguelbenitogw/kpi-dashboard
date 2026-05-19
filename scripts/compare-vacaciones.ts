/**
 * compare-vacaciones.ts
 *
 * Compares vacation data in Supabase (team_vacations_kpi) against
 * what's actually parsed from the Calendario tabs in Google Sheets.
 *
 * Usage:
 *   cd kpi-dashboard
 *   npx tsx scripts/compare-vacaciones.ts
 */

// ─── Env loader ───────────────────────────────────────────────────────────────
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

const cwd = process.cwd()
loadEnvFile(resolve(cwd, '.env.production-local'))
loadEnvFile(resolve(cwd, '.env.local'))
extractJsonEnvVar(resolve(cwd, '.env.production-local'), 'GOOGLE_SERVICE_ACCOUNT_JSON')
extractJsonEnvVar(resolve(cwd, '.env.local'), 'GOOGLE_SERVICE_ACCOUNT_JSON')

// ─── Imports ──────────────────────────────────────────────────────────────────
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase setup ───────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Google Sheets setup ──────────────────────────────────────────────────────

function parseServiceAccountJson(raw: string): Record<string, string> {
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()
  let parsed: Record<string, string> | null = null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') parsed = p as Record<string, string>
    else if (typeof p === 'string') parsed = JSON.parse(p) as Record<string, string>
  } catch {}
  if (!parsed) {
    const normalized = raw.replace(/\\\r\n/g, '\\n').replace(/\\\n/g, '\\n').replace(/\\"/g, '"')
    parsed = JSON.parse(normalized) as Record<string, string>
  }
  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  }
  return parsed
}

function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set')
  const credentials = parseServiceAccountJson(raw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ─── Parsing logic (exact copy from import-vacaciones.ts) ────────────────────

const SPREADSHEET_ID = '1KkPzhQkX5uYF_NdktAzTxdIdDevDBZAD4V-UIsFyUUg'

const MONTH_NAME_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

interface MonthBlock {
  month: number
  year: number
  colStart: number
  colCount: number
  fridayOffset: number
}

function cell(row: unknown[] | undefined, col: number): string {
  if (!row || col < 0 || col >= row.length) return ''
  return String(row[col] ?? '').trim()
}

function parseMonthHeader(s: string): { month: number; year: number } | null {
  const trimmed = s.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^([a-záéíóúñA-ZÁÉÍÓÚÑ]+)\s+(\d{4})$/i)
  if (!match) return null
  const monthName = match[1]!.toLowerCase()
  const year = parseInt(match[2]!, 10)
  const month = MONTH_NAME_MAP[monthName]
  if (!month) return null
  return { month, year }
}

function isDayOfWeekRow(row: unknown[]): boolean {
  const cells = row.map((c) => String(c ?? '').trim().toLowerCase())
  const hasFriday = cells.some((c) => c === 'v' || c === 'f')
  const hasMonday = cells.some((c) => c === 'l' || (c === 'm' && cells.includes('v')))
  const hasSunday = cells.some((c) => c === 'd' || c === 'sn' || c === 'su')
  return hasFriday && (hasMonday || hasSunday)
}

function findFridayColumns(row: unknown[]): number[] {
  const fridayCols: number[] = []
  for (let i = 0; i < row.length; i++) {
    const c = String(row[i] ?? '').trim().toLowerCase()
    if (c === 'v' || c === 'f') fridayCols.push(i)
  }
  return fridayCols
}

function detectMonthBlocks(monthHeaderRow: unknown[], dayOfWeekRow: unknown[]): MonthBlock[] {
  const blocks: MonthBlock[] = []
  const monthPositions: Array<{ month: number; year: number; col: number }> = []

  for (let i = 0; i < monthHeaderRow.length; i++) {
    const parsed = parseMonthHeader(cell(monthHeaderRow, i))
    if (parsed) monthPositions.push({ ...parsed, col: i })
  }
  if (monthPositions.length === 0) return blocks

  const fridayCols = findFridayColumns(dayOfWeekRow)

  for (let mi = 0; mi < monthPositions.length; mi++) {
    const mp = monthPositions[mi]!
    let colStart = mp.col
    const dowCell = String(dayOfWeekRow[colStart] ?? '').trim()
    if (!dowCell) colStart = mp.col + 1

    let fridayOffset = 4
    for (const fc of fridayCols) {
      if (fc >= colStart && fc < colStart + 7) { fridayOffset = fc - colStart; break }
    }
    blocks.push({ month: mp.month, year: mp.year, colStart, colCount: 7, fridayOffset })
  }
  return blocks
}

function isDayNumber(val: string): boolean {
  if (!val) return false
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= 1 && n <= 31 && String(n) === val
}

function isWeekRow(row: unknown[], blocks: MonthBlock[]): boolean {
  for (const block of blocks) {
    let dayCount = 0
    for (let offset = 0; offset < block.colCount; offset++) {
      if (isDayNumber(cell(row, block.colStart + offset))) dayCount++
    }
    if (dayCount >= 1) return true
  }
  return false
}

function isAllCaps(name: string): boolean {
  const letters = name.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '')
  if (letters.length === 0) return false
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase()
}

function shouldSkipCell(val: string): boolean {
  if (!val) return true
  const upper = val.toUpperCase()
  if (upper === 'FESTIVO' || upper.startsWith('FESTIVO ')) return true
  if (upper.startsWith('CUMPLE')) return true
  if (/\btrabajan?\b/i.test(val)) return true
  if (/^\d{1,2}\s+de\s+/i.test(val)) return true
  if (val.includes('.') && /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|sept|oct|nov|dic|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(val)) return true
  if (/^[A-Z]$/.test(val) || /^(Sn|Su|Th|Año\s|AÑO)$/i.test(val)) return true
  if (/^(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(val) && /\d{4}/.test(val)) return true
  if (/leyenda|festivos?\s+nacionales?|semana\s+santa|vacaciones\s+y/i.test(val)) return true
  if (val.length > 30) return true
  return false
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

interface CalendarioVacation {
  name: string
  date: string
  year: number
}

function parseCalendarioTab(rawValues: unknown[][]): CalendarioVacation[] {
  const vacations: CalendarioVacation[] = []
  if (rawValues.length < 3) return vacations

  let rowIdx = 0
  while (rowIdx < rawValues.length) {
    const row = rawValues[rowIdx]!
    let foundMonths = false
    for (let c = 0; c < (row?.length ?? 0); c++) {
      if (parseMonthHeader(cell(row, c))) { foundMonths = true; break }
    }
    if (!foundMonths) { rowIdx++; continue }

    const monthHeaderRow = row
    const monthHeaderRowIdx = rowIdx

    let dowRowIdx = monthHeaderRowIdx + 1
    while (dowRowIdx < rawValues.length) {
      if (isDayOfWeekRow(rawValues[dowRowIdx]!)) break
      dowRowIdx++
      if (dowRowIdx - monthHeaderRowIdx > 3) break
    }
    if (dowRowIdx >= rawValues.length || !isDayOfWeekRow(rawValues[dowRowIdx]!)) {
      rowIdx++; continue
    }

    const dayOfWeekRow = rawValues[dowRowIdx]!
    const blocks = detectMonthBlocks(monthHeaderRow, dayOfWeekRow)
    if (blocks.length === 0) { rowIdx = dowRowIdx + 1; continue }

    let scanIdx = dowRowIdx + 1
    const currentDays: Map<number, Map<number, number>> = new Map()
    for (let bi = 0; bi < blocks.length; bi++) currentDays.set(bi, new Map())

    while (scanIdx < rawValues.length) {
      const scanRow = rawValues[scanIdx]!
      let isNewMonthHeader = false
      for (let c = 0; c < (scanRow?.length ?? 0); c++) {
        if (parseMonthHeader(cell(scanRow, c))) { isNewMonthHeader = true; break }
      }
      if (isNewMonthHeader) break

      if (isWeekRow(scanRow, blocks)) {
        for (let bi = 0; bi < blocks.length; bi++) {
          const block = blocks[bi]!
          const dayMap = currentDays.get(bi)!
          dayMap.clear()
          for (let offset = 0; offset < block.colCount; offset++) {
            const val = cell(scanRow, block.colStart + offset)
            if (isDayNumber(val)) dayMap.set(offset, parseInt(val, 10))
          }
        }
        scanIdx++; continue
      }

      for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi]!
        const dayMap = currentDays.get(bi)!
        for (let offset = 0; offset < block.colCount; offset++) {
          const val = cell(scanRow, block.colStart + offset)
          if (!val || shouldSkipCell(val)) continue
          const dayNumber = dayMap.get(offset)
          if (!dayNumber) continue
          const isFridayCol = offset === block.fridayOffset
          const names = val.includes('/') ? val.split('/') : [val]
          for (const rawName of names) {
            const name = normalizeName(rawName)
            if (!name || shouldSkipCell(name)) continue
            if (isFridayCol && isAllCaps(name)) continue
            const dateStr = `${block.year}-${String(block.month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
            vacations.push({ name, date: dateStr, year: block.year })
          }
        }
      }
      scanIdx++
    }
    rowIdx = scanIdx
  }
  return vacations
}

// ─── Comparison types ─────────────────────────────────────────────────────────

type MemberDateMap = Map<string, Set<string>>

function normalizeForCompare(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// ─── DB fetch ─────────────────────────────────────────────────────────────────

async function fetchDBData(
  supabase: ReturnType<typeof createClient>,
  years: number[],
): Promise<{
  byYear: Map<number, MemberDateMap>
  memberIdToName: Map<number, string>
}> {
  const { data: members, error: memberErr } = await supabase
    .from('team_members_kpi')
    .select('id, name')

  if (memberErr) throw new Error(`Failed to fetch members: ${memberErr.message}`)
  if (!members) throw new Error('No members returned')

  const memberIdToName = new Map<number, string>()
  for (const m of members as Array<{ id: number; name: string }>) {
    memberIdToName.set(m.id, m.name)
  }

  const { data: vacations, error: vacErr } = await supabase
    .from('team_vacations_kpi')
    .select('member_id, year, vacation_date')
    .in('year', years)

  if (vacErr) throw new Error(`Failed to fetch vacations: ${vacErr.message}`)
  if (!vacations) throw new Error('No vacations returned')

  const byYear = new Map<number, MemberDateMap>()
  for (const year of years) byYear.set(year, new Map())

  for (const v of vacations as Array<{ member_id: number; year: number; vacation_date: string }>) {
    const memberName = memberIdToName.get(v.member_id)
    if (!memberName) continue
    const normalizedName = normalizeForCompare(memberName)
    const yearMap = byYear.get(v.year)!
    if (!yearMap.has(normalizedName)) yearMap.set(normalizedName, new Set())
    const dateOnly = v.vacation_date.slice(0, 10)
    yearMap.get(normalizedName)!.add(dateOnly)
  }

  return { byYear, memberIdToName }
}

// ─── Sheets fetch ─────────────────────────────────────────────────────────────

async function fetchSheetsData(
  sheets: ReturnType<typeof getSheetsClient>,
  years: number[],
): Promise<{
  byYear: Map<number, MemberDateMap>
  originalNames: Map<string, string>  // normalized -> first seen original
}> {
  const metaRes = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties.title',
  })

  const allTabs = (metaRes.data.sheets ?? []).map(
    (s: { properties?: { title?: string } }) => s.properties?.title ?? ''
  ).filter(Boolean) as string[]

  const calendarioTabs = allTabs.filter((name) => {
    if (!name.startsWith('Calendario')) return false
    const yearMatch = name.match(/(\d{4})/)
    if (!yearMatch) return false
    const year = parseInt(yearMatch[1]!, 10)
    return years.includes(year)
  })

  console.log(`Found Calendario tabs: ${calendarioTabs.join(', ')}`)

  const byYear = new Map<number, MemberDateMap>()
  for (const year of years) byYear.set(year, new Map())

  const originalNames = new Map<string, string>()

  for (const tabName of calendarioTabs) {
    console.log(`Fetching tab: ${tabName}`)
    const safeRange = `'${tabName.replace(/'/g, "''")}'`
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: safeRange,
    })

    const rawValues = (res.data.values ?? []) as unknown[][]
    const vacations = parseCalendarioTab(rawValues)
    console.log(`  → Parsed ${vacations.length} vacation entries`)

    for (const v of vacations) {
      if (!years.includes(v.year)) continue
      const normalizedName = normalizeForCompare(v.name)
      if (!originalNames.has(normalizedName)) originalNames.set(normalizedName, v.name)

      const yearMap = byYear.get(v.year)!
      if (!yearMap.has(normalizedName)) yearMap.set(normalizedName, new Set())
      yearMap.get(normalizedName)!.add(v.date)
    }
  }

  return { byYear, originalNames }
}

// ─── Comparison ───────────────────────────────────────────────────────────────

interface YearReport {
  year: number
  sheetsMembersCount: number
  dbMembersCount: number
  onlyInSheets: string[]
  onlyInDB: string[]
  differences: Array<{
    name: string
    missingFromDB: string[]
    phantomInDB: string[]
  }>
  totalMissingFromDB: number
  totalPhantomInDB: number
}

function compareYear(
  year: number,
  sheetsMap: MemberDateMap,
  dbMap: MemberDateMap,
  sheetsOriginalNames: Map<string, string>,
  dbOriginalNames: Map<string, string>,
): YearReport {
  const sheetsNormNames = new Set(sheetsMap.keys())
  const dbNormNames = new Set(dbMap.keys())

  const onlyInSheets = [...sheetsNormNames]
    .filter((n) => !dbNormNames.has(n))
    .map((n) => sheetsOriginalNames.get(n) ?? n)
    .sort()

  const onlyInDB = [...dbNormNames]
    .filter((n) => !sheetsNormNames.has(n))
    .map((n) => dbOriginalNames.get(n) ?? n)
    .sort()

  const differences: YearReport['differences'] = []
  let totalMissingFromDB = 0
  let totalPhantomInDB = 0

  for (const normName of sheetsNormNames) {
    if (!dbNormNames.has(normName)) continue
    const sheetsDates = sheetsMap.get(normName)!
    const dbDates = dbMap.get(normName)!
    const missingFromDB = [...sheetsDates].filter((d) => !dbDates.has(d)).sort()
    const phantomInDB = [...dbDates].filter((d) => !sheetsDates.has(d)).sort()

    if (missingFromDB.length > 0 || phantomInDB.length > 0) {
      const displayName = sheetsOriginalNames.get(normName) ?? dbOriginalNames.get(normName) ?? normName
      differences.push({ name: displayName, missingFromDB, phantomInDB })
      totalMissingFromDB += missingFromDB.length
      totalPhantomInDB += phantomInDB.length
    }
  }

  differences.sort((a, b) => a.name.localeCompare(b.name))

  return {
    year,
    sheetsMembersCount: sheetsNormNames.size,
    dbMembersCount: dbNormNames.size,
    onlyInSheets,
    onlyInDB,
    differences,
    totalMissingFromDB,
    totalPhantomInDB,
  }
}

function printReport(report: YearReport): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`=== COMPARISON REPORT: ${report.year} ===`)
  console.log(`${'='.repeat(60)}`)
  console.log()
  console.log(`Members in Sheets: ${report.sheetsMembersCount}`)
  console.log(`Members in DB:     ${report.dbMembersCount}`)
  console.log()

  if (report.onlyInSheets.length > 0) {
    console.log(`Members ONLY in Sheets (not in DB):`)
    for (const n of report.onlyInSheets) console.log(`  - ${n}`)
  } else {
    console.log(`Members only in Sheets: (none)`)
  }
  console.log()

  if (report.onlyInDB.length > 0) {
    console.log(`Members ONLY in DB (not in Sheets):`)
    for (const n of report.onlyInDB) console.log(`  - ${n}`)
  } else {
    console.log(`Members only in DB: (none)`)
  }
  console.log()

  if (report.differences.length > 0) {
    console.log(`--- Per-member differences ---`)
    for (const diff of report.differences) {
      console.log()
      console.log(`[${diff.name}]:`)
      if (diff.missingFromDB.length > 0) {
        console.log(`  In Sheets, missing from DB (${diff.missingFromDB.length}): ${diff.missingFromDB.join(', ')}`)
      }
      if (diff.phantomInDB.length > 0) {
        console.log(`  In DB, missing from Sheets (${diff.phantomInDB.length}): ${diff.phantomInDB.join(', ')}`)
      }
    }
  } else {
    console.log(`--- Per-member differences: none ---`)
  }

  const totalDiscrepancies =
    report.onlyInSheets.length +
    report.onlyInDB.length +
    report.totalMissingFromDB +
    report.totalPhantomInDB

  console.log()
  console.log(`=== SUMMARY for ${report.year} ===`)
  console.log(`Total discrepancies:      ${totalDiscrepancies}`)
  console.log(`Members with date diffs:  ${report.differences.length}`)
  console.log(`Members only in Sheets:   ${report.onlyInSheets.length}`)
  console.log(`Members only in DB:       ${report.onlyInDB.length}`)
  console.log(`Missing from DB:          ${report.totalMissingFromDB} days`)
  console.log(`Phantom in DB:            ${report.totalPhantomInDB} days`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const years = [2025, 2026]

  console.log('=== Vacaciones comparison: Sheets vs DB ===\n')

  // Verify env vars loaded
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const gsaJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  console.log(`NEXT_PUBLIC_SUPABASE_URL:    ${url ? url.slice(0, 30) + '...' : 'MISSING'}`)
  console.log(`SUPABASE_SERVICE_ROLE_KEY:   ${key ? key.slice(0, 10) + '...' : 'MISSING'}`)
  console.log(`GOOGLE_SERVICE_ACCOUNT_JSON: ${gsaJson ? 'present (' + gsaJson.length + ' chars)' : 'MISSING'}`)

  const supabase = getSupabaseAdmin()
  const sheets = getSheetsClient()

  // ── Step 1: DB data ────────────────────────────────────────────────────────
  console.log('\nStep 1: Fetching DB data...')
  const { byYear: dbByYear, memberIdToName } = await fetchDBData(supabase, years)

  for (const [year, map] of dbByYear) {
    let totalDays = 0
    for (const dates of map.values()) totalDays += dates.size
    console.log(`  DB ${year}: ${map.size} members, ${totalDays} vacation days`)
  }

  const dbOriginalNames = new Map<string, string>()
  for (const name of memberIdToName.values()) {
    dbOriginalNames.set(normalizeForCompare(name), name)
  }

  // ── Step 2: Sheets data ────────────────────────────────────────────────────
  console.log('\nStep 2: Fetching Sheets data...')
  const { byYear: sheetsByYear, originalNames: sheetsOriginalNames } = await fetchSheetsData(sheets, years)

  for (const [year, map] of sheetsByYear) {
    let totalDays = 0
    for (const dates of map.values()) totalDays += dates.size
    console.log(`  Sheets ${year}: ${map.size} members, ${totalDays} vacation days`)
  }

  // Supplement sheetsOriginalNames: if a normalized name exists in DB, prefer the DB original
  for (const normName of sheetsOriginalNames.keys()) {
    if (dbOriginalNames.has(normName)) {
      sheetsOriginalNames.set(normName, dbOriginalNames.get(normName)!)
    }
  }

  // ── Step 3: Compare ────────────────────────────────────────────────────────
  console.log('\nStep 3: Comparing...')

  const reports: YearReport[] = []
  for (const year of years) {
    const sheetsMap = sheetsByYear.get(year) ?? new Map()
    const dbMap = dbByYear.get(year) ?? new Map()
    const report = compareYear(year, sheetsMap, dbMap, sheetsOriginalNames, dbOriginalNames)
    reports.push(report)
    printReport(report)
  }

  // ── Overall summary ────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`)
  console.log('=== OVERALL SUMMARY (2025 + 2026) ===')
  console.log(`${'='.repeat(60)}`)
  let grandTotal = 0
  let grandMissing = 0
  let grandPhantom = 0
  let grandMembersWithDiffs = 0

  for (const r of reports) {
    const total = r.onlyInSheets.length + r.onlyInDB.length + r.totalMissingFromDB + r.totalPhantomInDB
    grandTotal += total
    grandMissing += r.totalMissingFromDB
    grandPhantom += r.totalPhantomInDB
    grandMembersWithDiffs += r.differences.length

    console.log(`${r.year}: ${total} total discrepancies | ${r.totalMissingFromDB} missing from DB | ${r.totalPhantomInDB} phantom in DB | ${r.onlyInSheets.length} members only in Sheets | ${r.onlyInDB.length} members only in DB`)
  }

  console.log()
  console.log(`GRAND TOTAL:`)
  console.log(`  Total discrepancies:      ${grandTotal}`)
  console.log(`  Members with date diffs:  ${grandMembersWithDiffs}`)
  console.log(`  Days missing from DB:     ${grandMissing}`)
  console.log(`  Phantom days in DB:       ${grandPhantom}`)
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : String(err))
  if (err instanceof Error && err.stack) console.error(err.stack)
  process.exit(1)
})
