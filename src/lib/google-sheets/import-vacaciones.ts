import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase/server'
import { listSheets, readSheetByName } from './client'

const SPREADSHEET_ID = '1KkPzhQkX5uYF_NdktAzTxdIdDevDBZAD4V-UIsFyUUg'

const IMPORT_YEARS = [2024, 2025, 2026]

// ─────────────────────────────────────────────────────────────────────────────
// Month name mappings (Spanish + English, case-insensitive)
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAME_MAP: Record<string, number> = {
  // Spanish
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  // English
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VacacionesImportResult {
  membersUpserted: number
  vacationDaysUpserted: number
  tabsProcessed: number
  tabsSkipped: number
  errors: string[]
}

/** A single vacation entry parsed from the calendario */
interface CalendarioVacation {
  name: string
  date: string // YYYY-MM-DD
  year: number
}

/** Describes one month block inside a calendario row-band */
interface MonthBlock {
  month: number
  year: number
  /** First column index (inclusive) for this month's day columns */
  colStart: number
  /** Number of day columns (always 7) */
  colCount: number
  /** The column index for Friday within this block (0-based offset from colStart) */
  fridayOffset: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-account auth (duplicated minimally — client.ts has its own)
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
// Calendario parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Cell accessor — returns trimmed string, empty string if missing */
function cell(row: unknown[] | undefined, col: number): string {
  if (!row || col < 0 || col >= row.length) return ''
  return String(row[col] ?? '').trim()
}

/** Checks if a string is a month+year header like "January 2025" or "enero 2024" */
function parseMonthHeader(s: string): { month: number; year: number } | null {
  const trimmed = s.trim()
  if (!trimmed) return null

  // "January 2025", "enero 2024", "ENERO 2025"
  const match = trimmed.match(/^([a-záéíóúñA-ZÁÉÍÓÚÑ]+)\s+(\d{4})$/i)
  if (!match) return null

  const monthName = match[1]!.toLowerCase()
  const year = parseInt(match[2]!, 10)
  const month = MONTH_NAME_MAP[monthName]
  if (!month) return null

  return { month, year }
}

/**
 * Checks if a row is a day-of-week header row.
 * Spanish: L, M, X, J, V, S, D
 * English: M, T, W, Th, F, S, Sn (or Su)
 */
function isDayOfWeekRow(row: unknown[]): boolean {
  const cells = row.map((c) => String(c ?? '').trim().toLowerCase())
  // Check for presence of Friday indicator
  const hasFriday = cells.some((c) => c === 'v' || c === 'f')
  // Check for presence of Monday indicator
  const hasMonday = cells.some((c) => c === 'l' || (c === 'm' && cells.includes('v')))
  // Also check for "sn" or "d" (Sunday markers)
  const hasSunday = cells.some((c) => c === 'd' || c === 'sn' || c === 'su')

  return hasFriday && (hasMonday || hasSunday)
}

/**
 * Given a day-of-week header row, finds the column index for Friday
 * within each month block.
 */
function findFridayColumns(row: unknown[]): number[] {
  const fridayCols: number[] = []
  for (let i = 0; i < row.length; i++) {
    const c = String(row[i] ?? '').trim().toLowerCase()
    if (c === 'v' || c === 'f') {
      fridayCols.push(i)
    }
  }
  return fridayCols
}

/**
 * Detects month blocks from the month header row.
 * Returns ordered MonthBlock array with column ranges.
 */
function detectMonthBlocks(
  monthHeaderRow: unknown[],
  dayOfWeekRow: unknown[],
): MonthBlock[] {
  const blocks: MonthBlock[] = []

  // Find all month headers with their column positions
  const monthPositions: Array<{ month: number; year: number; col: number }> = []
  for (let i = 0; i < monthHeaderRow.length; i++) {
    const parsed = parseMonthHeader(cell(monthHeaderRow, i))
    if (parsed) {
      monthPositions.push({ ...parsed, col: i })
    }
  }

  if (monthPositions.length === 0) return blocks

  // Find all Friday columns
  const fridayCols = findFridayColumns(dayOfWeekRow)

  // For each month, determine column range (7 day columns starting at the
  // column of the month header or the next column after a gap)
  for (let mi = 0; mi < monthPositions.length; mi++) {
    const mp = monthPositions[mi]!
    // The day columns start at the month header column or the column right after
    // it if the header is in a "WEEK" label column. Detect by looking at the
    // day-of-week row: the first non-empty cell at or after mp.col is the start.
    let colStart = mp.col
    // If the cell in dayOfWeekRow at mp.col is empty, the days start at mp.col+1
    // (this happens in the 2025 format where col 0 is "WEEK")
    const dowCell = String(dayOfWeekRow[colStart] ?? '').trim()
    if (!dowCell) {
      colStart = mp.col + 1
    }

    // Find Friday offset within this block
    let fridayOffset = 4 // default (M T W Th F -> index 4)
    for (const fc of fridayCols) {
      if (fc >= colStart && fc < colStart + 7) {
        fridayOffset = fc - colStart
        break
      }
    }

    blocks.push({
      month: mp.month,
      year: mp.year,
      colStart,
      colCount: 7,
      fridayOffset,
    })
  }

  return blocks
}

/** Checks if a cell value is a day number (1-31) */
function isDayNumber(val: string): boolean {
  if (!val) return false
  const n = parseInt(val, 10)
  return !isNaN(n) && n >= 1 && n <= 31 && String(n) === val
}

/**
 * Checks if a row is a "week row" — contains day numbers in day columns
 * for at least one month block.
 */
function isWeekRow(row: unknown[], blocks: MonthBlock[]): boolean {
  for (const block of blocks) {
    let dayCount = 0
    for (let offset = 0; offset < block.colCount; offset++) {
      const val = cell(row, block.colStart + offset)
      if (isDayNumber(val)) dayCount++
    }
    // A week row should have at least 1 day number in a block
    if (dayCount >= 1) return true
  }
  return false
}

/** Check if a name is ALL CAPS (viernes duty marker) */
function isAllCaps(name: string): boolean {
  // Must have at least one letter, and all letters must be uppercase
  const letters = name.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '')
  if (letters.length === 0) return false
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase()
}

/** Check if a value should be skipped (FESTIVO, Cumple X, notes, etc.) */
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

/**
 * Normalize a member name: trim whitespace, normalize internal spaces.
 */
function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Parse all vacation entries from a single Calendario tab.
 */
function parseCalendarioTab(rawValues: unknown[][]): CalendarioVacation[] {
  const vacations: CalendarioVacation[] = []

  if (rawValues.length < 3) return vacations

  // Scan to find month header rows and day-of-week header rows.
  // The calendario is organized in horizontal bands:
  //   - Month header row (month names)
  //   - Day-of-week header row (M, T, W, ...)
  //   - Repeating: week row (day numbers) + name rows

  let rowIdx = 0

  while (rowIdx < rawValues.length) {
    const row = rawValues[rowIdx]!

    // Try to find a month header row
    let foundMonths = false
    for (let c = 0; c < (row?.length ?? 0); c++) {
      if (parseMonthHeader(cell(row, c))) {
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

    // Next non-empty row should be the day-of-week row
    let dowRowIdx = monthHeaderRowIdx + 1
    while (dowRowIdx < rawValues.length) {
      const candidate = rawValues[dowRowIdx]!
      if (isDayOfWeekRow(candidate)) break
      dowRowIdx++
      // Don't search too far
      if (dowRowIdx - monthHeaderRowIdx > 3) break
    }

    if (dowRowIdx >= rawValues.length || !isDayOfWeekRow(rawValues[dowRowIdx]!)) {
      rowIdx++
      continue
    }

    const dayOfWeekRow = rawValues[dowRowIdx]!
    const blocks = detectMonthBlocks(monthHeaderRow, dayOfWeekRow)

    if (blocks.length === 0) {
      rowIdx = dowRowIdx + 1
      continue
    }

    // Now scan from after the day-of-week row to find week rows + name rows
    // until we hit the next month header row or end of data
    let scanIdx = dowRowIdx + 1

    // Current day-number mapping per block: colOffset -> dayNumber
    const currentDays: Map<number, Map<number, number>> = new Map()
    for (let bi = 0; bi < blocks.length; bi++) {
      currentDays.set(bi, new Map())
    }

    while (scanIdx < rawValues.length) {
      const scanRow = rawValues[scanIdx]!

      // Check if this is a new month header (end of current band)
      let isNewMonthHeader = false
      for (let c = 0; c < (scanRow?.length ?? 0); c++) {
        if (parseMonthHeader(cell(scanRow, c))) {
          isNewMonthHeader = true
          break
        }
      }
      if (isNewMonthHeader) break

      // Check if this is a week row (day numbers)
      if (isWeekRow(scanRow, blocks)) {
        // Update day-number mappings for each block
        for (let bi = 0; bi < blocks.length; bi++) {
          const block = blocks[bi]!
          const dayMap = currentDays.get(bi)!
          dayMap.clear()
          for (let offset = 0; offset < block.colCount; offset++) {
            const val = cell(scanRow, block.colStart + offset)
            if (isDayNumber(val)) {
              dayMap.set(offset, parseInt(val, 10))
            }
          }
        }
        scanIdx++
        continue
      }

      // This is a name row — extract vacation entries
      for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi]!
        const dayMap = currentDays.get(bi)!

        for (let offset = 0; offset < block.colCount; offset++) {
          const val = cell(scanRow, block.colStart + offset)
          if (!val) continue
          if (shouldSkipCell(val)) continue

          const dayNumber = dayMap.get(offset)
          if (!dayNumber) continue

          // Check if this is an ALL-CAPS name in the Friday column
          const isFridayCol = offset === block.fridayOffset

          // Split by "/" for multiple people
          const names = val.includes('/') ? val.split('/') : [val]

          for (const rawName of names) {
            const name = normalizeName(rawName)
            if (!name) continue
            if (shouldSkipCell(name)) continue

            // ALL CAPS name in Friday column = viernes duty, skip
            if (isFridayCol && isAllCaps(name)) continue

            // Build the date
            const dateStr = `${block.year}-${String(block.month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`

            vacations.push({
              name,
              date: dateStr,
              year: block.year,
            })
          }
        }
      }

      scanIdx++
    }

    // Continue scanning from where the band ended
    rowIdx = scanIdx
  }

  return vacations
}

// ─────────────────────────────────────────────────────────────────────────────
// TARDE LARGA parsing (kept from original)
// ─────────────────────────────────────────────────────────────────────────────

async function parseTardeLarga(
  spreadsheetId: string,
  tabName: string,
): Promise<Map<string, { dia: string | null; cambios: string | null }>> {
  const map = new Map<string, { dia: string | null; cambios: string | null }>()

  const rows = await readSheetByName(spreadsheetId, tabName)
  for (const row of rows) {
    const nombre = (row['Nombre '] ?? row['Nombre'] ?? '').trim()
    if (!nombre) continue
    map.set(nombre, {
      dia: (row['Día de tarde larga '] ?? row['Día de tarde larga'] ?? row['Dia de tarde larga'] ?? null)?.trim() || null,
      cambios: (row['Cambios'] ?? null)?.trim() || null,
    })
  }

  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────────────────────────────────────

export async function importVacaciones(): Promise<VacacionesImportResult> {
  const result: VacacionesImportResult = {
    membersUpserted: 0,
    vacationDaysUpserted: 0,
    tabsProcessed: 0,
    tabsSkipped: 0,
    errors: [],
  }

  const allTabs = await listSheets(SPREADSHEET_ID)

  // ── Parse TARDE LARGA ──────────────────────────────────────────────────
  const tardeLargaTab = allTabs.find((t) => t.name.trim() === 'TARDE LARGA')
  const tardeLargaMap = new Map<string, { dia: string | null; cambios: string | null }>()

  if (tardeLargaTab) {
    try {
      const tlData = await parseTardeLarga(SPREADSHEET_ID, tardeLargaTab.name)
      for (const [k, v] of tlData) {
        tardeLargaMap.set(k, v)
      }
    } catch (err) {
      result.errors.push(`[TARDE LARGA] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Find Calendario tabs ───────────────────────────────────────────────
  const calendarioTabs = allTabs.filter((t) => {
    const name = t.name.trim()
    if (!name.startsWith('Calendario')) return false
    // Extract year from tab name and check it's in IMPORT_YEARS
    const yearMatch = name.match(/(\d{4})/)
    if (!yearMatch) return false
    const year = parseInt(yearMatch[1]!, 10)
    return IMPORT_YEARS.includes(year)
  })

  if (calendarioTabs.length === 0) {
    result.errors.push('No Calendario tabs found for import years')
    return result
  }

  // ── Fetch and parse all Calendario tabs ────────────────────────────────
  const sheets = getSheetsClient()

  // Collect all vacations across all tabs, keyed by year
  const allVacations: CalendarioVacation[] = []
  const processedYears = new Set<number>()

  for (const tab of calendarioTabs) {
    const tabName = tab.name.trim()

    let rawValues: unknown[][]
    try {
      const safeRange = `'${tabName.replace(/'/g, "''")}'`
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: safeRange,
      })
      rawValues = (res.data.values ?? []) as unknown[][]
    } catch (err) {
      result.errors.push(`[${tabName}] fetch error: ${err instanceof Error ? err.message : String(err)}`)
      result.tabsSkipped++
      continue
    }

    try {
      const vacations = parseCalendarioTab(rawValues)
      allVacations.push(...vacations)

      // Track which years we got data for
      for (const v of vacations) {
        processedYears.add(v.year)
      }

      result.tabsProcessed++
    } catch (err) {
      result.errors.push(`[${tabName}] parse error: ${err instanceof Error ? err.message : String(err)}`)
      result.tabsSkipped++
    }
  }

  // ── Group vacations by member name ─────────────────────────────────────
  const vacationsByMember = new Map<string, CalendarioVacation[]>()
  for (const v of allVacations) {
    const existing = vacationsByMember.get(v.name) ?? []
    existing.push(v)
    vacationsByMember.set(v.name, existing)
  }

  // ── Upsert members and vacations ───────────────────────────────────────
  const memberIdMap = new Map<string, number>()

  // First, upsert all unique members found in calendario
  for (const memberName of vacationsByMember.keys()) {
    const tardeLarga = tardeLargaMap.get(memberName)

    const memberPayload = {
      name: memberName,
      sheet_tab_name: memberName,
      tarde_larga_dia: tardeLarga?.dia ?? null,
      tarde_larga_cambios: tardeLarga?.cambios ?? null,
    }

    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('team_members_kpi' as any)
      .upsert(memberPayload, { onConflict: 'name' })
      .select('id')
      .single()

    if (memberError || !memberData) {
      result.errors.push(`[${memberName}] member upsert error: ${memberError?.message ?? 'no data'}`)
      continue
    }

    const memberId = (memberData as { id: number }).id
    memberIdMap.set(memberName, memberId)
    result.membersUpserted++
  }

  // Also upsert TARDE LARGA members that might not appear in calendario
  for (const [name, tardeLarga] of tardeLargaMap) {
    if (memberIdMap.has(name)) continue

    const { data: memberData, error } = await supabaseAdmin
      .from('team_members_kpi' as any)
      .upsert(
        {
          name,
          sheet_tab_name: name,
          tarde_larga_dia: tardeLarga.dia,
          tarde_larga_cambios: tardeLarga.cambios,
        },
        { onConflict: 'name' },
      )
      .select('id')
      .single()

    if (error || !memberData) {
      result.errors.push(`[TARDE LARGA/${name}] member upsert error: ${error?.message ?? 'no data'}`)
    } else {
      const memberId = (memberData as { id: number }).id
      memberIdMap.set(name, memberId)
      result.membersUpserted++
    }
  }

  // ── Delete existing vacation records for processed years ───────────────
  // The calendario is the full truth — wipe and re-insert
  for (const year of processedYears) {
    const { error: deleteError } = await supabaseAdmin
      .from('team_vacations_kpi' as any)
      .delete()
      .eq('year', year)

    if (deleteError) {
      result.errors.push(`[year=${year}] delete existing vacations error: ${deleteError.message}`)
    }
  }

  // ── Insert vacation records ────────────────────────────────────────────
  for (const [memberName, vacations] of vacationsByMember) {
    const memberId = memberIdMap.get(memberName)
    if (!memberId) continue

    // Sort vacations by date within each year, then assign sequential day_number
    const byYear = new Map<number, CalendarioVacation[]>()
    for (const v of vacations) {
      const yearVacs = byYear.get(v.year) ?? []
      yearVacs.push(v)
      byYear.set(v.year, yearVacs)
    }

    const upsertPayload: Array<{
      member_id: number
      year: number
      day_number: number
      vacation_date: string
      status: string
    }> = []

    for (const [year, yearVacs] of byYear) {
      // Deduplicate by date (same person might appear twice for same date)
      const uniqueDates = [...new Set(yearVacs.map((v) => v.date))].sort()

      for (let i = 0; i < uniqueDates.length; i++) {
        upsertPayload.push({
          member_id: memberId,
          year,
          day_number: i + 1,
          vacation_date: uniqueDates[i]!,
          status: 'Aprobado',
        })
      }
    }

    if (upsertPayload.length === 0) continue

    // Insert in batches to avoid hitting Supabase limits
    const BATCH_SIZE = 500
    for (let i = 0; i < upsertPayload.length; i += BATCH_SIZE) {
      const batch = upsertPayload.slice(i, i + BATCH_SIZE)

      const { error: upsertError } = await supabaseAdmin
        .from('team_vacations_kpi' as any)
        .upsert(batch, { onConflict: 'member_id,year,day_number' })

      if (upsertError) {
        result.errors.push(`[${memberName}] vacation upsert error: ${upsertError.message}`)
      } else {
        result.vacationDaysUpserted += batch.length
      }
    }
  }

  return result
}
