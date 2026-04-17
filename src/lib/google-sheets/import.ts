/**
 * Promo sheet import pipeline.
 *
 * Fetches all tabs from a Google Sheet, normalises each row into a
 * promo_students record, attempts to cross-reference with Zoho candidates,
 * and upserts everything into Supabase.
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import {
  fetchAllTabs,
  fetchSingleTab,
  extractSheetId,
  KNOWN_GIDS,
  type SheetRow,
  type SheetTab,
} from './client'
import { searchCandidates } from '@/lib/zoho/direct-queries'

// ---------------------------------------------------------------------------
// Column name normalisation
// ---------------------------------------------------------------------------

/**
 * Common column name variants that appear in Global Working promo sheets.
 * Each key maps a set of possible column names → our canonical field.
 */
const COLUMN_MAP: Record<string, string[]> = {
  full_name: ['nombre completo', 'nombre', 'full name', 'name', 'nombre y apellidos'],
  email: ['email', 'correo', 'e-mail', 'correo electrónico'],
  phone: ['teléfono', 'telefono', 'phone', 'móvil', 'movil', 'tel'],
  nationality: ['nacionalidad', 'nationality', 'país de origen'],
  country_of_residence: ['país de residencia', 'country', 'residencia'],
  native_language: ['idioma nativo', 'native language', 'idioma materno'],
  english_level: ['nivel de inglés', 'inglés', 'english level', 'english'],
  german_level: ['nivel de alemán', 'alemán', 'german level', 'german'],
  work_permit: ['permiso de trabajo', 'work permit', 'permiso'],
  sheet_status: ['estado', 'status', 'estado actual', 'situación'],
  sheet_stage: ['etapa', 'stage', 'fase'],
  start_date: ['fecha inicio', 'inicio', 'start date', 'fecha de inicio'],
  end_date: ['fecha fin', 'fin', 'end date', 'fecha de fin'],
  enrollment_date: ['fecha de inscripción', 'inscripción', 'enrollment date', 'fecha inscripcion'],
  dropout_reason: ['motivo de baja', 'razón de baja', 'reason', 'motivo', 'dropout reason', 'causa'],
  dropout_date: ['fecha de baja', 'baja', 'dropout date', 'fecha baja'],
  dropout_notes: [
    'observaciones baja', 'comentarios baja', 'dropout notes',
    'motivos que dan',
  ],
  notes: ['notas', 'notes', 'comentarios', 'observaciones'],
}

/**
 * Extra column mappings specific to Dropouts tabs.
 * These are checked FIRST when processing a dropout tab, then fall through
 * to the standard COLUMN_MAP.
 */
const DROPOUT_COLUMN_MAP: Record<string, string[]> = {
  full_name: ['name', 'nombre'],
  sheet_status: ['status', 'estado'],
  dropout_modality: ['modality', 'modalidad'],
  start_date: ['start date', 'fecha inicio', 'fecha de inicio'],
  dropout_days_of_training: ['days of training', 'días de entrenamiento', 'dias de entrenamiento', 'days training'],
  dropout_date: ['dropout date', 'fecha de baja', 'fecha baja'],
  dropout_reason: ['reason for dropout', 'dropout reason', 'razón de baja', 'motivo de baja'],
  dropout_notes: ['motivos que dan', 'observaciones baja'],
}

/**
 * Normalise a raw sheet header to our canonical field name.
 * Returns null if unmapped (field goes to raw_data).
 *
 * @param header   - Raw column header from the sheet
 * @param extraMap - Optional extra column map checked FIRST (for tab-specific mappings)
 */
