/**
 * Google Sheets client using the Google Sheets API v4 + a service account.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON env var. The target spreadsheet must
 * be shared with the service account's client_email (Viewer is enough).
 */

import { google } from 'googleapis'

export type SheetRow = Record<string, string>

export interface SheetTab {
  gid: string
  tabName: string
  rows: SheetRow[]
  rawHeaders: string[]
}

// Well-known GIDs for specific Promo tabs
export const KNOWN_GIDS = {
  DROPOUTS: '1646413473',
  CONTACT_INFO: '1379222708',
} as const

/**
 * Row type for service-account reads where empty cells stay as null.
 */
export interface ServiceSheetRow {
  [key: string]: string | null
}

/**
 * Extracts the Google Sheet document ID from any valid Google Sheets URL.
 *
 * Supports:
 *   https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/{ID}
 */
export function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    throw new Error(`Cannot extract Google Sheet ID from URL: ${url}`)
  }
  return match[1]
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-account auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses the service-account env var, accepting:
 *   1. Plain JSON object:          {"type":"service_account",...}
 *   2. Double-serialized string:   "{\"type\":\"service_account\",...}"
 *   3. Backslash-escaped (no outer quotes — common .env pitfall):
 *      {\"type\":\"service_account\",...}
 */
function parseServiceAccountJson(raw: string): Record<string, string> {
  // Strip surrounding single quotes — common .env.local / .env.production-local pitfall
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
    // Fall through — try backslash-escaped form below.
  }

  if (!parsed) {
    // Backslash-escaped .env form: \" quotes instead of ", and literal
    // backslash+newline instead of \n escape (line-continuation pitfall).
    // Order matters: line-continuations → \n literal first, then unescape \" → "
    // last so we don't eat real escaped quotes.
    const normalized = raw
      .replace(/\\\r\n/g, '\\n')
      .replace(/\\\n/g, '\\n')
      .replace(/\\"/g, '"')
    parsed = JSON.parse(normalized) as Record<string, string>
  }

  // Fix OpenSSL 3.x issue: private_key must contain real newline chars, not
  // the two-character sequence backslash-n.  Some .env loaders (dotenv, manual)
  // leave the key with literal \n after JSON.parse.
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
// Low-level reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a tab and returns { headers, rows } with empty cells coerced to ''.
 * Primary helper for the import pipelines.
 *
 * @param spreadsheetId - Sheet document ID (use extractSheetId on a URL)
 * @param gid           - Numeric GID of the target tab
 * @param options.headerRow - 1-indexed row number of headers (default 1)
 */
export async function readSheetAsRows(
  spreadsheetId: string,
  gid: number,
  options: { headerRow?: number } = {},
): Promise<{ headers: string[]; rows: SheetRow[]; tabName: string }> {
  const headerRow = options.headerRow ?? 1
  const sheets = getSheetsClient()

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetMeta = meta.data.sheets?.find((s) => s.properties?.sheetId === gid)
  if (!sheetMeta?.properties?.title) {
    throw new Error(`No tab with gid=${gid} in spreadsheet ${spreadsheetId}`)
  }
  const tabName = sheetMeta.properties.title

  // Wrap tabName in single quotes so the Sheets API treats it as a sheet name,
  // not a range expression. This is required when the name contains "/" (e.g.
  // "Pagos - Proyectos 2025/2026") — without quoting, the "/" breaks the URL
  // path in the API call and the request returns no data.
  // Single-quote literals inside the name are escaped by doubling them.
  const safeRange = `'${tabName.replace(/'/g, "''")}'`

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: safeRange,
  })

  const allRows = res.data.values ?? []
  if (allRows.length < headerRow) return { headers: [], rows: [], tabName }

  const headers = (allRows[headerRow - 1] ?? []).map((h: unknown) =>
    String(h ?? '').trim(),
  )
  const dataRows = allRows.slice(headerRow)

  const rows: SheetRow[] = dataRows.map((row) => {
    const obj: SheetRow = {}
    headers.forEach((header, i) => {
      const key = header || `col_${i}`
      obj[key] = row[i] != null ? String(row[i]).trim() : ''
    })
    return obj
  })

  return { headers, rows, tabName }
}

