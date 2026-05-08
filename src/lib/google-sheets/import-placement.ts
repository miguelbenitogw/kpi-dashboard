/**
 * Norway Global Placement importer — complete pipeline.
 *
 * Reads three sources from each Excel Madre sheet (Norway 2025 / 2026):
 *   1. "Global Placement"  (gid=1470777220) — both years
 *   2. "GP - Applications" (gid=1046136855) — 2025 only
 *   3. "Base Datos"        (gid=1510708848) — both years, headerRow=2
 *
 * Rules:
 *   - Join by Zoho ID. Never create new candidates (skip if not found).
 *   - No null-overwrite: only set fields when the sheet has a non-empty value.
 *   - Booleans: TRUE/FALSE/true/false/1/0/yes/no
 *   - Dates: DD/MM/YYYY → YYYY-MM-DD; "aprox" / free text → null
 *   - GP-Applications blocks: 31 groups of 5 cols, identified by position.
 *     Upsert into norway_gp_applications_kpi on (candidate_id, sheet_year, block_number).
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { readSheetAsRows } from './client'

// ---------------------------------------------------------------------------
// GID constants
// ---------------------------------------------------------------------------

const GID_GLOBAL_PLACEMENT = 1470777220
const GID_GP_APPLICATIONS  = 1046136855
const GID_BASE_DATOS        = 1510708848

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface PlacementImportResult {
  sheet: string    // '2025' | '2026'
  source: string   // 'GlobalPlacement' | 'GPApplications' | 'BaseDatos'
  updated: number
  inserted: number // for norway_gp_applications_kpi rows
  skipped: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()

  // ISO format YYYY-MM-DD
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]!

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const euroMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  // "aprox" or any free text → null
  return null
}

function parseBool(value: string | undefined | null): boolean | null {
  if (value === undefined || value === null) return null
  const v = value.toLowerCase().trim()
  if (['true', '1', 'yes', 'si', 'sí'].includes(v)) return true
  if (['false', '0', 'no'].includes(v)) return false
  return null
}

/** Only returns value if non-empty string; otherwise null. */
function str(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null
  return value.trim()
}

// ---------------------------------------------------------------------------
// Candidate lookup cache (shared across sources within one importPlacement call)
// ---------------------------------------------------------------------------

type CandidateSet = Set<string>

async function loadCandidateIds(): Promise<CandidateSet> {
  const { data, error } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id')

  if (error) throw new Error(`Failed to fetch candidate IDs: ${error.message}`)
  const set: CandidateSet = new Set()
  for (const c of data ?? []) set.add(c.id)
  return set
}

// ---------------------------------------------------------------------------
// SOURCE 1: Global Placement tab
// ---------------------------------------------------------------------------

/**
 * Column map for "Global Placement" tab.
 * Keys are canonical field names in candidates_kpi.
 * Values are ordered list of header variants to try (first match wins).
 */
const GP_TAB_COLUMN_MAP: Record<string, string[]> = {
  // --- join key ---
  id: ['zoho id', 'zoho_id', 'id'],
  // --- new fields (migration only — not in old importer) ---
  gp_finish_date:           ['finish date'],
  gp_tipo_perfil:           ['tipo de perfil', 'tipo perfil'],
  gp_preferences:           ['preferences'],
  gp_hpr_nummer:            ['hpr-nummer', 'hpr nummer', 'hpr'],
  gp_webcruiter:            ['webcruiter'],
  gp_application_sent:      ['application', 'application sent'],
  gp_profile_talent_portal: ['profile on the talent portal', 'profile talent portal', 'talent portal'],
  gp_seminar:               ['seminar'],
  // --- existing fields ---
  gp_kontaktperson:         ['kontaktperson'],
  gp_training_status:       ['status (training)', 'training status'],
  gp_comments:              ['comments (coordinators)', 'comment'],
  gp_open_to:               ['open to'],
  gp_priority:              ['priority'],
  placement_status:         ['status (placement)', 'placement status'],
  assigned_agency:          ['assigned agency', 'agency'],
  gp_assignment:            ['assignment', 'assignment (municipality/agency)'],
  gp_arrival_date:          ['arrival'],
  gp_shots:                 ['shots'],
  gp_cv_norsk:              ['cv norsk'],
  gp_blind_cv_norsk:        ['blind cv norsk'],
  gp_last_update_placement: ['last update (placement)', 'last update mail', 'last update'],
  gp_has_profile:           ['has global placement profile?', 'has gp profile'],
  gp_availability:          ['availability'],
  gp_pk:                    ['pk (presenting card)', 'pk'],
  gp_criminal_record:       ['criminal record'],
  gp_sarm:                  ['sarm'],
  gp_mantux:                ['mantux'],
}