function normaliseHeader(
  header: string,
  extraMap?: Record<string, string[]>
): string | null {
  const lower = header.toLowerCase().trim()

  // Check extra map first (more specific)
  if (extraMap) {
    for (const [canonical, variants] of Object.entries(extraMap)) {
      if (variants.some((v) => lower.includes(v) || v.includes(lower))) {
        return canonical
      }
    }
  }

  for (const [canonical, variants] of Object.entries(COLUMN_MAP)) {
    if (variants.some((v) => lower.includes(v) || v.includes(lower))) {
      return canonical
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Row → student record
// ---------------------------------------------------------------------------

export interface StudentRecord {
  full_name: string | null
  email: string | null
  phone: string | null
  nationality: string | null
  country_of_residence: string | null
  native_language: string | null
  english_level: string | null
  german_level: string | null
  work_permit: string | null
  sheet_status: string | null
  sheet_stage: string | null
  start_date: string | null
  end_date: string | null
  enrollment_date: string | null
  dropout_modality: string | null
  dropout_days_of_training: number | null
  dropout_reason: string | null
  dropout_date: string | null
  dropout_notes: string | null
  notes: string | null
  raw_data: SheetRow
  tab_name: string
  row_number: number
}

function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null
  // Try ISO, DD/MM/YYYY, MM/DD/YYYY
  const trimmed = value.trim()
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]

  const euroMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

function rowToStudentRecord(
  row: SheetRow,
  headers: string[],
  tabName: string,
  rowNumber: number,
  extraColumnMap?: Record<string, string[]>
): StudentRecord {
  const mapped: Partial<StudentRecord> & { raw_data: SheetRow; tab_name: string; row_number: number } = {
    raw_data: row,
    tab_name: tabName,
    row_number: rowNumber,
    full_name: null,
    email: null,
    phone: null,
    nationality: null,
    country_of_residence: null,
    native_language: null,
    english_level: null,
    german_level: null,
    work_permit: null,
    sheet_status: null,
    sheet_stage: null,
    start_date: null,
    end_date: null,
    enrollment_date: null,
    dropout_modality: null,
    dropout_days_of_training: null,
    dropout_reason: null,
    dropout_date: null,
    dropout_notes: null,
    notes: null,
  }

  for (const header of headers) {
    const canonical = normaliseHeader(header, extraColumnMap)
    const value = row[header]?.trim() || null

    if (!canonical || !value) continue

    switch (canonical) {
      case 'start_date':
      case 'end_date':
      case 'enrollment_date':
      case 'dropout_date': {
        const typed = mapped as Record<string, string | null | SheetRow | number>
        typed[canonical] = parseDate(value)
        break
      }
      case 'dropout_days_of_training': {
        const typed = mapped as Record<string, string | null | SheetRow | number>
        const parsed = parseInt(value.replace(/[^\d]/g, ''), 10)
        typed[canonical] = Number.isNaN(parsed) ? null : parsed
        break
      }
      default: {
        const typed = mapped as Record<string, string | null | SheetRow | number>
        // Only set if not already set (first matching column wins)
        if (typed[canonical] === null) {
          typed[canonical] = value
        }
      }
    }
  }

  // Heuristic: tabs containing "baja" in the name are dropout tabs
  if (
    tabName.toLowerCase().includes('baja') ||
    tabName.toLowerCase().includes('dropout')
  ) {
    if (!mapped.dropout_reason && mapped.notes) {
      mapped.dropout_reason = mapped.notes
    }
  }

  return mapped as StudentRecord
}

// ---------------------------------------------------------------------------
// Zoho candidate matching
// ---------------------------------------------------------------------------

interface ZohoMatchResult {
  zoho_candidate_id: string
  zoho_status: string | null
  match_confidence: 'exact_email' | 'name_similarity' | 'unmatched'
}

/**
 * Attempts to match a student record to a Zoho candidate.
 * Strategy:
 *   1. Search by email (exact match)
 *   2. Search by full name (contains match)
 */
async function matchToZoho(
  student: StudentRecord,
  jobOpeningId: string
): Promise<ZohoMatchResult> {
  // Try email match first
  if (student.email) {
    try {
      const result = await searchCandidates({
        criteria: `(Email:equals:${student.email}) and (Job_Opening:equals:${jobOpeningId})`,
        per_page: 1,
      })
      if (result.data.length > 0) {
        const candidate = result.data[0]
        return {
          zoho_candidate_id: candidate.id,
          zoho_status: candidate.current_status,
          match_confidence: 'exact_email',
        }
      }
    } catch {
      // Zoho search failed — continue to name match
    }
  }

  // Try name match
  if (student.full_name) {
    try {
      const result = await searchCandidates({
        criteria: `(Full_Name:contains:${student.full_name}) and (Job_Opening:equals:${jobOpeningId})`,
        per_page: 3,
      })
      if (result.data.length === 1) {
        // Only use name match if unambiguous (exactly 1 result)
        const candidate = result.data[0]
        return {
          zoho_candidate_id: candidate.id,
          zoho_status: candidate.current_status,
          match_confidence: 'name_similarity',
        }
      }
    } catch {
      // Zoho search failed — return unmatched
    }
  }

  return {
    zoho_candidate_id: '',
    zoho_status: null,
    match_confidence: 'unmatched',
  }
}

// ---------------------------------------------------------------------------
// Main import pipeline
// ---------------------------------------------------------------------------

export interface ImportResult {
  imported: number
  updated: number
  matched_to_zoho: number
  errors: string[]
  tabs_found: string[]
}

/**
 * Full import pipeline for a promo Google Sheet.
 *
 * 1. Ensure promo_sheets record exists (upsert)
 * 2. Fetch all discoverable tabs from the sheet
 * 3. Parse each tab into student records
 * 4. Attempt Zoho cross-reference (best-effort, non-fatal)
 * 5. Upsert into promo_students
 * 6. Update promo_sheets.last_synced_at + sync_status
 */
export async function importPromoSheet(
  sheetUrl: string,
  jobOpeningId: string,
  sheetName?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    updated: 0,
    matched_to_zoho: 0,
    errors: [],
    tabs_found: [],
  }

  const sheetId = extractSheetId(sheetUrl)

  // ---- Step 1: Upsert promo_sheets record --------------------------------
  const { data: sheetRecord, error: sheetUpsertError } = await supabaseAdmin
    .from('promo_sheets')
    .upsert(
      {
        sheet_url: sheetUrl,
        sheet_id: sheetId,
        job_opening_id: jobOpeningId,
        sheet_name: sheetName ?? `Promo Sheet (${sheetId.slice(0, 8)})`,
        sync_status: 'syncing',
      },
      { onConflict: 'sheet_url' }
    )
    .select('id')
    .single()

  if (sheetUpsertError || !sheetRecord) {
    throw new Error(`Failed to upsert promo_sheets: ${sheetUpsertError?.message}`)
  }

  const promoSheetId: string = sheetRecord.id

  // ---- Step 2: Fetch all tabs -------------------------------------------
  let tabs: SheetTab[]
  try {
    tabs = await fetchAllTabs(sheetUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabaseAdmin
      .from('promo_sheets')
      .update({ sync_status: 'error', sync_error: msg })
      .eq('id', promoSheetId)
    throw new Error(`Failed to fetch Google Sheet: ${msg}`)
  }

  if (tabs.length === 0) {
    await supabaseAdmin
      .from('promo_sheets')
      .update({
        sync_status: 'error',
        sync_error: 'No tabs found — sheet may be private or empty',
      })
      .eq('id', promoSheetId)
    throw new Error('No tabs found in the Google Sheet. Verify it is publicly shared.')
  }

  result.tabs_found = tabs.map((t) => t.tabName)

  // ---- Step 3+4+5: Parse rows, match Zoho, upsert -----------------------
  for (const tab of tabs) {
    for (let i = 0; i < tab.rows.length; i++) {
      const rowNumber = i + 2 // +2 because row 1 is headers (1-indexed)
      const student = rowToStudentRecord(tab.rows[i], tab.rawHeaders, tab.tabName, rowNumber)

      // Skip rows with no name or email (likely empty / filler rows)
      if (!student.full_name && !student.email) continue

      // Best-effort Zoho match
      let zohoMatch: ZohoMatchResult = {
        zoho_candidate_id: '',
        zoho_status: null,
        match_confidence: 'unmatched',
      }

      try {
        zohoMatch = await matchToZoho(student, jobOpeningId)
        if (zohoMatch.match_confidence !== 'unmatched') {
          result.matched_to_zoho++
        }
      } catch (err) {
        // Non-fatal: record the error but continue
        result.errors.push(
          `Zoho match failed for "${student.full_name ?? student.email}": ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }

      // Build upsert payload
      const upsertPayload = {
        promo_sheet_id: promoSheetId,
        job_opening_id: jobOpeningId,
        full_name: student.full_name,
        email: student.email,
        phone: student.phone,
        nationality: student.nationality,
        country_of_residence: student.country_of_residence,
        native_language: student.native_language,
        english_level: student.english_level,
        german_level: student.german_level,
        work_permit: student.work_permit,
        sheet_status: student.sheet_status,
        sheet_stage: student.sheet_stage,
        start_date: student.start_date,
        end_date: student.end_date,
        enrollment_date: student.enrollment_date,
        dropout_modality: student.dropout_modality,
        dropout_days_of_training: student.dropout_days_of_training,
        dropout_reason: student.dropout_reason,
        dropout_date: student.dropout_date,
        dropout_notes: student.dropout_notes,
        notes: student.notes,
        zoho_candidate_id: zohoMatch.zoho_candidate_id || null,
        zoho_status: zohoMatch.zoho_status,
        zoho_matched_at: zohoMatch.match_confidence !== 'unmatched' ? new Date().toISOString() : null,
        match_confidence: zohoMatch.match_confidence,
        raw_data: student.raw_data,
        tab_name: student.tab_name,
        row_number: student.row_number,
      }

      const { error: upsertError } = await supabaseAdmin
        .from('promo_students')
        .upsert(upsertPayload as any, {
          onConflict: 'promo_sheet_id,tab_name,row_number',
        })

      if (upsertError) {
        result.errors.push(
          `Row ${rowNumber} in ${tab.tabName}: ${upsertError.message}`
        )
      } else {
        result.imported++
      }
    }
  }

  // ---- Step 6: Mark sync as done -----------------------------------------
  await supabaseAdmin
    .from('promo_sheets')
    .update({
      sync_status: 'done',
      sync_error: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', promoSheetId)

  return result
}

// ---------------------------------------------------------------------------
// Sync dropout data to candidates table
// ---------------------------------------------------------------------------

/**
 * After importing dropout rows into promo_students, sync the dropout info
 * back to the candidates table for any matched Zoho candidates.
 *
 * Matches by zoho_candidate_id (from promo_students) or by email.
 */
async function syncDropoutsToCandidates(
  promoSheetId: string
): Promise<{ synced: number; errors: string[] }> {
  const syncResult = { synced: 0, errors: [] as string[] }

  // Get all dropout rows from promo_students that have a Zoho match
  const { data: dropoutStudents, error } = await (supabaseAdmin
    .from('promo_students') as any)
    .select('zoho_candidate_id, email, full_name, dropout_reason, dropout_date, dropout_notes, sheet_status, start_date, dropout_modality, dropout_days_of_training')
    .eq('promo_sheet_id', promoSheetId)
    .eq('tab_name', 'Dropouts')

  if (error || !dropoutStudents) {
    syncResult.errors.push(`Failed to fetch dropout students: ${error?.message}`)
    return syncResult
  }

  for (const student of dropoutStudents) {
    // Need either a zoho_candidate_id or an email to match
    if (!student.zoho_candidate_id && !student.email) continue

    const updatePayload = {
      dropout_reason: student.dropout_reason,
      dropout_date: student.dropout_date,
      dropout_notes: student.dropout_notes,
      dropout_start_date: student.start_date ?? null,
      dropout_modality: student.dropout_modality ?? null,
      dropout_days_of_training: student.dropout_days_of_training ?? null,
    }

    let updated = false

    // Try matching by zoho_candidate_id first (= candidates.id)
    if (student.zoho_candidate_id) {
      const { error: updateError, data } = await supabaseAdmin
        .from('candidates')
        .update(updatePayload)
        .eq('id', student.zoho_candidate_id)
        .select('id')

      if (updateError) {
        syncResult.errors.push(
          `Candidate ${student.zoho_candidate_id}: ${updateError.message}`
        )
      } else if (data && data.length > 0) {
        syncResult.synced++
        updated = true
      }
    }

    // Fallback: try matching by email
    if (!updated && student.email) {
      const { error: updateError, data } = await supabaseAdmin
        .from('candidates')
        .update(updatePayload)
        .eq('email', student.email)
        .select('id')

      if (updateError) {
        syncResult.errors.push(
          `Candidate email ${student.email}: ${updateError.message}`
        )
      } else if (data && data.length > 0) {
        syncResult.synced++
      }
    }
  }

  return syncResult
}

// ---------------------------------------------------------------------------
// Dedicated Dropouts tab import
// ---------------------------------------------------------------------------

/**
 * Build an email→name lookup from the Contact Information tab.
 * Returns a map of lowercase email → { name, email (original casing) }.
 */
async function fetchContactEmails(
  sheetUrl: string
): Promise<Map<string, { name: string; email: string }>> {
  const map = new Map<string, { name: string; email: string }>()

  try {
    const tab = await fetchSingleTab(sheetUrl, KNOWN_GIDS.CONTACT_INFO, 'Contact Information')

    for (const row of tab.rows) {
      // Try common header names for email / name
      const email =
        row['Email'] || row['email'] || row['E-mail'] || row['Correo'] || row['correo'] || ''
      const name =
        row['Name'] || row['name'] || row['Nombre'] || row['nombre'] ||
        row['Full Name'] || row['full name'] || row['Nombre completo'] || ''

      if (email.trim()) {
        map.set(email.trim().toLowerCase(), {
          name: name.trim(),
          email: email.trim(),
        })
      }
    }
  } catch (err) {
    // Non-fatal: Contact Information tab may not exist or be inaccessible
    console.warn(
      'Could not fetch Contact Information tab for email cross-ref:',
      err instanceof Error ? err.message : String(err)
    )
  }

  return map
}

/**
 * Import specifically the Dropouts tab from a Promo Google Sheet.
 *
 * 1. Fetches the Dropouts tab by known GID
 * 2. Fetches the Contact Information tab for email cross-referencing
 * 3. Parses dropout rows with dropout-specific column mappings
 * 4. Matches to Zoho candidates by email (from contacts) then by name
 * 5. Upserts into promo_students with tab_name = 'Dropouts'
 */
export async function importDropoutsTab(
  sheetUrl: string,
  jobOpeningId: string,
  sheetName?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    updated: 0,
    matched_to_zoho: 0,
    errors: [],
    tabs_found: [],
  }

  const sheetId = extractSheetId(sheetUrl)

  // ---- Step 1: Upsert promo_sheets record --------------------------------
  const { data: sheetRecord, error: sheetUpsertError } = await supabaseAdmin
    .from('promo_sheets')
    .upsert(
      {
        sheet_url: sheetUrl,
        sheet_id: sheetId,
        job_opening_id: jobOpeningId,
        sheet_name: sheetName ?? `Promo Sheet (${sheetId.slice(0, 8)})`,
        sync_status: 'syncing',
      },
      { onConflict: 'sheet_url' }
    )
    .select('id')
    .single()

  if (sheetUpsertError || !sheetRecord) {
    throw new Error(`Failed to upsert promo_sheets: ${sheetUpsertError?.message}`)
  }

  const promoSheetId: string = sheetRecord.id

  // ---- Step 2: Fetch Dropouts tab ----------------------------------------
  let dropoutsTab: SheetTab
  try {
    dropoutsTab = await fetchSingleTab(sheetUrl, KNOWN_GIDS.DROPOUTS, 'Dropouts')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabaseAdmin
      .from('promo_sheets')
      .update({ sync_status: 'error', sync_error: `Dropouts tab: ${msg}` })
      .eq('id', promoSheetId)
    throw new Error(`Failed to fetch Dropouts tab: ${msg}`)
  }

  result.tabs_found.push('Dropouts')

  // ---- Step 3: Fetch Contact Information for email lookup -----------------
  const contactEmails = await fetchContactEmails(sheetUrl)
  if (contactEmails.size > 0) {
    result.tabs_found.push(`Contact Information (${contactEmails.size} emails)`)
  }

  // Build a name→email lookup from contacts (lowercase name → email)
  const nameToEmail = new Map<string, string>()
  for (const [, { name, email }] of contactEmails) {
    if (name) {
      nameToEmail.set(name.toLowerCase(), email)
    }
  }

  // ---- Step 4: Parse + match + upsert ------------------------------------
  for (let i = 0; i < dropoutsTab.rows.length; i++) {
    const rowNumber = i + 2
    const student = rowToStudentRecord(
      dropoutsTab.rows[i],
      dropoutsTab.rawHeaders,
      'Dropouts',
      rowNumber,
      DROPOUT_COLUMN_MAP
    )

    // Skip rows with no name (empty/filler)
    if (!student.full_name) continue

    // Try to find email from Contact Information tab
    const contactEmail = nameToEmail.get(student.full_name.toLowerCase())
    if (contactEmail && !student.email) {
      student.email = contactEmail
    }

    // Best-effort Zoho match (email first, then name)
    let zohoMatch: ZohoMatchResult = {
      zoho_candidate_id: '',
      zoho_status: null,
      match_confidence: 'unmatched',
    }

    try {
      zohoMatch = await matchToZoho(student, jobOpeningId)
      if (zohoMatch.match_confidence !== 'unmatched') {
        result.matched_to_zoho++
      }
    } catch (err) {
      result.errors.push(
        `Zoho match failed for "${student.full_name}": ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }

    // Build upsert payload
    const upsertPayload = {
      promo_sheet_id: promoSheetId,
      job_opening_id: jobOpeningId,
      full_name: student.full_name,
      email: student.email,
      phone: student.phone,
      nationality: student.nationality,
      country_of_residence: student.country_of_residence,
      native_language: student.native_language,
      english_level: student.english_level,
      german_level: student.german_level,
      work_permit: student.work_permit,
      sheet_status: student.sheet_status,
      sheet_stage: student.sheet_stage,
      start_date: student.start_date,
      end_date: student.end_date,
      enrollment_date: student.enrollment_date,
      dropout_modality: student.dropout_modality,
      dropout_days_of_training: student.dropout_days_of_training,
      dropout_reason: student.dropout_reason,
      dropout_date: student.dropout_date,
      dropout_notes: student.dropout_notes,
      notes: student.notes,
      zoho_candidate_id: zohoMatch.zoho_candidate_id || null,
      zoho_status: zohoMatch.zoho_status,
      zoho_matched_at: zohoMatch.match_confidence !== 'unmatched' ? new Date().toISOString() : null,
      match_confidence: zohoMatch.match_confidence,
      raw_data: student.raw_data,
      tab_name: 'Dropouts',
      row_number: student.row_number,
    }

    const { error: upsertError } = await supabaseAdmin
      .from('promo_students')
      .upsert(upsertPayload as any, {
        onConflict: 'promo_sheet_id,tab_name,row_number',
      })

    if (upsertError) {
      result.errors.push(`Row ${rowNumber} in Dropouts: ${upsertError.message}`)
    } else {
      result.imported++
    }
  }

  // ---- Step 5: Sync dropout data to candidates table ----------------------
  try {
    const syncResult = await syncDropoutsToCandidates(promoSheetId)
    if (syncResult.errors.length > 0) {
      result.errors.push(...syncResult.errors.map((e) => `[candidates sync] ${e}`))
    }
    // Track synced count in updated field
    result.updated += syncResult.synced
  } catch (err) {
    result.errors.push(
      `[candidates sync] Fatal: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // ---- Step 6: Mark sync as done -----------------------------------------
  await supabaseAdmin
    .from('promo_sheets')
    .update({
      sync_status: 'done',
      sync_error: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', promoSheetId)

  return result
}

/**
 * Re-sync all promo_sheets records that are in 'done' or 'error' state.
 */
export async function syncAllPromoSheets(): Promise<
  Array<{ sheet_name: string | null; sheet_url: string } & ImportResult>
> {
  const { data: sheets, error } = await supabaseAdmin
    .from('promo_sheets')
    .select('id, sheet_url, sheet_name, job_opening_id')
    .in('sync_status', ['done', 'error', 'pending'])

  if (error) throw new Error(`Failed to list promo_sheets: ${error.message}`)
  if (!sheets || sheets.length === 0) return []

  const results = []

  for (const sheet of sheets) {
    if (!sheet.job_opening_id) continue

    try {
      const importResult = await importPromoSheet(
        sheet.sheet_url,
        sheet.job_opening_id,
        sheet.sheet_name ?? undefined
      )
      results.push({ sheet_name: sheet.sheet_name, sheet_url: sheet.sheet_url, ...importResult })
    } catch (err) {
      results.push({
        sheet_name: sheet.sheet_name,
        sheet_url: sheet.sheet_url,
        imported: 0,
        updated: 0,
        matched_to_zoho: 0,
        tabs_found: [],
        errors: [err instanceof Error ? err.message : String(err)],
      })
    }
  }

  return results
}
