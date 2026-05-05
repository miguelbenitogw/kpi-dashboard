import { readSheetByGid } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Column index mapping for a Germany Dropouts sheet.
 * Each field maps to the 0-indexed column position in that promo's sheet.
 * Omit a field to leave it as null in the DB.
 */
export interface GermanyDropoutColumnMap {
  status?: number
  name: number
  id: number
  profile?: number
  modality?: number
  start_date?: number
  dropout_date?: number
  days_of_training?: number
  hours_of_training?: number
  amount_to_pay?: number
  language_level_performance?: number
  level_at_dropout?: number
  absence_percentage?: number
  reason_for_dropout?: number
  interest_in_future?: number
}

/** Default column layout — matches Promo 24 */
export const P24_COLUMN_MAP: GermanyDropoutColumnMap = {
  status: 0,
  name: 1,
  id: 2,
  profile: 3,
  modality: 4,
  start_date: 5,
  dropout_date: 6,
  days_of_training: 7,
  hours_of_training: 8,
  amount_to_pay: 9,
  language_level_performance: 13,
  level_at_dropout: 14,
  absence_percentage: 15,
  reason_for_dropout: 16,
  interest_in_future: 17,
}

/**
 * Column layout for Promo 25 — "Profile" column was removed;
 * col[3] is now Modality, and columns 3-8 shift one position left.
 * Language-related columns move from 13-17 to 12-16.
 */
export const P25_COLUMN_MAP: GermanyDropoutColumnMap = {
  status: 0,
  name: 1,
  id: 2,
  profile: undefined, // P25 has no separate Profile column
  modality: 3,
  start_date: 4,
  dropout_date: 5,
  days_of_training: 6,
  hours_of_training: 7,
  amount_to_pay: 8,
  language_level_performance: 12,
  level_at_dropout: 13,
  absence_percentage: 14,
  reason_for_dropout: 15,
  interest_in_future: 16,
}

export interface GermanyDropoutPromoConfig {
  promo_numero: number
  spreadsheet_id: string
  gid: number // GID of the Dropouts tab (1646413473 for Promo 24 and Promo 25)
  /** Column layout — defaults to P24_COLUMN_MAP if omitted */
  columnMap?: GermanyDropoutColumnMap
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

  const map = config.columnMap ?? P24_COLUMN_MAP

  const parsed: ParsedDropout[] = []

  for (const row of rows) {
    // readSheetByGid returns header-keyed rows; we need to access by position.
    // Convert to positional array using the values in order.
    const cols = Object.values(row) as (string | null)[]

    const idRaw = cols[map.id]?.trim()
    if (!idRaw || isNaN(parseInt(idRaw, 10))) continue // skip rows without numeric ID

    const nombre = parseStr(cols[map.name])
    if (!nombre) continue // skip rows without name

    const daysRaw = map.days_of_training != null ? cols[map.days_of_training] : null

    parsed.push({
      excel_id: parseInt(idRaw, 10),
      promo_numero: config.promo_numero,
      sheet_id: config.spreadsheet_id,
      nombre,
      status: map.status != null ? parseStr(cols[map.status]) : null,
      profile: map.profile != null ? parseStr(cols[map.profile]) : null,
      modality: map.modality != null ? parseStr(cols[map.modality]) : null,
      start_date: map.start_date != null ? parseDate(cols[map.start_date]) : null,
      dropout_date: map.dropout_date != null ? parseDate(cols[map.dropout_date]) : null,
      days_of_training: daysRaw ? (parseInt(daysRaw.trim(), 10) || null) : null,
      hours_of_training: map.hours_of_training != null ? parseNum(cols[map.hours_of_training]) : null,
      amount_to_pay: map.amount_to_pay != null ? parseNum(cols[map.amount_to_pay]) : null,
      language_level_performance: map.language_level_performance != null ? parseStr(cols[map.language_level_performance]) : null,
      level_at_dropout: map.level_at_dropout != null ? parseStr(cols[map.level_at_dropout]) : null,
      absence_percentage: map.absence_percentage != null ? parseNum(cols[map.absence_percentage]) : null,
      reason_for_dropout: map.reason_for_dropout != null ? parseStr(cols[map.reason_for_dropout]) : null,
      interest_in_future: map.interest_in_future != null ? parseStr(cols[map.interest_in_future]) : null,
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
