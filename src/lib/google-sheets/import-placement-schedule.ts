/**
 * Placement Schedule importer — reads "Calendar 2026 - Schedule and Holidays"
 * from the placement team's Google Sheet.
 *
 * Uses spreadsheets.get with includeGridData:true to retrieve both cell values
 * AND background colours (which encode online vs presencial modality).
 *
 * Sheet layout:
 *   - 2 months per horizontal band (cols 0-7 = month 1, cols 9-16 = month 2)
 *   - Month header row: "ene 2026", "feb 2026", …
 *   - Day-of-week header row: M T W Th F S Sn
 *   - Repeating: week row (day numbers) + person schedule rows
 *
 * Each schedule cell: "NAME\nHH:MM - HH:MM" or variations — see parseScheduleCell.
 */

import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = '1j6nqb6iN74tCjN1VSFdXonwTBZhetyCjEhIIlG6fO6Y'
const TAB_NAME = 'Calendar 2026 - Schedule and Holidays'

/** Known team members — also handles typos */
const KNOWN_NAMES = new Set([
  'INGRID', 'KATRINE', 'MIRIAM', 'GRO', 'FRIDA', 'KAROLINE', 'TUVA',
])

/** Typo → canonical */
const NAME_CORRECTIONS: Record<string, string> = {
  GRP: 'GRO',
  'GRO.': 'GRO',
}

