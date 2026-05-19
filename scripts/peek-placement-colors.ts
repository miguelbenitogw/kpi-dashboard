import { config } from 'dotenv'
config({ path: '.env.local' })

import { google } from 'googleapis'

const SPREADSHEET_ID = '1j6nqb6iN74tCjN1VSFdXonwTBZhetyCjEhIIlG6fO6Y'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? ''
  const creds = JSON.parse(raw.startsWith("'") ? raw.replace(/^'+|'+$/g, '') : raw)
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

async function main() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // Fetch rows 10-30 (where schedule data lives) for both month blocks
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ['Calendar 2026 - Schedule and Holidays!A10:Q35'],
    includeGridData: true,
  })

  const gridData = res.data.sheets?.[0]?.data?.[0]
  if (!gridData?.rowData) { console.log('No data'); return }

  // Build color → meaning map
  const colorExamples = new Map<string, string[]>()
  const toHex = (n: number | null | undefined) => Math.round((n ?? 0) * 255).toString(16).padStart(2, '0')

  for (let r = 0; r < gridData.rowData.length; r++) {
    const row = gridData.rowData[r]
    if (!row.values) continue
    for (let c = 0; c < row.values.length; c++) {
      const cell = row.values[c]
      const val = cell.formattedValue ?? ''
      if (!val.trim()) continue
      // Skip day numbers and week numbers (pure digits)
      if (/^\d+$/.test(val.trim())) continue

      const bg = cell.effectiveFormat?.backgroundColor
      const hex = bg ? `#${toHex(bg.red)}${toHex(bg.green)}${toHex(bg.blue)}` : 'none'

      if (!colorExamples.has(hex)) colorExamples.set(hex, [])
      const short = val.replace(/\n/g, '\\n').slice(0, 50)
      colorExamples.get(hex)!.push(`R${r + 10}C${c}: "${short}"`)
    }
  }

  console.log('=== SCHEDULE CELL COLORS (rows 10-35) ===\n')
  for (const [color, examples] of Array.from(colorExamples.entries()).sort()) {
    console.log(`COLOR: ${color} (${examples.length} cells)`)
    for (const ex of examples.slice(0, 8)) console.log(`  ${ex}`)
    if (examples.length > 8) console.log(`  ... +${examples.length - 8} more`)
    console.log()
  }

  // Also check a later month block (rows 80-110 = Mar/Apr area)
  const res2 = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ['Calendar 2026 - Schedule and Holidays!A42:Q75'],
    includeGridData: true,
  })

  const gridData2 = res2.data.sheets?.[0]?.data?.[0]
  if (!gridData2?.rowData) return

  const colorExamples2 = new Map<string, string[]>()
  for (let r = 0; r < gridData2.rowData.length; r++) {
    const row = gridData2.rowData[r]
    if (!row.values) continue
    for (let c = 0; c < row.values.length; c++) {
      const cell = row.values[c]
      const val = cell.formattedValue ?? ''
      if (!val.trim() || /^\d+$/.test(val.trim())) continue
      const bg = cell.effectiveFormat?.backgroundColor
      const hex = bg ? `#${toHex(bg.red)}${toHex(bg.green)}${toHex(bg.blue)}` : 'none'
      if (!colorExamples2.has(hex)) colorExamples2.set(hex, [])
      colorExamples2.get(hex)!.push(`R${r + 42}C${c}: "${val.replace(/\n/g, '\\n').slice(0, 50)}"`)
    }
  }

  console.log('\n=== SCHEDULE CELL COLORS (rows 42-75, Mar/Apr) ===\n')
  for (const [color, examples] of Array.from(colorExamples2.entries()).sort()) {
    console.log(`COLOR: ${color} (${examples.length} cells)`)
    for (const ex of examples.slice(0, 8)) console.log(`  ${ex}`)
    if (examples.length > 8) console.log(`  ... +${examples.length - 8} more`)
    console.log()
  }
}

main().catch(console.error)
