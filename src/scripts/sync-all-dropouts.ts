/**
 * Bulk sync script for the 7 verified promo dropout sheets.
 *
 * Reads .env.production-local + .env.local, repairs the
 * GOOGLE_SERVICE_ACCOUNT_JSON private_key in-memory (same pattern as the
 * inspect-promoNNN-dropouts.ts scripts), then calls importDropoutsTab for
 * each promo. Prints a final summary table.
 *
 * READ-ONLY w.r.t. library code — uses supabaseAdmin + importDropoutsTab
 * exactly as exported; no modifications to import.ts / client.ts.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Env loading (identical pattern to inspect-promo114-dropouts.ts)
// ---------------------------------------------------------------------------

function loadEnvFile(p: string) {
  try {
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      v = v.replace(/\\n$/g, '').trim()
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

loadEnvFile(resolve(process.cwd(), '.env.production-local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

/**
 * Same repair pattern as inspect-promoNNN-dropouts.ts: collapse backslash-n
 * runs in private_key so Node's crypto can parse the PEM.
 */
function repairServiceAccountEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return
  let obj: Record<string, string> | null = null
  try {
    obj = JSON.parse(raw)
  } catch {
    try {
      const unescaped = raw.replace(/\\"/g, '"')
      const fixed = unescaped.replace(
        /"private_key":"([\s\S]*?)"/,
        (_m, key) => {
          const safe = key
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
          return `"private_key":"${safe}"`
        },
      )
      obj = JSON.parse(fixed)
    } catch {
      return
    }
  }
  if (!obj) return
  if (typeof obj.private_key === 'string') {
    obj.private_key = obj.private_key.replace(/\\+n/g, '\n').replace(/\\+\n/g, '\n')
  }
  const pk = obj.private_key ?? ''
  console.log(
    '[repair] pk length:',
    pk.length,
    'has real newline:',
    pk.includes('\n'),
    'head:',
    JSON.stringify(pk.slice(0, 40)),
  )
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(obj)
}

repairServiceAccountEnv()

// ---------------------------------------------------------------------------
// Library imports (must come AFTER env repair so the google-sheets client
// picks up the fixed service-account JSON)
// ---------------------------------------------------------------------------

import { supabaseAdmin } from '@/lib/supabase/server'
import { importDropoutsTab } from '@/lib/google-sheets/import'

// ---------------------------------------------------------------------------
// The 7 verified dropout sheets (gid=1646413473 for Dropouts tab)
// ---------------------------------------------------------------------------

type PromoSpec = {
  promo: string
  sheetId: string
  groupFilter?: string
}

const PROMOS: PromoSpec[] = [
  { promo: 'Promoci\u00f3n 113', sheetId: '1Gb22VO_gLRKdCgLOYL_1llJCAt-AwZhcF9QXsbWprik', groupFilter: '113' },
  { promo: 'Promoci\u00f3n 114', sheetId: '10vh-BfOh9dq2yxH_xClAusA9FgyA4jlZlu2znIR58cg' },
  { promo: 'Promoci\u00f3n 115', sheetId: '13H0k73VK1DXz0fsHBH8K1JUIY0ojagEOnEJrM_zZW-U', groupFilter: '115' },
  { promo: 'Promoci\u00f3n 116', sheetId: '13H0k73VK1DXz0fsHBH8K1JUIY0ojagEOnEJrM_zZW-U', groupFilter: '116' },
  { promo: 'Promoci\u00f3n 117', sheetId: '1UpnHAgvQZgDRBtpS1h2idO_0kVz7viYKVZUSQpL4OHg' },
  { promo: 'Promoci\u00f3n 118', sheetId: '1tZRLdludT7joGhVLJ5INRGrV9brYhDmAC8B58uvQQNw' },
  { promo: 'Promoci\u00f3n 119', sheetId: '1uZQGunxqfmbcSwGf6WUKF-X19lEV49oCWQB0bWtHytQ' },
  { promo: 'Promoci\u00f3n 121', sheetId: '1NLZrmFzGYnTMj0d4EvzEODDGx3CHp7IAkUdMF9Wya9U' },
  { promo: 'Promoci\u00f3n 122', sheetId: '15ILy9wQHrn754wfEPD0c0qm7o7GocdyZBMwc3FmmWSI' },
  { promo: 'Promoci\u00f3n 123', sheetId: '1EO9asPM2szskxdRS2Mr0shZ2rXQW_VjxX0SxqH4ZfHE' },
  { promo: 'Promoci\u00f3n 124', sheetId: '1bUGyx-QOMQLs88oDeuICrZ5_TQ5hMcFsiRMMkt4fBwk' },
]

