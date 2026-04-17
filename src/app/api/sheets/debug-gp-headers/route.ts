import { type NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { buildCsvUrl, parseCSV } from '@/lib/google-sheets/client'
import { MADRE_SHEET_ID } from '@/lib/google-sheets/import-madre'
import { GLOBAL_PLACEMENT_GID } from '@/lib/google-sheets/import-global-placement'

/**
 * GET /api/sheets/debug-gp-headers
 * Returns the raw header names and first data row from the Global Placement tab.
 * Temporary diagnostic endpoint — remove after debugging.
 */
export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse()

  const url = buildCsvUrl(MADRE_SHEET_ID, GLOBAL_PLACEMENT_GID)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return NextResponse.json({ error: `HTTP ${response.status}` }, { status: 502 })
  }

  const csv = await response.text()
  const { headers, rows } = parseCSV(csv)

  // Show headers with their char codes to detect hidden chars
  const headerDetails = headers.map((h, i) => ({
    index: i,
    raw: h,
    lower: h.toLowerCase().trim(),
    charCodes: [...h].map(c => c.charCodeAt(0)),
  }))

  // First data row values for key columns
  const firstRow = rows[0] ?? {}
  const keyValues: Record<string, string | undefined> = {}
  for (const h of headers) {
    const lower = h.toLowerCase().trim()
    if (['open to', 'availability', 'priority', 'shots', 'status (training)', 'zoho id', 'name'].includes(lower)) {
      keyValues[h] = firstRow[h]
    }
  }

  return NextResponse.json({ headers: headerDetails, firstRowKeyValues: keyValues, totalRows: rows.length })
}
