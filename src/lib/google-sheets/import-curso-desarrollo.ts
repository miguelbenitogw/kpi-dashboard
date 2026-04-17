/**
 * Curso Desarrollo tab import pipeline.
 *
 * Imports the "Curso Desarrollo" tab (gid=244488307) from Excel madre.
 * This tab tracks training session attendance per promotion.
 *
 * Structure:
 *   - Row 1: title row (blank / "CURSO DE DESARROLLO - ...")
 *   - Row 2: actual column headers
 *   - Row 3+: data rows (one session per row; some rows have a blank Promoción
 *             because they are continuation rows for the same session — e.g.
 *             afternoon session of the same day with a different time slot)
 *
 * Strategy: delete existing rows for all promotions seen in this import batch,
 * then insert fresh rows. This avoids duplicate sessions on re-import.
 *
 * Actual headers (row 2):
 *   [0]  Promoción
 *   [1]  Coordinador/a
 *   [2]  Nombre de la sesión formativa
 *   [3]  Duración
 *   [4]  Fecha
 *   [5]  Hora
 *   [6]  Persona que lo imparte
 *   [7]  Nº de personas que forman parte de la Promoción...
 *   [8]  Nº personas que asisten a la sesión de la mañana y la tarde
 *   [9]  Nº total de personas que asisten (mañana + tarde)
 *   [10] % de asistencia
 *   [11] Pasamos Encuesta
 *   [12] Idioma en el que se imparte la sesión
 *   [13] Enlace
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { buildCsvUrl, parseCSV } from './client'
import { MADRE_SHEET_ID } from './import-madre'

// ---------------------------------------------------------------------------
// Sheet constants
// ---------------------------------------------------------------------------

export const CURSO_DESARROLLO_GID = '244488307'

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

const CURSO_COLUMN_MAP: Record<string, string[]> = {
  promocion_nombre:    ['promoción', 'promocion', 'promo'],
  coordinador:         ['coordinador/a', 'coordinador', 'coordinadora'],
  session_name:        ['nombre de la sesión formativa', 'nombre de la sesion formativa', 'sesión formativa', 'sesion formativa', 'nombre sesion', 'nombre de la sesión'],
  duration_hours:      ['duración', 'duracion', 'duration'],
  session_date:        ['fecha'],
  session_time:        ['hora', 'time'],
  instructor:          ['persona que lo imparte', 'instructor', 'imparte'],
  promo_total_people:  ['nº de personas que forman parte', 'personas que forman parte', 'total promo'],
  attendees_count:     ['nº personas que asisten a la sesión de la mañana', 'nº personas que asisten a la sesion', 'personas que asisten a la sesion de la mañana', 'personas mañana tarde', 'asistentes mañana tarde'],
  total_attendees:     ['nº total de personas que asisten', 'total personas que asisten', 'total asistentes', 'total attendees'],
  attendance_pct:      ['% de asistencia', '% asistencia', 'porcentaje asistencia', 'asistencia'],
  survey_sent:         ['pasamos encuesta', 'encuesta'],
  session_language:    ['idioma en el que se imparte', 'idioma', 'language'],
  session_link:        ['enlace', 'link', 'url'],
}

function mapCursoHeader(header: string): string | null {
  const lower = header.toLowerCase().trim()
  // Exact match
  for (const [canonical, variants] of Object.entries(CURSO_COLUMN_MAP)) {
    if (variants.some((v) => lower === v)) {
      return canonical
    }
  }
  // Substring match (min 5 chars)
  for (const [canonical, variants] of Object.entries(CURSO_COLUMN_MAP)) {
    if (variants.some((v) => v.length >= 5 && lower.includes(v))) {
      return canonical
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()

  // ISO format
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const euroMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  return null
}

function parseNumber(value: string): number | null {
  if (!value || !value.trim()) return null
  const cleaned = value.trim().replace(/%/g, '').replace(/\s/g, '').replace(',', '.')
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

/** Parse attendance percentage — "55,26%" → 0.5526 */
function parseAttendancePct(value: string): number | null {
  const n = parseNumber(value)
  if (n === null) return null
  // If value > 1, it's a percentage like 55.26 — normalise to 0–1
  return n > 1 ? n / 100 : n
}

function parseBool(value: string): boolean {
  return ['true', 'yes', 'si', 'sí', '1'].includes((value ?? '').toLowerCase().trim())
}

// ---------------------------------------------------------------------------
// Export result interface
// ---------------------------------------------------------------------------

