/**
 * Google Sheets public export client.
 * Works only with sheets that are shared publicly ("Anyone with the link can view").
 * No authentication required — uses the spreadsheet export API.
 */

export type SheetRow = Record<string, string>

export interface SheetTab {
  gid: string
  tabName: string
  rows: SheetRow[]
  rawHeaders: string[]
}

// Known GIDs to probe when discovering tabs.
// Add more if the sheet gains new tabs.
const PROBE_GIDS = ['0', '1', '2', '3', '4', '5']

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

/**
 * Builds the CSV export URL for a specific sheet tab (by GID).
 */
export function buildCsvUrl(sheetId: string, gid?: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
  return gid ? `${base}&gid=${gid}` : base
}

/**
 * Fetches a single Google Sheet tab as raw CSV text.
 * Throws on HTTP errors.
 */
export async function fetchSheetCSV(sheetUrl: string, gid?: string): Promise<string> {
  const sheetId = extractSheetId(sheetUrl)
  const url = buildCsvUrl(sheetId, gid)

  const response = await fetch(url, {
    method: 'GET',
    // No auth headers — sheet must be publicly readable
    headers: {
      Accept: 'text/csv,text/plain,*/*',
    },
    // Server-side fetch: no CORS restriction
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Google Sheet (gid=${gid ?? 'default'}): HTTP ${response.status}`
    )
  }

  return response.text()
}

/**
 * Minimal RFC 4180-compliant CSV parser.
 * Returns an array of row objects keyed by header row values.
 * Empty rows (all fields blank) are skipped.
 */
export function parseCSV(text: string): { headers: string[]; rows: SheetRow[] } {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // First non-empty line is the header
  const headerLine = lines[0]
  if (!headerLine.trim()) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(headerLine)

  const rows: SheetRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const fields = parseCsvLine(line)

    // Skip rows where every field is empty
    if (fields.every((f) => !f.trim())) continue

    const row: SheetRow = {}
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j]?.trim() || `col_${j}`
      row[key] = (fields[j] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows }
}

/**
 * Parse a single CSV line respecting quoted fields (RFC 4180).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        // Escaped quote
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  fields.push(current)
  return fields
}

/**
 * Tries to fetch multiple GIDs from a sheet to discover all available tabs.
 * Silently ignores GIDs that return HTTP errors (tab doesn't exist).
 *
 * @param sheetUrl - Full Google Sheets URL
 * @param gids     - List of GID strings to probe (defaults to PROBE_GIDS)
 */
export async function fetchAllTabs(
  sheetUrl: string,
  gids: string[] = PROBE_GIDS
): Promise<SheetTab[]> {
  const tabs: SheetTab[] = []
  const seen = new Set<string>()

  await Promise.all(
    gids.map(async (gid) => {
      try {
        const csv = await fetchSheetCSV(sheetUrl, gid)
        const { headers, rows } = parseCSV(csv)

        if (headers.length === 0 || rows.length === 0) return

        // Deduplicate: some GIDs redirect to the same tab — compare first header row
        const fingerprint = headers.join('|')
        if (seen.has(fingerprint)) return
        seen.add(fingerprint)

        // Try to infer tab name from common header patterns
        const tabName = inferTabName(headers, rows, gid)

        tabs.push({ gid, tabName, rows, rawHeaders: headers })
      } catch {
        // Tab doesn't exist or sheet is private — skip silently
      }
    })
  )

  return tabs
}

/**
 * Heuristic: infer a human-readable tab name from the data headers / first rows.
 * Falls back to `Tab_{gid}`.
 */
function inferTabName(headers: string[], rows: SheetRow[], gid: string): string {
  const headerStr = headers.join(' ').toLowerCase()

  if (headerStr.includes('baja') || headerStr.includes('dropout') || headerStr.includes('leave')) {
    return 'Bajas'
  }
  if (headerStr.includes('candidat') && !headerStr.includes('baja')) {
    return 'Candidatos'
  }
  if (headerStr.includes('student') || headerStr.includes('alumno')) {
    return 'Estudiantes'
  }
  if (headerStr.includes('activ')) {
    return 'Activos'
  }

  // Check if first row has a "sheet name" hint in the first column
  const firstValue = rows[0] ? Object.values(rows[0])[0] : ''
  if (firstValue && firstValue.length < 40) {
    return firstValue
  }

  return `Tab_${gid}`
}