function sheetUrl(sheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`
}

function sheetName(promo: string) {
  // e.g. "Promoción 114" → "Promo 114 Dropouts"
  const m = promo.match(/(\d+)/)
  return m ? `Promo ${m[1]} Dropouts` : `${promo} Dropouts`
}

// ---------------------------------------------------------------------------
// Per-promo run
// ---------------------------------------------------------------------------

type Row = {
  promo: string
  sheetId: string
  registeredBefore: boolean
  rowId: string | null
  imported: number
  updated: number
  withLangLevel: number | null
  withInterest: number | null
  errors: string[]
  fatal: string | null
}

async function ensureRegistered(spec: PromoSpec): Promise<{ rowId: string | null; registeredBefore: boolean; err: string | null }> {
  const url = sheetUrl(spec.sheetId)
  const { data: existing, error: selErr } = await supabaseAdmin
    .from('promo_sheets_kpi')
    .select('id')
    .eq('sheet_url', url)
    .eq('promocion_nombre', spec.promo)
    .maybeSingle()
  if (selErr) {
    return { rowId: null, registeredBefore: false, err: `select error: ${selErr.message}` }
  }
  if (existing?.id) {
    return { rowId: existing.id, registeredBefore: true, err: null }
  }
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('promo_sheets_kpi')
    .insert({
      sheet_url: url,
      sheet_id: spec.sheetId,
      sheet_name: sheetName(spec.promo),
      promocion_nombre: spec.promo,
      group_filter: '',
      sync_status: 'pending',
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    return { rowId: null, registeredBefore: false, err: `insert error: ${insErr?.message ?? 'unknown'}` }
  }
  return { rowId: inserted.id, registeredBefore: false, err: null }
}

async function countField(promo: string, field: string): Promise<number | null> {
  const { count, error } = await (supabaseAdmin as any)
    .from('promo_students_kpi')
    .select('id', { count: 'exact', head: true })
    .eq('promocion_nombre', promo)
    .eq('tab_name', 'Dropouts')
    .not(field, 'is', null)
  if (error) {
    console.error(`[${promo}] count ${field} error:`, error.message)
    return null
  }
  return count ?? 0
}

async function runPromo(spec: PromoSpec): Promise<Row> {
  const row: Row = {
    promo: spec.promo,
    sheetId: spec.sheetId,
    registeredBefore: false,
    rowId: null,
    imported: 0,
    updated: 0,
    withLangLevel: null,
    withInterest: null,
    errors: [],
    fatal: null,
  }

  console.log(`\n=== ${spec.promo}  (${spec.sheetId}) ===`)
  const reg = await ensureRegistered(spec)
  row.rowId = reg.rowId
  row.registeredBefore = reg.registeredBefore
  if (reg.err) {
    row.fatal = reg.err
    console.error(`[${spec.promo}] registration failed: ${reg.err}`)
    return row
  }
  console.log(
    `[${spec.promo}] registration ${reg.registeredBefore ? 'exists' : 'inserted'}, id=${reg.rowId}`,
  )

  try {
    const url = sheetUrl(spec.sheetId)
    const groupFilter = spec.groupFilter ?? ''
    const result = await importDropoutsTab(url, spec.promo, sheetName(spec.promo), groupFilter)
    row.imported = result.imported
    row.updated = result.updated
    row.errors = result.errors ?? []
    console.log(
      `[${spec.promo}] imported=${result.imported} updated=${result.updated} matched_to_zoho=${result.matched_to_zoho} errors=${result.errors?.length ?? 0}`,
    )
    if (result.errors?.length) {
      for (const e of result.errors.slice(0, 3)) console.log(`  error: ${e}`)
    }
  } catch (err) {
    row.fatal = err instanceof Error ? err.message : String(err)
    console.error(`[${spec.promo}] FATAL: ${row.fatal}`)
  }

  ;[row.withLangLevel, row.withInterest] = await Promise.all([
    countField(spec.promo, 'dropout_language_level'),
    countField(spec.promo, 'dropout_interest_future'),
  ])
  console.log(
    `[${spec.promo}] lang_level=${row.withLangLevel}  interest_future=${row.withInterest}`,
  )
  return row
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Bulk dropout sync starting — ${PROMOS.length} promos`)
  const results: Row[] = []
  for (const spec of PROMOS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await runPromo(spec)
    results.push(r)
  }

  console.log('\n\n================ SUMMARY ================')
  const header = [
    'promo'.padEnd(18),
    'sheetId(8)'.padEnd(12),
    'reg'.padEnd(6),
    'imp'.padEnd(5),
    'upd'.padEnd(5),
    'lang'.padEnd(5),
    'int'.padEnd(5),
    'errs'.padEnd(5),
    'fatal',
  ].join(' | ')
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of results) {
    console.log(
      [
        r.promo.padEnd(18),
        r.sheetId.slice(0, 10).padEnd(12),
        (r.registeredBefore ? 'prev' : 'new').padEnd(6),
        String(r.imported).padEnd(5),
        String(r.updated).padEnd(5),
        String(r.withLangLevel ?? '?').padEnd(5),
        String(r.withInterest ?? '?').padEnd(5),
        String(r.errors.length).padEnd(5),
        r.fatal ? r.fatal.slice(0, 80) : '',
      ].join(' | '),
    )
  }

  const anyFatal = results.some((r) => r.fatal)
  console.log(`\nDone. fatal_failures=${results.filter((r) => r.fatal).length}/${results.length}`)
  if (anyFatal) process.exitCode = 1
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