/**
 * Fetches ALL tabs in a spreadsheet and returns them as SheetTab[].
 * Tabs with no headers or no data are silently skipped.
 */
export async function fetchAllTabs(sheetUrl: string): Promise<SheetTab[]> {
  const spreadsheetId = extractSheetId(sheetUrl)
  const sheets = await listSheets(spreadsheetId)
  const tabs: SheetTab[] = []

  await Promise.all(
    sheets.map(async (s) => {
      try {
        const { headers, rows } = await readSheetAsRows(spreadsheetId, s.gid)
        if (headers.length === 0 || rows.length === 0) return
        tabs.push({
          gid: String(s.gid),
          tabName: s.name,
          rows,
          rawHeaders: headers,
        })
      } catch {
        // Skip tabs we can't read (shouldn't happen if sheet is shared)
      }
    }),
  )

  return tabs
}

/**
 * Fetches a single tab by GID and returns it as a SheetTab.
 * Throws if the tab cannot be fetched.
 */
export async function fetchSingleTab(
  sheetUrl: string,
  gid: string,
  tabName?: string,
): Promise<SheetTab> {
  const spreadsheetId = extractSheetId(sheetUrl)
  const { headers, rows, tabName: actualName } = await readSheetAsRows(
    spreadsheetId,
    parseInt(gid, 10),
  )

  if (headers.length === 0) {
    throw new Error(`Tab (gid=${gid}) has no headers`)
  }

  return {
    gid,
    tabName: tabName ?? actualName,
    rows,
    rawHeaders: headers,
  }
}

/**
 * Reads a sheet tab by GID and returns rows as objects keyed by header values.
 * Values may be null when a cell is empty.
 * Requires the sheet to be shared with the service account.
 */
export async function readSheetByGid(
  spreadsheetId: string,
  gid: number,
  headerRow = 1,
): Promise<ServiceSheetRow[]> {
  const sheets = getSheetsClient()

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetMeta = meta.data.sheets?.find(
    (s) => s.properties?.sheetId === gid,
  )
  if (!sheetMeta?.properties?.title) {
    throw new Error(`No sheet found with gid=${gid} in spreadsheet ${spreadsheetId}`)
  }
  const sheetName = sheetMeta.properties.title

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'`,
  })

  const rows = res.data.values ?? []
  if (rows.length < headerRow) return []

  const headers = (rows[headerRow - 1] ?? []).map((h: string) =>
    String(h).trim(),
  )
  const dataRows = rows.slice(headerRow)

  return dataRows.map((row) => {
    const obj: ServiceSheetRow = {}
    headers.forEach((header, i) => {
      obj[header] = row[i] != null ? String(row[i]).trim() : null
    })
    return obj
  })
}

/**
 * Reads a sheet by tab name and returns rows as objects.
 * Values may be null when a cell is empty.
 * Requires the sheet to be shared with the service account.
 */
export async function readSheetByName(
  spreadsheetId: string,
  sheetName: string,
  headerRow = 1,
): Promise<ServiceSheetRow[]> {
  const sheets = getSheetsClient()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'`,
  })

  const rows = res.data.values ?? []
  if (rows.length < headerRow) return []

  const headers = (rows[headerRow - 1] ?? []).map((h: string) =>
    String(h).trim(),
  )
  const dataRows = rows.slice(headerRow)

  return dataRows.map((row) => {
    const obj: ServiceSheetRow = {}
    headers.forEach((header, i) => {
      obj[header] = row[i] != null ? String(row[i]).trim() : null
    })
    return obj
  })
}

/**
 * Lists all sheet tabs in a spreadsheet (name + gid).
 * Requires the sheet to be shared with the service account.
 */
