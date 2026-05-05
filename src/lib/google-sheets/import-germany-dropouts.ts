import { readSheetByGid } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

export interface GermanyDropoutPromoConfig {
  promo_numero: number
  spreadsheet_id: string
  gid: number // GID of the Dropouts tab (1646413473 for Promo 24)
}

interface ParsedDropout {
  excel_id: number
  promo_numero: number
  sheet_id: string
  nombre: string | null
  status: string | null
  profile: string | null
  modality: string | null
  start_date: string | null // ISO format YYYY-MM-DD
  dropout_date: string | null
  days_of_training: number | null
  hours_of_training: number | null
  amount_to_pay: number | null
  language_level_performance: string | null
  level_at_dropout: string | null
  absence_percentage: number | null
  reason_for_dropout: string | null
  interest_in_future: string | null
}

function parseDate(val: string | null | undefined): string | null {
  if (!val || val.trim() === '') return null
  // Formato DD/MM/YYYY → YYYY-MM-DD
  const parts = val.trim().split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseNum(val: string | null | undefined): number | null {
  if (!val || val.trim() === '') return null
  // Handle European decimals: "0,0" → 0.0, "57,1" → 57.1
  const normalized = val.trim().replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

function parseStr(val: string | null | undefined): string | null {
  if (!val || val.trim() === '') return null
  return val.trim()
}

export async function importGermanyDropoutsForPromo(
  config: GermanyDropoutPromoConfig,
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  // readSheetByGid returns rows keyed by header values; we need positional access.
  // We use the low-level call and map by index using known column positions.
  const rows = await readSheetByGid(config.spreadsheet_id, config.gid)

  if (rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, errors: 0 }
  }

  const parsed: ParsedDropout[] = []

  for (const row of rows) {
    // readSheetByGid returns header-keyed rows; we need to access by position.
    // Convert to positional array using the values in order.
    const cols = Object.values(row) as (string | null)[]

    const idRaw = cols[2]?.trim()
    if (!idRaw || isNaN(parseInt(idRaw, 10))) continue // skip rows without numeric ID

    const nombre = parseStr(cols[1])
    if (!nombre) continue // skip rows without name

    parsed.push({
      excel_id: parseInt(idRaw, 10),
      promo_numero: config.promo_numero,
      sheet_id: config.spreadsheet_id,
      nombre,
      status: parseStr(cols[0]),
      profile: parseStr(cols[3]),
      modality: parseStr(cols[4]),
      start_date: parseDate(cols[5]),
      dropout_date: parseDate(cols[6]),
      days_of_training: cols[7] ? (parseInt(cols[7].trim(), 10) || null) : null,
      hours_of_training: parseNum(cols[8]),
      amount_to_pay: parseNum(cols[9]),
      language_level_performance: parseStr(cols[13]),
      level_at_dropout: parseStr(cols[14]),
      absence_percentage: parseNum(cols[15]),
      reason_for_dropout: parseStr(cols[16]),
      interest_in_future: parseStr(cols[17]),
    })
  }

  if (parsed.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, errors: 0 }
  }

  // Upsert in batches of 50
  let inserted = 0,
    skipped = 0,
    errors = 0
  const BATCH = 50

  for (let i = 0; i < parsed.length; i += BATCH) {
    const batch = parsed.slice(i, i + BATCH)

    const { error } = await (supabaseAdmin as any)
      .from('germany_dropouts_kpi')
      .upsert(batch, {
        onConflict: 'excel_id,promo_numero',
        ignoreDuplicates: false,
      })
      .select('id')

    if (error) {
      console.error(`[germany-dropouts] Batch error:`, error)
      errors += batch.length
    } else {
      inserted += batch.length
    }
  }

  return { inserted, updated: 0, skipped, errors }
}
