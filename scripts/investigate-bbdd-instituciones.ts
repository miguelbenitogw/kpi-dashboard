/**
 * Investigation script: reads the BBDD instituciones Google Sheet
 * and reports full structure of all tabs (especially "BBDD profesion").
 *
 * Run: npx tsx scripts/investigate-bbdd-instituciones.ts
 */
import * as dotenv from 'dotenv'
import { google } from 'googleapis'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SPREADSHEET_ID = '1Lmw5SIbpobXBySaYEMXYw0YKMy6xP-cTAKm3-n6KPJY'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')

  let credentials: Record<string, string>
  try {
    const p = JSON.parse(raw)
    credentials = typeof p === 'string' ? JSON.parse(p) : p
  } catch {
    credentials = JSON.parse(raw.replace(/\\"/g, '"'))
  }
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

async function investigateTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabTitle: string,
  merges: any[],
) {
  const safeRange = `'${tabTitle.replace(/'/g, "''")}'`

  // Read first 6 rows (enough to see group headers + column headers + 2-3 data rows)
  const topRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${safeRange}!A1:ZZ6`,
  })
  const topRows = topRes.data.values ?? []

  // Count data rows
  const colARes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${safeRange}!A:A`,
  })
  const totalRows = (colARes.data.values ?? []).length

  return { topRows, totalRows, merges }
}

async function main() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // 1. List all tabs + their merge info
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: false,
  })

  const allTabs = (meta.data.sheets ?? []).map((s) => ({
    name: s.properties?.title ?? '',
    gid: s.properties?.sheetId ?? 0,
    merges: s.merges ?? [],
  }))

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║       ALL TABS IN SPREADSHEET        ║')
  console.log('╚══════════════════════════════════════╝')
  allTabs.forEach((t) =>
    console.log(`  gid=${String(t.gid).padEnd(12)} merges=${t.merges.length}  name="${t.name}"`),
  )

  // 2. Investigate EVERY tab (report structure)
  for (const tab of allTabs) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`TAB: "${tab.name}" (gid=${tab.gid})`)
    console.log('═'.repeat(60))

    try {
      const { topRows, totalRows, merges } = await investigateTab(
        sheets,
        SPREADSHEET_ID,
        tab.name,
        tab.merges,
      )

      console.log(`Total rows in col A: ${totalRows}`)

      if (merges.length > 0) {
        console.log(`\nMerged cell groups (first 30):`)
        merges.slice(0, 30).forEach((m: any) => {
          const rowSpan = `R${m.startRowIndex + 1}-R${m.endRowIndex}`
          const colSpan = `C${m.startColumnIndex}-C${m.endColumnIndex - 1}`
          console.log(`  ${rowSpan}  ${colSpan}`)
        })
      } else {
        console.log('No merged cells')
      }

      console.log('\nFirst 6 rows (only non-empty cells):')
      topRows.forEach((row: any[], i: number) => {
        const cells = row
          .map((cell, j) => (cell ? `[${j}]="${cell}"` : null))
          .filter(Boolean)
        if (cells.length > 0) {
          console.log(`  Row ${i + 1}: ${cells.join('  ')}`)
        } else {
          console.log(`  Row ${i + 1}: (empty)`)
        }
      })
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log('\n\n╔══════════════════════════════════════╗')
  console.log('║         INVESTIGATION COMPLETE        ║')
  console.log('╚══════════════════════════════════════╝')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