export interface CursoDesarrolloResult {
  inserted: number
  deleted: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Import the "Curso Desarrollo" tab from the Excel madre sheet.
 *
 * Note: the tab has a title row before the actual headers, so we skip row 1
 * and treat row 2 as headers.
 *
 * Strategy:
 *   1. Parse all rows, tracking which promotions appear.
 *   2. Delete existing curso_desarrollo rows for those promotions.
 *   3. Insert fresh rows.
 *
 * Continuation rows (blank Promoción) inherit the last seen Promoción/Coordinador.
 */
export async function importCursoDesarrollo(): Promise<CursoDesarrolloResult> {
  const result: CursoDesarrolloResult = {
    inserted: 0,
    deleted: 0,
    errors: [],
  }

  // Fetch CSV
  const url = buildCsvUrl(MADRE_SHEET_ID, CURSO_DESARROLLO_GID)
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/csv,text/plain,*/*' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Curso Desarrollo tab (gid=${CURSO_DESARROLLO_GID}): HTTP ${response.status}`
    )
  }

  const csv = await response.text()

  // The tab has a blank title row as row 1.
  // parseCSV will treat row 1 as headers — but those are the title row.
  // We handle this by splitting manually: skip the first CSV line (title row)
  // and parse the remainder.
  const lines = csv.split(/\r?\n/)
  // Drop the first line (title row: ",CURSO DE DESARROLLO - ...")
  const csvWithoutTitle = lines.slice(1).join('\n')

  const { headers, rows } = parseCSV(csvWithoutTitle)

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('Curso Desarrollo tab returned no data after skipping title row')
    return result
  }

  // Build header mapping
  const headerMap = new Map<string, string>()
  for (const h of headers) {
    const canonical = mapCursoHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  // Parse all rows and collect session records
  const sessions: Array<Record<string, unknown>> = []
  const promosSeen = new Set<string>()

  let lastPromoNombre: string | null = null
  let lastCoordinador: string | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 3 // +3 because we skipped title row and headers row

    const mapped: Record<string, string> = {}
    for (const [rawHeader, canonical] of headerMap) {
      const value = row[rawHeader]?.trim()
      if (value) mapped[canonical] = value
    }

    // Carry forward promo/coordinator from previous rows (continuation rows)
    if (mapped['promocion_nombre']) {
      lastPromoNombre = mapped['promocion_nombre']
    }
    if (mapped['coordinador']) {
      lastCoordinador = mapped['coordinador']
    }

    const promoNombre = lastPromoNombre
    const coordinador = lastCoordinador

    // session_name is required
    const sessionName = mapped['session_name']
    if (!sessionName) {
      // Empty session row (e.g. totals or truly blank) — skip
      continue
    }

    if (promoNombre) {
      promosSeen.add(promoNombre)
    }

    sessions.push({
      promocion_nombre: promoNombre,
      coordinador,
      session_name: sessionName,
      duration_hours: parseNumber(mapped['duration_hours'] ?? ''),
      session_date: parseDate(mapped['session_date'] ?? ''),
      session_time: mapped['session_time'] ?? null,
      instructor: mapped['instructor'] ?? null,
      promo_total_people: parseNumber(mapped['promo_total_people'] ?? '') != null
        ? Math.round(parseNumber(mapped['promo_total_people'] ?? '')!)
        : null,
      attendees_count: parseNumber(mapped['attendees_count'] ?? '') != null
        ? Math.round(parseNumber(mapped['attendees_count'] ?? '')!)
        : null,
      total_attendees: parseNumber(mapped['total_attendees'] ?? '') != null
        ? Math.round(parseNumber(mapped['total_attendees'] ?? '')!)
        : null,
      attendance_pct: parseAttendancePct(mapped['attendance_pct'] ?? ''),
      survey_sent: mapped['survey_sent'] ? parseBool(mapped['survey_sent']) : null,
      session_language: mapped['session_language'] ?? null,
      session_link: mapped['session_link'] ?? null,
    })
  }

  if (sessions.length === 0) {
    result.errors.push('Curso Desarrollo: no valid session rows found')
    return result
  }

  // Delete existing rows for promotions seen in this batch
  // Note: (supabaseAdmin as any) cast because curso_desarrollo is added in migration 014
  // and the generated types haven't been regenerated yet.
  if (promosSeen.size > 0) {
    const { error: deleteError, count } = await (supabaseAdmin as any)
      .from('curso_desarrollo')
      .delete({ count: 'exact' })
      .in('promocion_nombre', [...promosSeen])

    if (deleteError) {
      result.errors.push(`Delete existing sessions error: ${deleteError.message}`)
      return result
    }
    result.deleted = count ?? 0
  }

  // Insert all sessions in batches of 100
  const BATCH_SIZE = 100
  for (let start = 0; start < sessions.length; start += BATCH_SIZE) {
    const batch = sessions.slice(start, start + BATCH_SIZE)

    const { error: insertError } = await (supabaseAdmin as any)
      .from('curso_desarrollo')
      .insert(batch)

    if (insertError) {
      result.errors.push(
        `Insert sessions batch (rows ${start + 1}-${start + batch.length}): ${insertError.message}`
      )
    } else {
      result.inserted += batch.length
    }
  }

  return result
}