export async function listSheets(
  spreadsheetId: string,
): Promise<Array<{ name: string; gid: number }>> {
  const sheets = getSheetsClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  return (meta.data.sheets ?? []).map((s) => ({
    name: s.properties?.title ?? '',
    gid: s.properties?.sheetId ?? 0,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Two-level header support
// ─────────────────────────────────────────────────────────────────────────────

export interface TwoLevelHeaders {
  /** 1-based row index of the group headers row (e.g. "Datos generales", "Contacto") */
  groupRow: number
  /** 1-based row index of the column headers row (e.g. "Nombre", "Email") */
  columnRow: number
  /** Separator between group and column name (default: '.') */
  separator?: string
}

/**
 * Reads a sheet tab with a two-level header structure (group row + column row).
 * Merged group cells are forward-filled so every column has a group prefix.
 * Duplicate composite keys get a column-index suffix to stay unique.
 * Returns rows keyed by "Group.Column" composite headers.
 *
 * @example
 * // Sheet layout:
 * //   Row 2: ["Datos generales", "", "", "Contacto", ""]
 * //   Row 3: ["Nombre", "DNI", "País", "Email", "Teléfono"]
 * //   Row 4+: data
 * const { headers, rows } = await readSheetWithTwoLevelHeaders(id, gid, { groupRow: 2, columnRow: 3 })
 * // headers: ["Datos generales.Nombre", "Datos generales.DNI", ...]
 */
export async function readSheetWithTwoLevelHeaders(
  spreadsheetId: string,
  gid: number,
  twoLevel: TwoLevelHeaders,
): Promise<{ headers: string[]; rows: SheetRow[]; tabName: string }> {
  const { groupRow, columnRow, separator = '.' } = twoLevel
  const sheets = getSheetsClient()

  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetMeta = meta.data.sheets?.find((s) => s.properties?.sheetId === gid)
  if (!sheetMeta?.properties?.title) {
    throw new Error(`No tab with gid=${gid} in spreadsheet ${spreadsheetId}`)
  }
  const tabName = sheetMeta.properties.title
  const safeRange = `'${tabName.replace(/'/g, "''")}'`

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: safeRange })
  const allRows = res.data.values ?? []

  const maxRow = Math.max(groupRow, columnRow)
  if (allRows.length < maxRow) return { headers: [], rows: [], tabName }

  // Raw group row — merged cells leave trailing cells empty
  const rawGroups = (allRows[groupRow - 1] ?? []).map((h: unknown) =>
    String(h ?? '').trim(),
  )

  // Forward-fill group name rightward into empty cells
  let currentGroup = ''
  const filledGroups = rawGroups.map((g) => {
    if (g) currentGroup = g
    return currentGroup
  })

  // Column names row
  const columnNames = (allRows[columnRow - 1] ?? []).map((h: unknown) =>
    String(h ?? '').trim(),
  )

  // Combine: "Group.Column" — deduplicate with column-index suffix
  const maxCols = Math.max(filledGroups.length, columnNames.length)
  const seenKeys = new Map<string, number>()
  const headers: string[] = Array.from({ length: maxCols }, (_, i) => {
    const group = filledGroups[i] ?? ''
    const col = columnNames[i] ?? `col_${i}`
    const base = group ? `${group}${separator}${col}` : col
    if (seenKeys.has(base)) {
      // Append column index to keep keys unique
      seenKeys.set(base, (seenKeys.get(base) ?? 0) + 1)
      return `${base}__${i}`
    }
    seenKeys.set(base, 1)
    return base
  })

  // Data rows start after the last header row
  const dataRows = allRows.slice(maxRow)
  const rows: SheetRow[] = dataRows.map((row) => {
    const obj: SheetRow = {}
    headers.forEach((header, i) => {
      obj[header] = row[i] != null ? String(row[i]).trim() : ''
    })
    return obj
  })

  return { headers, rows, tabName }
}
