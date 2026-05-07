import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(p: string) {
  try {
    const content = readFileSync(p, 'utf-8')
    const lines = content.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]; const t = line.trim()
      if (!t || t.startsWith('#')) { i++; continue }
      const eqIdx = t.indexOf('='); if (eqIdx < 0) { i++; continue }
      const k = t.slice(0, eqIdx).trim(); let v = t.slice(eqIdx + 1).trim()
      if (v.startsWith("'") && !v.endsWith("'")) {
        const parts = [v]; i++
        while (i < lines.length) { parts.push(lines[i]); if (lines[i].endsWith("'")) { i++; break } i++ }
        v = parts.join('\n')
      } else { i++ }
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

function repairServiceAccountEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  let obj: Record<string, string> | null = null
  try { obj = JSON.parse(raw) } catch {
    try {
      const unescaped = raw.replace(/\\"/g, '"')
      const fixed = unescaped.replace(/"private_key":"([\s\S]*?)"/, (_m, key) => {
        const safe = key.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
        return `"private_key":"${safe}"`
      })
      obj = JSON.parse(fixed)
    } catch { return }
  }
  if (!obj) return
  if (typeof obj.private_key === 'string') {
    obj.private_key = obj.private_key.replace(/\\+n/g, '\n').replace(/\\+\n/g, '\n')
  }
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(obj)
}

repairServiceAccountEnv()

import { google } from 'googleapis'

const SPREADSHEET_ID = process.argv[2] ?? '1w9rMWkgdBzqWL05x_DPs3Ttdeax2tfvI3wsoQiGGbUw'

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
  const credentials = JSON.parse(raw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  console.log('Title:', meta.data.properties?.title)
  console.log('Tabs:')
  meta.data.sheets?.forEach(s => {
    console.log(`  gid=${s.properties?.sheetId} | "${s.properties?.title}"`)
  })
}

main().catch(console.error)
