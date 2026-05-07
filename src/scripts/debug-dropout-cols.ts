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

import { readSheetByGid } from '@/lib/google-sheets/client'

const SPREADSHEET_ID = process.argv[2] ?? ''
const GID = parseInt(process.argv[3] ?? '1646413473', 10)
const LABEL = process.argv[4] ?? SPREADSHEET_ID.slice(0, 12)

async function main() {
  if (!SPREADSHEET_ID) { console.error('Usage: debug-dropout-cols.ts <spreadsheetId> [gid] [label]'); process.exit(1) }
  const rows = await readSheetByGid(SPREADSHEET_ID, GID)
  console.log(`[${LABEL}] rows: ${rows.length}`)
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  console.log(`Headers: ${headers.slice(0, 10).map((h, i) => `[${i}]${h}`).join(' | ')}`)
  rows.slice(0, 5).forEach((r, i) => {
    const c = Object.values(r) as (string | null)[]
    console.log(`  Row${i}: status=[${c[0]}] name=[${c[1]?.slice(0,20)}] col2=[${c[2]?.slice(0,20)}] col3=[${c[3]}]`)
  })
}

main().catch(console.error)
