import * as dotenv from 'dotenv'
import { google } from 'googleapis'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SPREADSHEET_ID = '1Lmw5SIbpobXBySaYEMXYw0YKMy6xP-cTAKm3-n6KPJY'

const TABS = [
  { name: 'BBDD ENFERMERÍA', gid: 0 },
  { name: 'BBDD FISIOTERAPIA', gid: 1305711796 },
  { name: 'BBDD EDUCACIÓN INFANTIL', gid: 799493312 },
  { name: 'BBDD VETERINARIA', gid: 1245976136 },
  { name: 'BBDD DENTISTAS', gid: 170511999 },
  { name: 'BBDD ÓPTICA-OPTOMETRÍA', gid: 731218405 },
  { name: 'BBDD TERAPIA OCUPACIONAL', gid: 1547393928 },
]

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  let credentials: any
  try { const p = JSON.parse(raw); credentials = typeof p === 'string' ? JSON.parse(p) : p }
  catch { credentials = JSON.parse(raw.replace(/\\"/g, '"')) }
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  return new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
}

async function main() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })

  for (const tab of TABS) {
    const sheetMeta = meta.data.sheets?.find(s => s.properties?.sheetId === tab.gid)
    const tabName = sheetMeta?.properties?.title ?? tab.name
    const safeRange = `'${tabName.replace(/'/g, "''")}'!A1:BZ6`

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: safeRange })
    const rows = res.data.values ?? []

    console.log(`\n${'='.repeat(70)}`)
    console.log(`TAB: ${tab.name}`)
    console.log('='.repeat(70))

    // Print all cells in rows 1-6 with COLUMN LETTER for reference
    rows.forEach((row: any[], rowIdx: number) => {
      const cells = row.map((cell, colIdx) => {
        if (!cell && cell !== 0) return null
        // Convert colIdx to Excel column letter (A, B, C, ..., Z, AA, AB...)
        let col = ''
        let n = colIdx + 1
        while (n > 0) { col = String.fromCharCode(65 + ((n - 1) % 26)) + col; n = Math.floor((n - 1) / 26) }
        return `${col}${rowIdx+1}="${cell}"`
      }).filter(Boolean)
      if (cells.length > 0) console.log(`Row ${rowIdx+1}: ${cells.join(' | ')}`)
    })

    // Also show merge info for this tab
    const merges = sheetMeta?.merges ?? []
    if (merges.length > 0) {
      console.log('\nMerged ranges (row 1-4 only):')
      merges
        .filter((m: any) => m.startRowIndex < 4)
        .forEach((m: any) => {
          const startCol = m.startColumnIndex
          const endCol = m.endColumnIndex - 1
          let sc = '', ec = ''
          let n = startCol + 1; while(n > 0) { sc = String.fromCharCode(65 + ((n-1)%26)) + sc; n = Math.floor((n-1)/26) }
          n = endCol + 1; while(n > 0) { ec = String.fromCharCode(65 + ((n-1)%26)) + ec; n = Math.floor((n-1)/26) }
          console.log(`  Row ${m.startRowIndex+1}-${m.endRowIndex}: ${sc}:${ec}`)
        })
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
