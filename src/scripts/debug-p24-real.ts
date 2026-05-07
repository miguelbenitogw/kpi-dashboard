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

async function main() {
  const rows = await readSheetByGid('1-Bz5K6zEiZ6dd4eKxMVfVoGk6hZVKSsceaypCHT-wms', 1646413473)
  console.log('P24 total rows:', rows.length)
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  console.log('ALL headers (' + headers.length + '):')
  headers.forEach((h, i) => console.log(`  [${i}] ${h}`))
  console.log('')
  console.log('Non-empty rows:')
  rows.forEach((r, i) => {
    const c = Object.values(r) as (string | null)[]
    const nonEmpty = c.filter(Boolean)
    if (nonEmpty.length > 0) {
      console.log(`Row ${i}: ` + c.slice(0, 10).map((v, j) => `[${j}]=${v?.slice(0, 12) ?? 'null'}`).join(' '))
    }
  })
}

main().catch(console.error)
