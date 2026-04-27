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

import { supabaseAdmin } from '@/lib/supabase/server'
import { importDropoutsTab } from '@/lib/google-sheets/import'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/10vh-BfOh9dq2yxH_xClAusA9FgyA4jlZlu2znIR58cg/edit?usp=sharing'
const SHEET_ID  = '10vh-BfOh9dq2yxH_xClAusA9FgyA4jlZlu2znIR58cg'
const PROMO     = 'Promoci\u00f3n 114'

async function main() {
  console.log('Registering Promo 114 dropout sheet...')

  const { data: existing } = await supabaseAdmin
    .from('promo_sheets_kpi')
    .select('id')
    .eq('sheet_url', SHEET_URL)
    .eq('promocion_nombre', PROMO)
    .maybeSingle()

  let rowId: string
  if (existing?.id) {
    rowId = existing.id
    console.log('Already registered, id:', rowId)
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from('promo_sheets_kpi')
      .insert({
        sheet_url:        SHEET_URL,
        sheet_id:         SHEET_ID,
        sheet_name:       'Promo 114 Dropouts',
        promocion_nombre: PROMO,
        group_filter:     '',
        sync_status:      'pending',
      })
      .select('id')
      .single()
    if (error) { console.error('Insert error:', error.message); process.exit(1) }
    rowId = inserted!.id
    console.log('Sheet registered, id:', rowId)
  }

  console.log('Importing Dropouts tab...')
  const result = await importDropoutsTab(SHEET_URL, PROMO, rowId)
  console.log('Done:', JSON.stringify(result, null, 2))
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
