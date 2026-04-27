import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(p: string) {
  try {
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue
      const i = t.indexOf('='); if (i < 0) continue
      const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      v = v.replace(/\\n$/g, '').trim(); if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}
loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (raw) {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\+n/g, '\n')
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsed)
    }
  } catch {}
}

import { importExcelMadre } from '@/lib/google-sheets/import-madre'

const MADRE_2026_ID = '1jNmyHejPA4iGoSm-AiIzqL6d3m4E0cJa3gGmKfQDAs0'

async function main() {
  console.log('Importing Excel Madre 2026...')
  const result = await importExcelMadre(MADRE_2026_ID)
  console.log('BaseDatos:', result.baseDatos)
  console.log('Resumen:', result.resumen)
  console.log('GlobalPlacement:', result.globalPlacement)
  console.log('Pagos:', result.pagos)
  console.log('CursoDesarrollo:', result.cursoDesarrollo)
  console.log('PromotionsCreate:', result.promotionsCreate)
  console.log('PromotionsSync:', result.promotionsSync)
  if (result.errors.length > 0) {
    console.error('ERRORS:', result.errors)
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
