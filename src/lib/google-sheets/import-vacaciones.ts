import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase/server'
import { listSheets, readSheetByName } from './client'

const SPREADSHEET_ID = '1KkPzhQkX5uYF_NdktAzTxdIdDevDBZAD4V-UIsFyUUg'

const IMPORT_YEARS = [2024, 2025, 2026]

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

export interface VacacionesImportResult {
  membersUpserted: number
  vacationDaysUpserted: number
  tabsProcessed: number
  tabsSkipped: number
  errors: string[]
}

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

function parseVacationDate(raw: string | null | undefined, year: number): string | null {
  if (!raw || !raw.trim()) return null
  const s = raw.trim()

  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  const ddDeMes = s.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?$/i)
  if (ddDeMes) {
    const [, d, monthName, y] = ddDeMes
    const month = SPANISH_MONTHS[monthName!.toLowerCase()]
    if (!month) return null
    const resolvedYear = y ? parseInt(y, 10) : year
    return `${resolvedYear}-${String(month).padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  return null
}

function parseDayNumber(raw: string | null | undefined): number | null {
  if (!raw || !raw.trim()) return null
  const match = raw.trim().match(/[Dd]ia\s*(\d+)|[Dd]ía\s*(\d+)/)
  if (match) return parseInt(match[1] ?? match[2] ?? '', 10)
  return null
}

interface YearBlock {
  year: number
  statusColIdx: number
  dayColIdx: number
  dateColIdx: number
}

function detectYearBlocks(headerRow: string[]): YearBlock[] {
  const blocks: YearBlock[] = []

  for (let i = 0; i < headerRow.length; i++) {
    const cell = (headerRow[i] ?? '').trim()
    const match = cell.match(/FECHAS\s+(\d{4})/i)
    if (!match) continue

    const year = parseInt(match[1]!, 10)
    if (!IMPORT_YEARS.includes(year)) continue

    blocks.push({
      year,
      statusColIdx: i,
      dayColIdx: i + 1,
      dateColIdx: i + 2,
    })
  }

  return blocks
}

interface VacationRow {
  year: number
  dayNumber: number
  vacationDate: string | null
  status: string
}

function parseSingleColumnTab(values: string[][]): VacationRow[] {
  const rows: VacationRow[] = []
  let currentYear: number | null = null

  for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
    const cell0 = String(values[rowIdx]?.[0] ?? '').trim()

    const yearMatch = cell0.match(/FECHAS\s+(\d{4})/i)
    if (yearMatch) {
      const y = parseInt(yearMatch[1]!, 10)
      if (IMPORT_YEARS.includes(y)) currentYear = y
      else currentYear = null
      continue
    }

    if (!currentYear) continue

    const cell1 = String(values[rowIdx]?.[1] ?? '').trim()
    const cell2 = String(values[rowIdx]?.[2] ?? '').trim()

    if (cell0 !== 'Aprobado' && cell0 !== 'Pendiente') continue

    const dayNumber = parseDayNumber(cell1)
    if (!dayNumber) continue

    rows.push({
      year: currentYear,
      dayNumber,
      vacationDate: parseVacationDate(cell2, currentYear),
      status: cell0 === 'Aprobado' ? 'Aprobado' : 'Pendiente',
    })
  }

  return rows
}

function parseEmployeeTab(values: string[][]): VacationRow[] {
  if (values.length === 0) return []

  const headerRow = (values[0] ?? []).map((c) => String(c ?? '').trim())
  const blocks = detectYearBlocks(headerRow)

  if (blocks.length === 0) {
    return parseSingleColumnTab(values)
  }

  const rows: VacationRow[] = []

  for (const block of blocks) {
    for (let rowIdx = 1; rowIdx < values.length; rowIdx++) {
      const row = values[rowIdx] ?? []

      const rawStatus = String(row[block.statusColIdx] ?? '').trim()
      const rawDay = String(row[block.dayColIdx] ?? '').trim()
      const rawDate = String(row[block.dateColIdx] ?? '').trim()

      if (!rawStatus) continue

      const dayNumber = parseDayNumber(rawDay)
      if (!dayNumber) continue

      const status = rawStatus === 'Aprobado' ? 'Aprobado' : 'Pendiente'
      const vacationDate = parseVacationDate(rawDate, block.year)

      rows.push({ year: block.year, dayNumber, vacationDate, status })
    }
  }

  return rows
}

export async function importVacaciones(): Promise<VacacionesImportResult> {
  const result: VacacionesImportResult = {
    membersUpserted: 0,
    vacationDaysUpserted: 0,
    tabsProcessed: 0,
    tabsSkipped: 0,
    errors: [],
  }

  const allTabs = await listSheets(SPREADSHEET_ID)

  const tardeLargaTab = allTabs.find((t) => t.name.trim() === 'TARDE LARGA')
  const employeeTabs = allTabs.filter((t) => {
    const name = t.name.trim()
    if (name === 'TARDE LARGA') return false
    if (name.startsWith('Calendario') || name.startsWith('LOS VIERNES')) return false
    return true
  })

  const tardeLargaMap = new Map<string, { dia: string | null; cambios: string | null }>()

  if (tardeLargaTab) {
    try {
      const tardeLargaRows = await readSheetByName(SPREADSHEET_ID, tardeLargaTab.name)
      for (const row of tardeLargaRows) {
        const nombre = (row['Nombre '] ?? row['Nombre'] ?? '').trim()
        if (!nombre) continue
        tardeLargaMap.set(nombre, {
          dia: (row['Día de tarde larga '] ?? row['Día de tarde larga'] ?? row['Dia de tarde larga'] ?? null)?.trim() || null,
          cambios: (row['Cambios'] ?? null)?.trim() || null,
        })
      }
    } catch (err) {
      result.errors.push(`[TARDE LARGA] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const sheets = getSheetsClient()

  const memberIdMap = new Map<string, number>()

  for (const tab of employeeTabs) {
    const tabName = tab.name.trim()

    let rawValues: string[][]
    try {
      const safeRange = `'${tabName.replace(/'/g, "''")}'`
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: safeRange,
      })
      rawValues = (res.data.values ?? []) as string[][]
    } catch (err) {
      result.errors.push(`[${tabName}] fetch error: ${err instanceof Error ? err.message : String(err)}`)
      result.tabsSkipped++
      continue
    }

    const tardeLarga = tardeLargaMap.get(tabName)

    const memberPayload = {
      name: tabName,
      sheet_tab_name: tabName,
      tarde_larga_dia: tardeLarga?.dia ?? null,
      tarde_larga_cambios: tardeLarga?.cambios ?? null,
    }

    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('team_members_kpi' as any)
      .upsert(memberPayload, { onConflict: 'name' })
      .select('id')
      .single()

    if (memberError || !memberData) {
      result.errors.push(`[${tabName}] member upsert error: ${memberError?.message ?? 'no data'}`)
      result.tabsSkipped++
      continue
    }

    const memberId = (memberData as { id: number }).id
    memberIdMap.set(tabName, memberId)
    result.membersUpserted++

    const vacationRows = parseEmployeeTab(rawValues)

    if (vacationRows.length === 0) {
      result.tabsSkipped++
      continue
    }

    const deduped = new Map<string, VacationRow>()
    for (const r of vacationRows) {
      const key = `${r.year}-${r.dayNumber}`
      deduped.set(key, r)
    }

    const upsertPayload = Array.from(deduped.values()).map((r) => ({
      member_id: memberId,
      year: r.year,
      day_number: r.dayNumber,
      vacation_date: r.vacationDate,
      status: r.status,
    }))

    const { error: upsertError } = await supabaseAdmin
      .from('team_vacations_kpi' as any)
      .upsert(upsertPayload, { onConflict: 'member_id,year,day_number' })

    if (upsertError) {
      result.errors.push(`[${tabName}] vacation upsert error: ${upsertError.message}`)
    } else {
      result.vacationDaysUpserted += upsertPayload.length
    }

    result.tabsProcessed++
  }

  for (const [name, tardeLarga] of tardeLargaMap) {
    if (memberIdMap.has(name)) continue

    const { error } = await supabaseAdmin
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

    if (error) {
      result.errors.push(`[TARDE LARGA/${name}] member upsert error: ${error.message}`)
    } else {
      result.membersUpserted++
    }
  }

  return result
}