// ─────────────────────────────────────────────────────────────────────────────
// Month name map (same as import-vacaciones)
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAME_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
}

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export interface PlacementScheduleImportResult {
  membersUpserted: number
  schedulesUpserted: number
  errors: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface RgbColor {
  red?: number | null
  green?: number | null
  blue?: number | null
}

interface CellData {
  text: string
  color: RgbColor | null
}

interface MonthBlock {
  month: number
  year: number
  colStart: number   // first day column (inclusive)
  colCount: number   // always 7
}

interface ParsedSchedule {
  name: string
  rawCell: string
  timeStart: string | null
  timeEnd: string | null
  timeStart2: string | null
  timeEnd2: string | null
  status: string     // 'working' | 'holiday' | 'vacation' | 'leave' | 'skip'
  modality: string   // 'online' | 'presencial' | 'holiday'
  notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-account auth (copied from import-vacaciones)
// ─────────────────────────────────────────────────────────────────────────────

function parseServiceAccountJson(raw: string): Record<string, string> {
  if (raw.startsWith("'")) raw = raw.replace(/^'+|'+$/g, '').trim()

  let parsed: Record<string, string> | null = null

  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') {
      parsed = p as Record<string, string>
    } else if (typeof p === 'string') {
      parsed = JSON.parse(p) as Record<string, string>
    }
  } catch {
    // fall through
  }

  if (!parsed) {
    const normalized = raw
      .replace(/\\\r\n/g, '\\n')
      .replace(/\\\n/g, '\\n')
      .replace(/\\"/g, '"')
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

// ─────────────────────────────────────────────────────────────────────────────
// Color → modality
// ─────────────────────────────────────────────────────────────────────────────

function toHex2(n: number | null | undefined): string {
  return Math.round((n ?? 0) * 255).toString(16).padStart(2, '0')
}

function rgbToHex(c: RgbColor): string {
  return `#${toHex2(c.red)}${toHex2(c.green)}${toHex2(c.blue)}`
}

/**
 * Determines modality from cell background colour.
 *
 * Known hex mapping:
 *   Lila/purple (light): #b4a7d6 #b4a7d7 #d9d2e9 → online
 *   Dark purple:         #8e7cc3                  → online (short day)
 *   Yellow/gold:         #ffd966 #fbbc04 #fff2cc #ffe599 → presencial
 *   Pink:                #c27ba0                  → presencial
 *   Turquoise:           #46bdc6                  → holiday
 *   Green / festivo:     #7fd028 #559aec #d9ead3  → skip
 *   White:               #ffffff                  → skip
 *
 * Classification fallback:
 *   If red > 0.8 AND green > 0.7 → presencial (captures yellows)
 *   If blue ≥ 0.7 AND blue > green+red*0.5 → online (captures purples/blues)
 *   Otherwise → online (safe default for work cells)
 */
function colorToModality(c: RgbColor | null): string {
  if (!c) return 'online'

  const hex = rgbToHex(c)

  // Explicit known mappings
  const ONLINE_HEXES = new Set([
    '#b4a7d6', '#b4a7d7', '#d9d2e9', '#8e7cc3',
  ])
  const PRESENCIAL_HEXES = new Set([
    '#ffd966', '#fbbc04', '#fff2cc', '#ffe599', '#c27ba0',
  ])
  const HOLIDAY_HEXES = new Set([
    '#46bdc6',
  ])
  const SKIP_HEXES = new Set([
    '#7fd028', '#559aec', '#d9ead3', '#ffffff',
    '#ffffff',
  ])

  if (ONLINE_HEXES.has(hex)) return 'online'
  if (PRESENCIAL_HEXES.has(hex)) return 'presencial'
  if (HOLIDAY_HEXES.has(hex)) return 'holiday'
  if (SKIP_HEXES.has(hex)) return 'skip'

  // Numeric fallback
  const r = c.red ?? 0
  const g = c.green ?? 0
  const b = c.blue ?? 0

  // Pure white / near-white → skip
  if (r > 0.95 && g > 0.95 && b > 0.95) return 'skip'

  // Yellows: high red + high green, low blue
  if (r > 0.8 && g > 0.7 && b < 0.5) return 'presencial'

  // Blues/purples: blue dominant
  if (b > 0.6 && b >= r) return 'online'

  // Turquoise: green + blue
  if (g > 0.6 && b > 0.6 && r < 0.5) return 'holiday'

  return 'online'
}

// ─────────────────────────────────────────────────────────────────────────────
// Time normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw time token to "HH:MM".
 * Accepts: "9", "09", "930", "0830", "9:00", "9.00"
 * Returns null if unparseable.
 */
function normalizeTime(raw: string): string | null {
  const t = raw.trim().replace(/\./g, ':')

  // Already HH:MM
  const colonMatch = t.match(/^(\d{1,2}):(\d{2})$/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1]!, 10)
    const m = parseInt(colonMatch[2]!, 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // 4-digit compact: 0830, 1715
  const compact4 = t.match(/^(\d{2})(\d{2})$/)
  if (compact4) {
    const h = parseInt(compact4[1]!, 10)
    const m = parseInt(compact4[2]!, 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // 3-digit compact: 830
  const compact3 = t.match(/^(\d)(\d{2})$/)
  if (compact3) {
    const h = parseInt(compact3[1]!, 10)
    const m = parseInt(compact3[2]!, 10)
    if (h >= 0 && h <= 9 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  // Single/double digit hour only: "9" or "10"
  const hourOnly = t.match(/^(\d{1,2})$/)
  if (hourOnly) {
    const h = parseInt(hourOnly[1]!, 10)
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:00`
    }
  }

  return null
}

/**
 * Parse a time range string like "9:00 - 13:00", "9:00 to 13:00", "0830-1715"
 * Returns [start, end] or null.
 */
function parseTimeRange(raw: string): [string, string] | null {
  // Separators: " - ", " to ", "-"
  const sep = raw.match(/\s*(?:to|-)\s*/i)
  if (!sep) return null

  const parts = raw.split(/\s*(?:to|-)\s*/i)
  if (parts.length < 2) return null

  const start = normalizeTime(parts[0]!.trim())
  const end = normalizeTime(parts[parts.length - 1]!.trim())

  if (!start || !end) return null
  return [start, end]
}

// ─────────────────────────────────────────────────────────────────────────────
// Name normalization
// ─────────────────────────────────────────────────────────────────────────────

function normalizeMemberName(raw: string): string | null {
  let upper = raw.toUpperCase().trim()

  // Apply typo corrections
  if (NAME_CORRECTIONS[upper]) upper = NAME_CORRECTIONS[upper]!

  // Must be a known name
  if (KNOWN_NAMES.has(upper)) {
    // Return Title Case
    return upper.charAt(0) + upper.slice(1).toLowerCase()
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a schedule cell into structured data.
 *
 * Cell formats:
 *   "INGRID\n9:00 to 13:00"
 *   "KATRINE\n07:30 - 15:00"
 *   "GRO 0830-1715(norway)"
 *   "MIRIAM\n10-15:30 (oficina)"
 *   "FRIDA\n8:30 - 11:30 + 15-18"
 *   "MIRIAM\nHoliday"
 *   "Ingrid ferie"
 *   "Ingrid avspasering" / "Ingrid AP"
 *   "FESTIVO" → skip
 */
function parseScheduleCell(rawText: string, color: RgbColor | null): ParsedSchedule | null {
  const text = rawText.trim()
  if (!text) return null

  const upper = text.toUpperCase()

  // Skip festivo / header / day-of-week cells
  if (
    upper === 'FESTIVO' ||
    upper.startsWith('FESTIVO ') ||
    /^(M|T|W|TH|F|S|SN|SU|L|X|J|V|D)$/.test(upper) ||
    /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SEPT|OCT|NOV|DIC)\s+\d{4}$/i.test(text)
  ) return null

  // Split by newline or find name at start
  // Normalize newlines and split
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const firstLine = lines[0]!.trim()

  // Attempt to extract name from first line
  // Name can be: "INGRID", "Ingrid", "GRO 0830-1715(norway)" — name is word before space/newline
  const namePart = firstLine.split(/[\s\n]/)[0]!.replace(/[.,]$/, '')
  const memberName = normalizeMemberName(namePart)

  if (!memberName) return null

  // Reconstruct the time/status portion
  // Could be: rest of first line + remaining lines
  const restOfFirstLine = firstLine.slice(namePart.length).trim()
  const restLines = lines.slice(1).map((l) => l.trim()).filter(Boolean)
  const timePart = restOfFirstLine || restLines.join(' ')

  const rawCell = text
  let status = 'working'
  let timeStart: string | null = null
  let timeEnd: string | null = null
  let timeStart2: string | null = null
  let timeEnd2: string | null = null
  let notes: string | null = null
  const modality = colorToModality(color)

  // If modality is 'skip' (green/white cells), skip this cell
  if (modality === 'skip') return null

  const timeUpper = timePart.toUpperCase()

  // Status keywords
  if (!timePart || timeUpper === 'HOLIDAY' || timeUpper === 'HELLIGDAG') {
    status = 'holiday'
  } else if (
    /\bferie\b/i.test(timePart) ||
    /\bvacation\b/i.test(timePart) ||
    /\bvacaciones\b/i.test(timePart)
  ) {
    status = 'vacation'
  } else if (
    /\bavspasering\b/i.test(timePart) ||
    /\b(AP)\b/.test(timePart) ||
    /\bleave\b/i.test(timePart) ||
    /\bpermiso\b/i.test(timePart)
  ) {
    status = 'leave'
  } else if (
    /\bsyk\b/i.test(timePart) ||
    /\bsick\b/i.test(timePart) ||
    /\bbaja\b/i.test(timePart)
  ) {
    status = 'sick'
  } else {
    status = 'working'

    // Check for split schedule: "8:30 - 11:30 + 15-18"
    const splitMatch = timePart.match(/^(.+?)\s*\+\s*(.+)$/)
    if (splitMatch) {
      const range1 = parseTimeRange(splitMatch[1]!.trim())
      const range2 = parseTimeRange(splitMatch[2]!.trim())
      if (range1) { timeStart = range1[0]; timeEnd = range1[1] }
      if (range2) { timeStart2 = range2[0]; timeEnd2 = range2[1] }
    } else {
      // Extract optional notes in parentheses
      const notesMatch = timePart.match(/\(([^)]+)\)/)
      if (notesMatch) {
        notes = notesMatch[1]!.trim()
      }
      const cleanTime = timePart.replace(/\([^)]*\)/g, '').trim()

      const range = parseTimeRange(cleanTime)
      if (range) {
        timeStart = range[0]
        timeEnd = range[1]
      }
    }
  }

  // If modality is holiday (turquoise), override status
  if (modality === 'holiday') {
    status = 'holiday'
  }

  return {
    name: memberName,
    rawCell,
    timeStart,
    timeEnd,
    timeStart2,
    timeEnd2,
    status,
    modality: modality === 'holiday' ? 'online' : modality, // store modality as online/presencial
    notes,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Month header / week row helpers (same pattern as import-vacaciones)
// ─────────────────────────────────────────────────────────────────────────────

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

function isDayOfWeekRow(row: CellData[]): boolean {
  const cells = row.map((c) => c.text.trim().toLowerCase())
  const hasFriday = cells.some((c) => c === 'f' || c === 'v')
  const hasSunday = cells.some((c) => c === 'sn' || c === 'su' || c === 'd')
  return hasFriday && hasSunday
}

function isDayNumber(val: string): boolean {
  if (!val) return false
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= 1 && n <= 31 && String(n) === val
}

function isWeekRow(row: CellData[], blocks: MonthBlock[]): boolean {
  for (const block of blocks) {
    let dayCount = 0
    for (let offset = 0; offset < block.colCount; offset++) {
      const val = (row[block.colStart + offset]?.text ?? '').trim()
      if (isDayNumber(val)) dayCount++
    }
    if (dayCount >= 1) return true
  }
  return false
}

/**
 * Detect month blocks from a month header row.
 * Returns ordered array of MonthBlock with colStart + colCount.
 */
function detectMonthBlocks(monthHeaderRow: CellData[]): MonthBlock[] {
  const blocks: MonthBlock[] = []

  for (let i = 0; i < monthHeaderRow.length; i++) {
    const parsed = parseMonthHeader(monthHeaderRow[i]?.text ?? '')
    if (!parsed) continue

    // Find the start of day columns: first col at or after i that is not empty
    // in the day-of-week sense. For this sheet layout cols 0-7 / 9-16 are the two blocks.
    // The week-number column (col 0 / col 9) sits before day cols.
    // We'll use: colStart = i, colCount = 7 (M T W Th F S Sn)
    // but skip the first col if it's the "week" col (integer < 60)
    // We'll resolve this dynamically when we find the day-of-week row.
    // For now just record the header column.
    blocks.push({
      month: parsed.month,
      year: parsed.year,
      colStart: i,
      colCount: 7,
    })
  }

  return blocks
}

/**
 * Refine month blocks using the day-of-week row.
 * The day-of-week row tells us exactly which columns are M/T/W/Th/F/S/Sn.
 */
function refineBlocksWithDowRow(blocks: MonthBlock[], dowRow: CellData[]): MonthBlock[] {
  // Find all columns that contain day-of-week abbreviations
  const dayAbbrevs = new Set(['m', 't', 'w', 'th', 'f', 's', 'sn', 'su', 'l', 'x', 'j', 'v', 'd'])
  const dowCols: number[] = []
  for (let i = 0; i < dowRow.length; i++) {
    const val = dowRow[i]?.text.trim().toLowerCase() ?? ''
    if (dayAbbrevs.has(val)) dowCols.push(i)
  }

  // Assign each block a consecutive range of 7 dow columns
  const refined: MonthBlock[] = []
  let usedCols = 0
  for (const block of blocks) {
    const start = dowCols[usedCols]
    if (start === undefined) {
      refined.push(block)
      usedCols += 7
      continue
    }
    refined.push({ ...block, colStart: start, colCount: 7 })
    usedCols += 7
  }

  return refined
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parse function
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleEntry {
  name: string
  date: string   // YYYY-MM-DD
  year: number
  rawCell: string
  timeStart: string | null
  timeEnd: string | null
  timeStart2: string | null
  timeEnd2: string | null
  status: string
  modality: string
  notes: string | null
}

function parseScheduleSheet(grid: CellData[][]): ScheduleEntry[] {
  const entries: ScheduleEntry[] = []

  let rowIdx = 0

  while (rowIdx < grid.length) {
    const row = grid[rowIdx]!

    // Look for a month header row
    let foundMonths = false
    for (let c = 0; c < row.length; c++) {
      if (parseMonthHeader(row[c]?.text ?? '')) {
        foundMonths = true
        break
      }
    }

    if (!foundMonths) {
      rowIdx++
      continue
    }

    const monthHeaderRow = row
    const monthHeaderRowIdx = rowIdx

    // Find the day-of-week row (should be within 3 rows)
    let dowRowIdx = monthHeaderRowIdx + 1
    while (dowRowIdx < grid.length && dowRowIdx - monthHeaderRowIdx <= 3) {
      if (isDayOfWeekRow(grid[dowRowIdx]!)) break
      dowRowIdx++
    }

    if (dowRowIdx >= grid.length || !isDayOfWeekRow(grid[dowRowIdx]!)) {
      rowIdx++
      continue
    }

    const dowRow = grid[dowRowIdx]!
    let blocks = detectMonthBlocks(monthHeaderRow)
    if (blocks.length === 0) {
      rowIdx = dowRowIdx + 1
      continue
    }
    blocks = refineBlocksWithDowRow(blocks, dowRow)

    // Scan rows after DOW row
    let scanIdx = dowRowIdx + 1

    // Day number state per block: offset → dayNumber
    const currentDays: Map<number, Map<number, number>> = new Map()
    for (let bi = 0; bi < blocks.length; bi++) {
      currentDays.set(bi, new Map())
    }

    while (scanIdx < grid.length) {
      const scanRow = grid[scanIdx]!

      // Check for new month header (end of band)
      let isNewMonthHeader = false
      for (let c = 0; c < scanRow.length; c++) {
        if (parseMonthHeader(scanRow[c]?.text ?? '')) {
          isNewMonthHeader = true
          break
        }
      }
      if (isNewMonthHeader) break

      // Week row?
      if (isWeekRow(scanRow, blocks)) {
        for (let bi = 0; bi < blocks.length; bi++) {
          const block = blocks[bi]!
          const dayMap = currentDays.get(bi)!
          dayMap.clear()
          for (let offset = 0; offset < block.colCount; offset++) {
            const val = (scanRow[block.colStart + offset]?.text ?? '').trim()
            if (isDayNumber(val)) {
              dayMap.set(offset, parseInt(val, 10))
            }
          }
        }
        scanIdx++
        continue
      }

      // Schedule row — parse each cell
      for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi]!
        const dayMap = currentDays.get(bi)!

        for (let offset = 0; offset < block.colCount; offset++) {
          const cellData = scanRow[block.colStart + offset]
          if (!cellData || !cellData.text.trim()) continue

          const dayNumber = dayMap.get(offset)
          if (!dayNumber) continue

          const parsed = parseScheduleCell(cellData.text, cellData.color)
          if (!parsed) continue
          if (parsed.status === 'skip') continue

          const dateStr = `${block.year}-${String(block.month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`

          entries.push({
            name: parsed.name,
            date: dateStr,
            year: block.year,
            rawCell: parsed.rawCell,
            timeStart: parsed.timeStart,
            timeEnd: parsed.timeEnd,
            timeStart2: parsed.timeStart2,
            timeEnd2: parsed.timeEnd2,
            status: parsed.status,
            modality: parsed.modality,
            notes: parsed.notes,
          })
        }
      }

      scanIdx++
    }

    rowIdx = scanIdx
  }

  return entries
}

// ─────────────────────────────────────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────────────────────────────────────

export async function importPlacementSchedule(): Promise<PlacementScheduleImportResult> {
  const result: PlacementScheduleImportResult = {
    membersUpserted: 0,
    schedulesUpserted: 0,
    errors: [],
  }

  // ── 1. Fetch sheet with colour data ───────────────────────────────────────
  const sheets = getSheetsClient()

  let grid: CellData[][]
  try {
    const safeTab = TAB_NAME.replace(/'/g, "''")
    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [`'${safeTab}'!A1:Q300`],
      includeGridData: true,
    })

    const gridData = res.data.sheets?.[0]?.data?.[0]
    if (!gridData?.rowData) {
      result.errors.push('No grid data returned from Google Sheets')
      return result
    }

    grid = gridData.rowData.map((rowData) => {
      const values = rowData.values ?? []
      return values.map((cellVal): CellData => ({
        text: (cellVal.formattedValue ?? '').trim(),
        color: (cellVal.effectiveFormat?.backgroundColor as RgbColor | null) ?? null,
      }))
    })
  } catch (err) {
    result.errors.push(`Google Sheets fetch error: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  // ── 2. Parse schedule entries ─────────────────────────────────────────────
  let entries: ScheduleEntry[]
  try {
    entries = parseScheduleSheet(grid)
  } catch (err) {
    result.errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  if (entries.length === 0) {
    result.errors.push('No schedule entries found after parsing')
    return result
  }

  // ── 3. Collect unique member names ────────────────────────────────────────
  const memberNames = new Set(entries.map((e) => e.name))

  // ── 4. Upsert members into placement_team_members ─────────────────────────
  const memberIdMap = new Map<string, number>()

  for (const name of memberNames) {
    const { data: memberData, error: memberError } = await (supabaseAdmin as any)
      .from('placement_team_members')
      .upsert({ name, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'name' })
      .select('id')
      .single()

    if (memberError || !memberData) {
      result.errors.push(`[${name}] member upsert error: ${memberError?.message ?? 'no data'}`)
      continue
    }

    memberIdMap.set(name, (memberData as { id: number }).id)
    result.membersUpserted++
  }

  // ── 5. Upsert schedules in batches ────────────────────────────────────────
  const scheduleRows = entries
    .filter((e) => memberIdMap.has(e.name))
    .map((e) => ({
      member_id: memberIdMap.get(e.name)!,
      schedule_date: e.date,
      year: e.year,
      raw_cell: e.rawCell,
      time_start: e.timeStart,
      time_end: e.timeEnd,
      time_start_2: e.timeStart2,
      time_end_2: e.timeEnd2,
      status: e.status,
      modality: e.modality,
      notes: e.notes,
    }))

  const BATCH_SIZE = 500
  for (let i = 0; i < scheduleRows.length; i += BATCH_SIZE) {
    const batch = scheduleRows.slice(i, i + BATCH_SIZE)

    const { error: upsertError } = await (supabaseAdmin as any)
      .from('placement_schedules')
      .upsert(batch, { onConflict: 'member_id,schedule_date' })

    if (upsertError) {
      result.errors.push(`Schedule batch upsert error: ${upsertError.message}`)
    } else {
      result.schedulesUpserted += batch.length
    }
  }

  return result
}