function resolveGpTabHeaders(headers: string[]): Map<number, string> {
  // Returns colIndex → canonicalField
  const resolved = new Map<number, string>()
  for (let i = 0; i < headers.length; i++) {
    const lower = (headers[i] ?? '').toLowerCase().trim()
    for (const [canonical, variants] of Object.entries(GP_TAB_COLUMN_MAP)) {
      if (variants.some((v) => lower === v || (v.length >= 5 && lower.includes(v)))) {
        if (!resolved.has(i)) resolved.set(i, canonical)
        break
      }
    }
  }
  return resolved
}

async function importFromGlobalPlacement(
  sheetId: string,
  year: number,
  candidateIds: CandidateSet,
): Promise<PlacementImportResult> {
  const result: PlacementImportResult = {
    sheet: String(year),
    source: 'GlobalPlacement',
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  let headers: string[]
  let rows: Array<Record<string, string>>

  try {
    const data = await readSheetAsRows(sheetId, GID_GLOBAL_PLACEMENT)
    headers = data.headers
    rows = data.rows
  } catch (err) {
    result.errors.push(`Failed to read GlobalPlacement tab: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('GlobalPlacement tab returned no data')
    return result
  }

  const colMap = resolveGpTabHeaders(headers)

  // Invert to: colIndex → header string for row access
  const idColIndex = [...colMap.entries()].find(([, f]) => f === 'id')?.[0] ?? -1
  const idHeader = idColIndex >= 0 ? headers[idColIndex] : null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    // Resolve Zoho ID
    let zohoId: string | null = null
    if (idHeader) {
      zohoId = str(row[idHeader])
    }
    // Fallback: scan all potential id-column variants
    if (!zohoId) {
      for (const v of ['Zoho ID', 'zoho id', 'ID', 'id']) {
        if (row[v] && str(row[v])) { zohoId = str(row[v]); break }
      }
    }

    if (!zohoId) { result.skipped++; continue }
    if (!candidateIds.has(zohoId)) { result.skipped++; continue }

    // Build update payload — only non-empty values
    const payload: Record<string, unknown> = {}

    for (const [colIdx, canonical] of colMap.entries()) {
      if (canonical === 'id') continue
      const headerKey = headers[colIdx]!
      const raw = row[headerKey]
      if (!raw || !raw.trim()) continue // no null-overwrite

      // Type-aware mapping
      switch (canonical) {
        case 'gp_finish_date':
        case 'gp_arrival_date':
          payload[canonical] = parseDate(raw)
          break
        case 'gp_cv_norsk':
        case 'gp_blind_cv_norsk':
        case 'gp_criminal_record':
        case 'gp_sarm':
        case 'gp_mantux':
        case 'gp_has_profile':
        case 'gp_webcruiter':
        case 'gp_application_sent':
        case 'gp_profile_talent_portal':
        case 'gp_seminar': {
          const b = parseBool(raw)
          if (b !== null) payload[canonical] = b
          break
        }
        default:
          payload[canonical] = raw.trim()
      }
    }

    if (Object.keys(payload).length === 0) { result.skipped++; continue }

    const { error } = await (supabaseAdmin as any)
      .from('candidates_kpi')
      .update(payload)
      .eq('id', zohoId)

    if (error) {
      result.errors.push(`Row ${rowNum} (${zohoId}): ${error.message}`)
    } else {
      result.updated++
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// SOURCE 2: GP - Applications tab (2025 only)
// ---------------------------------------------------------------------------

/**
 * Metadata columns in GP-Applications (before block columns).
 * These map to candidates_kpi fields.
 */
const GP_APP_META_MAP: Record<string, string[]> = {
  id:                           ['zoho id', 'zoho_id', 'id'],
  gp_total_applications:        ['total nr applications', 'total applications'],
  gp_interviews_ratio:          ['interviews'],
  gp_applications_this_period:  ['how many applications sent this period?', 'applications this period'],
}

/** First column index of the application blocks (0-based). */
const BLOCK_START_COL = 17
const BLOCK_SIZE = 5

function resolveGpAppMetaHeaders(headers: string[]): Map<number, string> {
  const resolved = new Map<number, string>()
  for (let i = 0; i < Math.min(headers.length, BLOCK_START_COL); i++) {
    const lower = (headers[i] ?? '').toLowerCase().trim()
    for (const [canonical, variants] of Object.entries(GP_APP_META_MAP)) {
      if (variants.some((v) => lower === v || (v.length >= 5 && lower.includes(v)))) {
        if (!resolved.has(i)) resolved.set(i, canonical)
        break
      }
    }
  }
  return resolved
}

interface AppBlock {
  blockNumber: number  // 1-31
  titleColIdx: number
  linkColIdx: number
  dateColIdx: number
  statusColIdx: number
  commentColIdx: number
}

function parseApplicationBlocks(headers: string[]): AppBlock[] {
  const blocks: AppBlock[] = []
  const maxBlocks = Math.floor((headers.length - BLOCK_START_COL) / BLOCK_SIZE)
  const actualBlocks = Math.min(maxBlocks, 31)

  for (let b = 0; b < actualBlocks; b++) {
    const base = BLOCK_START_COL + b * BLOCK_SIZE
    blocks.push({
      blockNumber: b + 1,
      titleColIdx:   base,
      linkColIdx:    base + 1,
      dateColIdx:    base + 2,
      statusColIdx:  base + 3,
      commentColIdx: base + 4,
    })
  }
  return blocks
}

async function importFromGpApplications(
  sheetId: string,
  year: number,
  candidateIds: CandidateSet,
): Promise<PlacementImportResult> {
  const result: PlacementImportResult = {
    sheet: String(year),
    source: 'GPApplications',
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  // GP - Applications only exists in 2025
  if (year !== 2025) {
    result.skipped = 0
    return result
  }

  let headers: string[]
  let rows: Array<Record<string, string>>

  try {
    const data = await readSheetAsRows(sheetId, GID_GP_APPLICATIONS)
    headers = data.headers
    rows = data.rows
  } catch (err) {
    result.errors.push(`Failed to read GP-Applications tab: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('GP-Applications tab returned no data')
    return result
  }

  const metaMap = resolveGpAppMetaHeaders(headers)
  const appBlocks = parseApplicationBlocks(headers)

  const idColEntry = [...metaMap.entries()].find(([, f]) => f === 'id')
  const idHeader = idColEntry !== undefined ? headers[idColEntry[0]] : null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    // Resolve Zoho ID
    let zohoId: string | null = null
    if (idHeader) zohoId = str(row[idHeader])
    if (!zohoId) {
      for (const v of ['Zoho ID', 'zoho id', 'ID', 'id']) {
        if (row[v] && str(row[v])) { zohoId = str(row[v]); break }
      }
    }

    if (!zohoId) { result.skipped++; continue }
    if (!candidateIds.has(zohoId)) { result.skipped++; continue }

    // --- Metadata: update candidates_kpi ---
    const metaPayload: Record<string, unknown> = {}
    for (const [colIdx, canonical] of metaMap.entries()) {
      if (canonical === 'id') continue
      const headerKey = headers[colIdx]!
      const raw = row[headerKey]
      if (!raw || !raw.trim()) continue
      // These are numeric text fields, store as-is
      metaPayload[canonical] = raw.trim()
    }

    if (Object.keys(metaPayload).length > 0) {
      const { error } = await (supabaseAdmin as any)
        .from('candidates_kpi')
        .update(metaPayload)
        .eq('id', zohoId)

      if (error) {
        result.errors.push(`Row ${rowNum} meta (${zohoId}): ${error.message}`)
      } else {
        result.updated++
      }
    }

    // --- Application blocks: upsert into norway_gp_applications_kpi ---
    for (const block of appBlocks) {
      const titleHeader   = headers[block.titleColIdx]
      const linkHeader    = headers[block.linkColIdx]
      const dateHeader    = headers[block.dateColIdx]
      const statusHeader  = headers[block.statusColIdx]
      const commentHeader = headers[block.commentColIdx]

      const jobTitle = titleHeader ? str(row[titleHeader]) : null
      if (!jobTitle) continue  // rule 6: skip if title empty

      const jobLink   = linkHeader   ? str(row[linkHeader])   : null
      const rawDate   = dateHeader   ? str(row[dateHeader])   : null
      const status    = statusHeader ? str(row[statusHeader]) : null
      const comment   = commentHeader ? str(row[commentHeader]) : null

      const appRow = {
        candidate_id:       zohoId,
        nombre:             null as string | null,  // not available in this tab
        sheet_year:         year,
        sheet_id:           sheetId,
        block_number:       block.blockNumber,
        job_title:          jobTitle,
        job_link:           jobLink,
        application_date:   parseDate(rawDate),
        application_status: status,
        comment:            comment,
        synced_at:          new Date().toISOString(),
      }

      const { error } = await (supabaseAdmin as any)
        .from('norway_gp_applications_kpi')
        .upsert(appRow, { onConflict: 'candidate_id,sheet_year,block_number' })

      if (error) {
        result.errors.push(`Row ${rowNum} block ${block.blockNumber} (${zohoId}): ${error.message}`)
      } else {
        result.inserted++
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// SOURCE 3: Base Datos tab
// ---------------------------------------------------------------------------

const BASE_DATOS_COLUMN_MAP: Record<string, string[]> = {
  id:                  ['id', 'zoho id', 'zoho_id'],
  tiempo_colocacion:   ['tiempo de colocación', 'tiempo colocacion', 'tiempo de colocacion'],
  gp_quincena:         ['quincena'],
  gp_mes_anio_llegada: ['mes y año de llegada', 'mes y ano de llegada', 'mes y año llegada'],
  placement_client:    ['cliente', 'client'],
  placement_date:      ['fecha inicio de trabajo en noruega', 'fecha inicio trabajo en noruega', 'fecha inicio trabajo', 'fecha inicio de trabajo'],
}

function resolveBaseDatosHeaders(headers: string[]): Map<number, string> {
  const resolved = new Map<number, string>()
  for (let i = 0; i < headers.length; i++) {
    const lower = (headers[i] ?? '').toLowerCase().trim()
    for (const [canonical, variants] of Object.entries(BASE_DATOS_COLUMN_MAP)) {
      if (variants.some((v) => lower === v || (v.length >= 4 && lower.includes(v)))) {
        if (!resolved.has(i)) resolved.set(i, canonical)
        break
      }
    }
  }
  return resolved
}

/** Returns true if a row looks like a repeated header row (all values match known header names). */
function isHeaderRow(row: Record<string, string>, canonical: Map<number, string>, headers: string[]): boolean {
  let headerLikeCount = 0
  let totalValues = 0
  for (const [colIdx] of canonical.entries()) {
    const h = headers[colIdx]
    if (!h) continue
    const v = (row[h] ?? '').toLowerCase().trim()
    if (!v) continue
    totalValues++
    // If the cell value looks like a column name (contains known keywords)
    if (
      v.includes('id') || v.includes('cliente') || v.includes('fecha') ||
      v.includes('quincena') || v.includes('tiempo') || v.includes('mes')
    ) headerLikeCount++
  }
  return totalValues > 0 && headerLikeCount === totalValues
}

async function importFromBaseDatos(
  sheetId: string,
  year: number,
  candidateIds: CandidateSet,
): Promise<PlacementImportResult> {
  const result: PlacementImportResult = {
    sheet: String(year),
    source: 'BaseDatos',
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  let headers: string[]
  let rows: Array<Record<string, string>>

  // Try with headerRow=2 first (Base Datos has a doubled header row)
  try {
    const data = await readSheetAsRows(sheetId, GID_BASE_DATOS, { headerRow: 2 })
    headers = data.headers
    rows = data.rows
  } catch (err) {
    result.errors.push(`Failed to read BaseDatos tab: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  // If headerRow=2 returned nothing, retry with headerRow=1
  if (headers.length === 0 || rows.length === 0) {
    try {
      const data = await readSheetAsRows(sheetId, GID_BASE_DATOS, { headerRow: 1 })
      headers = data.headers
      rows = data.rows
    } catch (err) {
      result.errors.push(`Failed to read BaseDatos tab (fallback headerRow=1): ${err instanceof Error ? err.message : String(err)}`)
      return result
    }
  }

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('BaseDatos tab returned no data after both headerRow attempts')
    return result
  }

  const colMap = resolveBaseDatosHeaders(headers)
  const idColEntry = [...colMap.entries()].find(([, f]) => f === 'id')
  const idHeader = idColEntry !== undefined ? headers[idColEntry[0]] : null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    // Skip header-repeat rows (first data row may be a copy of headers)
    if (isHeaderRow(row, colMap, headers)) { result.skipped++; continue }

    // Resolve Zoho ID
    let zohoId: string | null = null
    if (idHeader) zohoId = str(row[idHeader])
    if (!zohoId) {
      for (const v of ['ID', 'Zoho ID', 'zoho id', 'id']) {
        if (row[v] && str(row[v])) { zohoId = str(row[v]); break }
      }
    }

    if (!zohoId) { result.skipped++; continue }
    if (!candidateIds.has(zohoId)) { result.skipped++; continue }

    const payload: Record<string, unknown> = {}

    for (const [colIdx, canonical] of colMap.entries()) {
      if (canonical === 'id') continue
      const headerKey = headers[colIdx]!
      const raw = row[headerKey]
      if (!raw || !raw.trim()) continue

      switch (canonical) {
        case 'placement_date':
          payload[canonical] = parseDate(raw)
          break
        default:
          payload[canonical] = raw.trim()
      }
    }

    if (Object.keys(payload).length === 0) { result.skipped++; continue }

    const { error } = await (supabaseAdmin as any)
      .from('candidates_kpi')
      .update(payload)
      .eq('id', zohoId)

    if (error) {
      result.errors.push(`Row ${rowNum} (${zohoId}): ${error.message}`)
    } else {
      result.updated++
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run the full Norway placement import pipeline for a single spreadsheet.
 *
 * Reads three tabs sequentially and returns one result per source.
 * The caller is responsible for iterating over multiple spreadsheets
 * (e.g. 2025 and 2026).
 *
 * @param sheetId - Google Sheets spreadsheet ID
 * @param year    - Calendar year of the spreadsheet (2025 | 2026)
 */
export async function importPlacement(sheetId: string, year: number): Promise<PlacementImportResult[]> {
  // Load candidate IDs once, shared across all three sources
  const candidateIds = await loadCandidateIds()

  const results: PlacementImportResult[] = []

  // 1. Global Placement tab (both years)
  results.push(await importFromGlobalPlacement(sheetId, year, candidateIds))

  // 2. GP - Applications tab (2025 only — function returns early for other years)
  results.push(await importFromGpApplications(sheetId, year, candidateIds))

  // 3. Base Datos tab (both years)
  results.push(await importFromBaseDatos(sheetId, year, candidateIds))

  return results
}
