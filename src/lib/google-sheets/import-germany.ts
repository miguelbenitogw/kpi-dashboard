/**
 * Excel madre Alemania import pipeline.
 *
 * Fetches data from the Germany "Excel madre" Google Sheet and syncs it into Supabase.
 * Tabs imported:
 *   - Base Datos: individual candidate data (~798 rows)
 *   - Exámenes: exam results per promo (~102 rows)
 *   - Pagos - Proyectos Infantil: payment tracking per candidate (~418 rows)
 *
 * Uses readSheetByName (by tab name, not GID) to avoid GID fragility.
 * Sheet ID: 1QlhUN2QKuPyf9mcrXQsffArijDRDNvgD-Y2JxQfo2eM
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { readSheetByName, type ServiceSheetRow } from './client'
import { extractPromoNumber } from '@/lib/queries/promotions-core'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GERMANY_SHEET_ID = '1QlhUN2QKuPyf9mcrXQsffArijDRDNvgD-Y2JxQfo2eM'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Parse a date string in various formats to ISO YYYY-MM-DD.
 * Handles: ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 */
function parseDate(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  const trimmed = value.trim()

  // ISO format
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const euroMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  return null
}

/**
 * Parse a numeric string, handling %, spaces, comma decimals, dots.
 */
function parseNumber(value: string | null | undefined): number | null {
  if (!value || !value.trim()) return null
  const cleaned = value.trim().replace(/%/g, '').replace(/\s/g, '').replace(',', '.')
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

/**
 * Parse an integer string. Returns null if empty or non-numeric.
 */
function parseInteger(value: string | null | undefined): number | null {
  const n = parseNumber(value)
  return n === null ? null : Math.round(n)
}

/**
 * Normalize a header string for robust matching:
 * lowercase, trim, remove accents (naive: map common accented chars).
 */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
}

/**
 * Build a mapping from raw header → canonical field name given a map of
 * canonical → [variant strings] (all pre-normalized).
 *
 * Strategy:
 *   1. Exact match (normalized)
 *   2. Substring match for variants >= 4 chars
 */
function buildHeaderMap(
  headers: string[],
  columnMap: Record<string, string[]>,
): Map<string, string> {
  const result = new Map<string, string>()
  for (const rawHeader of headers) {
    const normalized = normalizeHeader(rawHeader)
    // Pass 1: exact match
    for (const [canonical, variants] of Object.entries(columnMap)) {
      if (variants.some((v) => normalized === v)) {
        result.set(rawHeader, canonical)
        break
      }
    }
    if (result.has(rawHeader)) continue
    // Pass 2: substring match (min 4 chars to avoid false positives)
    for (const [canonical, variants] of Object.entries(columnMap)) {
      if (variants.some((v) => v.length >= 4 && normalized.includes(v))) {
        result.set(rawHeader, canonical)
        break
      }
    }
  }
  return result
}

/**
 * Extract mapped values from a row using a pre-built headerMap.
 */
function extractMapped(row: ServiceSheetRow, headerMap: Map<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [rawHeader, canonical] of headerMap) {
    const value = row[rawHeader]?.trim()
    if (value) mapped[canonical] = value
  }
  return mapped
}

// ---------------------------------------------------------------------------
// Base Datos importer
// ---------------------------------------------------------------------------

const BASE_DATOS_COLUMN_MAP: Record<string, string[]> = {
  excel_id: ['id'],
  nombre: ['nombre y apellidos', 'nombre completo', 'nombre'],
  promocion: ['promocion', 'promoción'],
  coordinador: ['coordinador', 'coordinadora'],
  estado: ['estado'],
  tipo_perfil: ['tipo de perfil', 'tipo perfil', 'tipo de perfil', 'perfil'],
  quincena: ['quincena'],
  mes_llegada: ['mes y ano de llegada', 'mes y ano llegada', 'mes de llegada', 'mes llegada', 'mes y ano de llegada'],
  cliente: ['cliente'],
  ciudad_kita: ['ciudad kita', 'ciudad', 'kita'],
  fp: ['fp'],
  universidad_pedagogia: ['universidad pedagogia', 'u. pedagogia', 'pedagogia'],
  universidad_infantil: ['universidad infantil', 'u. infantil', 'infantil'],
  universidad_fisio: ['universidad fisio', 'u. fisioterapia', 'fisio', 'fisioterapia'],
  universidad_ingenieria: ['universidad ingenieria', 'u. ingenieria', 'ingenieria'],
  otros_estudios: ['otros estudios', 'otros'],
}

export interface GermanyBaseDatosResult {
  upserted: number
  skipped: number
  errors: string[]
}

/**
 * Import "Base Datos" tab from the Germany Excel madre sheet.
 *
 * Upserts into germany_candidates_kpi with conflict on (excel_id, sheet_id).
 * Rows without a numeric ID are skipped.
 */
export async function importGermanyBaseDatos(sheetId: string): Promise<GermanyBaseDatosResult> {
  const result: GermanyBaseDatosResult = { upserted: 0, skipped: 0, errors: [] }

  let rows: ServiceSheetRow[]
  try {
    rows = await readSheetByName(sheetId, 'Base Datos')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Failed to read Base Datos tab: ${msg}`)
    return result
  }

  if (rows.length === 0) {
    result.errors.push('Base Datos tab returned no data')
    return result
  }

  const headers = Object.keys(rows[0]!)
  const headerMap = buildHeaderMap(headers, BASE_DATOS_COLUMN_MAP)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2 // 1-indexed; header is row 1

    const mapped = extractMapped(row, headerMap)

    // Require a numeric ID (Zoho candidate ID)
    const rawId = mapped['excel_id']
    if (!rawId) {
      result.skipped++
      continue
    }

    const excelId = parseInteger(rawId)
    if (excelId === null) {
      result.skipped++
      continue
    }

    const nombre = mapped['nombre']
    if (!nombre) {
      result.skipped++
      continue
    }

    const rawPromo = mapped['promocion'] ?? null
    const promoNumero = rawPromo ? extractPromoNumber(rawPromo) : null

    const payload = {
      excel_id: excelId,
      zoho_candidate_id: rawId,
      nombre,
      promocion: rawPromo,
      promo_numero: promoNumero,
      coordinador: mapped['coordinador'] ?? null,
      estado: mapped['estado'] ?? null,
      tipo_perfil: mapped['tipo_perfil'] ?? null,
      quincena: mapped['quincena'] ?? null,
      mes_llegada: mapped['mes_llegada'] ?? null,
      cliente: mapped['cliente'] ?? null,
      ciudad_kita: mapped['ciudad_kita'] ?? null,
      fp: mapped['fp'] ?? null,
      universidad_pedagogia: mapped['universidad_pedagogia'] ?? null,
      universidad_infantil: mapped['universidad_infantil'] ?? null,
      universidad_fisio: mapped['universidad_fisio'] ?? null,
      universidad_ingenieria: mapped['universidad_ingenieria'] ?? null,
      otros_estudios: mapped['otros_estudios'] ?? null,
      sheet_id: sheetId,
      synced_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin
      .from('germany_candidates_kpi' as any)
      .upsert(payload, { onConflict: 'excel_id,sheet_id' })

    if (upsertError) {
      result.errors.push(`Row ${rowNum} (ID ${excelId}): ${upsertError.message}`)
    } else {
      result.upserted++
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Exámenes importer
// ---------------------------------------------------------------------------

// NOTE: promo_texto is handled via 'col_0' — the first column has no header in this tab
// (merged cell containing the promo name). Do NOT add 'promo' as a variant here because
// it would substring-match 'personas totales de la promo' → wrong field.
const EXAMENES_COLUMN_MAP: Record<string, string[]> = {
  num_total: ['personas totales de la promo', 'personas totales', 'total', 'no total', 'num total', 'n total'],
  num_in_training: ['candidatos in training', 'in training'],
  num_to_place: ['candidatos por colocar', 'por colocar', 'no hired'],
  pct_colocacion: ['% colocacion', '% colocación', 'colocacion', 'colocación'],
  profesor: ['profesor', 'profesora'],
  fecha_fin_formacion: ['fecha fin formacion', 'fecha fin de formacion', 'fin de formacion', 'fin formacion'],
  b1_fecha: ['b1 fecha', 'fecha b1'],
  b1_aprobados_1a: ['b1 aprobados 1a', 'aprobados b1 1a', 'b1 1a'],
  b1_pct_aprobados: ['% b1', '% aprobados b1', 'pct b1'],
  b1_aprobados_2a: ['b1 aprobados 2a', 'aprobados b1 2a', 'b1 2a'],
  b2_fecha: ['b2 fecha', 'fecha b2'],
  b2_aprobados_1a: ['b2 aprobados 1a', 'aprobados b2 1a', 'b2 1a'],
  b2_pct_aprobados: ['% b2', '% aprobados b2', 'pct b2'],
  estado_iqz: ['iqz', 'iq zukunft'],
  estado_berlin: ['berlín', 'berlin'],
  estado_standby: ['stand by', 'standby'],
  estado_assigned: ['assigned'],
  estado_hired: ['hired'],
  estado_fuera_red: ['fuera red', 'fuera de la red', 'out of network'],
  estado_offer_withdrawn: ['offer withdrawn'],
}

export interface GermanyExamenesResult {
  upserted: number
  skipped: number
  errors: string[]
}

/**
 * Import "Exámenes" tab from the Germany Excel madre sheet.
 *
 * Upserts into germany_exams_kpi with conflict on (promo_numero, sheet_id).
 * Tries "Exámenes" first; falls back to "Examenes" if the tab name with accent fails.
 */
export async function importGermanyExamenes(sheetId: string): Promise<GermanyExamenesResult> {
  const result: GermanyExamenesResult = { upserted: 0, skipped: 0, errors: [] }

  let rows: ServiceSheetRow[]
  try {
    rows = await readSheetByName(sheetId, 'Exámenes')
  } catch {
    // Try without accent
    try {
      rows = await readSheetByName(sheetId, 'Examenes')
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2)
      result.errors.push(`Failed to read Exámenes tab: ${msg}`)
      return result
    }
  }

  if (rows.length === 0) {
    result.errors.push('Exámenes tab returned no data')
    return result
  }

  const headers = Object.keys(rows[0]!)
  const headerMap = buildHeaderMap(headers, EXAMENES_COLUMN_MAP)
  // The first column has no header (merged cell = promo name) → col_0
  if (headers.includes('col_0')) headerMap.set('col_0', 'promo_texto')

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    const mapped = extractMapped(row, headerMap)

    const rawPromo = mapped['promo_texto']
    if (!rawPromo) {
      result.skipped++
      continue
    }

    // Skip summary/total rows
    const lower = rawPromo.toLowerCase()
    if (lower.includes('total') || lower.includes('resumen') || lower.includes('promo')) {
      // "promo" alone could be a header remnant — skip if it's just the word
      if (lower === 'promo' || lower === 'promocion' || lower === 'promoción') {
        result.skipped++
        continue
      }
    }

    const promoNumero = extractPromoNumber(rawPromo)
    if (promoNumero === null) {
      result.skipped++
      continue
    }

    const payload = {
      promo_texto: rawPromo,
      promo_numero: promoNumero,
      num_total: parseInteger(mapped['num_total']),
      num_in_training: parseInteger(mapped['num_in_training']),
      num_to_place: parseInteger(mapped['num_to_place']),
      pct_colocacion: parseNumber(mapped['pct_colocacion']),
      profesor: mapped['profesor'] ?? null,
      fecha_fin_formacion: parseDate(mapped['fecha_fin_formacion']),
      b1_fecha: parseDate(mapped['b1_fecha']),
      b1_aprobados_1a: parseInteger(mapped['b1_aprobados_1a']),
      b1_pct_aprobados: parseNumber(mapped['b1_pct_aprobados']),
      b1_aprobados_2a: parseInteger(mapped['b1_aprobados_2a']),
      b2_fecha: parseDate(mapped['b2_fecha']),
      b2_aprobados_1a: parseInteger(mapped['b2_aprobados_1a']),
      b2_pct_aprobados: parseNumber(mapped['b2_pct_aprobados']),
      estado_iqz: parseInteger(mapped['estado_iqz']),
      estado_berlin: parseInteger(mapped['estado_berlin']),
      estado_standby: parseInteger(mapped['estado_standby']),
      estado_to_place: parseInteger(mapped['estado_to_place_col']),
      estado_assigned: parseInteger(mapped['estado_assigned']),
      estado_hired: parseInteger(mapped['estado_hired']),
      estado_fuera_red: parseInteger(mapped['estado_fuera_red']),
      estado_offer_withdrawn: parseInteger(mapped['estado_offer_withdrawn']),
      sheet_id: sheetId,
      synced_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin
      .from('germany_exams_kpi' as any)
      .upsert(payload, { onConflict: 'promo_numero,sheet_id' })

    if (upsertError) {
      result.errors.push(`Row ${rowNum} (promo ${rawPromo}): ${upsertError.message}`)
    } else {
      result.upserted++
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Pagos importer
// ---------------------------------------------------------------------------

// IMPORTANT: más específico va ANTES — buildHeaderMap itera en orden de inserción y
// en pass-2 (substring) gana el primero que matchea. 'comentarios' antes que 'coordinador'
// evita que "Comentarios de coordinadores" se mapee a coordinador por substring collision.
const PAGOS_COLUMN_MAP: Record<string, string[]> = {
  nombre: ['nombre y apellidos', 'nombre completo', 'nombre'],
  zoho_candidate_id: ['id', 'zoho id', 'zoho candidate id'],
  promo_numero: ['no promocion', 'no promo', 'num promo', 'nº promocion', 'nº promo', 'promocion', 'promoción'],
  profesion: ['profesion', 'profesión'],
  empresa: ['empresa'],
  estado: ['estado'],
  modalidad: ['modalidad'],
  // comentarios antes que coordinador para evitar substring collision
  comentarios_coordinadores: ['comentarios de coordinadores', 'comentarios coordinadores', 'comentarios de coord', 'comentarios coord'],
  comentarios_contabilidad: ['comentarios de contabilidad', 'comentarios contabilidad'],
  coordinador: ['coordinador/a', 'coordinadora', 'coordinador'],
  // 'fecha del inicio de la formacion' debe ir antes de 'fecha inicio de pago' para evitar que
  // 'Fecha inicio de pago del alumno' match-ee 'fecha inicio' → fecha_inicio_formacion
  fecha_inicio_formacion: ['fecha del inicio de la formacion', 'inicio de la formacion', 'fecha inicio formacion', 'fecha inicio de formacion'],
  fecha_abandono_formacion: ['fecha de abandono', 'fecha abandono', 'abandono formacion'],
  fecha_inicio_contrato: ['inicio contrato laborar', 'fecha de inicio contrato', 'fecha inicio contrato', 'contrato laborar'],
  opcion_financiacion: ['opcion de financiacion', 'opcion financiacion', 'opción de financiación', 'financiacion'],
  fecha_inicio_pago: ['de pago del alumno', 'fecha inicio de pago', 'inicio pago del alumno', 'fecha inicio pago', 'inicio pago'],
  importe_formacion: ['importe de formacion', 'importe formacion'],
  importe_piso_gw: ['importe piso gw', 'piso gw'],
  importe_total: ['importe total'],
  importe_pendiente: ['importe pendiente de pago', 'importe pendiente', 'pendiente de pago'],
  enviar_abogado: ['enviar abogado'],
  correo: ['email', 'correo', 'e-mail'],
}

export interface GermanyPagosResult {
  upserted: number
  skipped: number
  errors: string[]
}

/**
 * Detect "Cuota N" columns in headers and group them into a JSONB array.
 * Each cuota entry: { numero, importe, fecha, pagado }
 *
 * We look for headers matching patterns like:
 *   "Cuota 1", "Cuota 2", "Cuota 1 Importe", "Cuota 1 Fecha", "Cuota 1 Pagado"
 *
 * Simple strategy: group headers that start with "cuota " into buckets by number.
 */
interface CuotaEntry {
  numero: number
  importe: number | null
  fecha: string | null
  pagado: string | null
}

function extractCuotas(row: ServiceSheetRow, cuotaHeaders: Map<number, Record<string, string>>): CuotaEntry[] {
  const cuotas: CuotaEntry[] = []
  for (const [num, fields] of cuotaHeaders) {
    const cuota: CuotaEntry = {
      numero: num,
      importe: parseNumber(fields['importe'] ? row[fields['importe']] : null),
      fecha: parseDate(fields['fecha'] ? row[fields['fecha']] : null),
      pagado: fields['pagado'] ? (row[fields['pagado']] ?? null) : null,
    }
    // Only include if there's at least some data
    if (cuota.importe !== null || cuota.fecha !== null || cuota.pagado !== null) {
      cuotas.push(cuota)
    }
  }
  return cuotas.sort((a, b) => a.numero - b.numero)
}

/**
 * Parse cuota column headers from the full header list.
 *
 * Returns:
 *   - cuotaHeaders: Map<cuotaNum, { importe?: headerName, fecha?: headerName, pagado?: headerName }>
 *     where headerName is the ORIGINAL (raw) header
 *   - cuotaSimple: Map<cuotaNum, headerName> for plain "Cuota N" columns (no sub-field)
 */
function parseCuotaHeaders(headers: string[]): {
  cuotaHeaders: Map<number, Record<string, string>>
  cuotaSimpleHeaders: Map<number, string>
} {
  const cuotaHeaders = new Map<number, Record<string, string>>()
  const cuotaSimpleHeaders = new Map<number, string>()

  for (const h of headers) {
    const normalized = normalizeHeader(h)
    // Match: "cuota 1", "cuota 2", etc.
    const simpleMatch = normalized.match(/^cuota\s+(\d+)$/)
    if (simpleMatch) {
      const num = parseInt(simpleMatch[1]!, 10)
      cuotaSimpleHeaders.set(num, h)
      continue
    }
    // Match: "cuota 1 importe", "cuota 1 fecha", "cuota 1 pagado"
    const detailMatch = normalized.match(/^cuota\s+(\d+)\s+(importe|fecha|pagado)/)
    if (detailMatch) {
      const num = parseInt(detailMatch[1]!, 10)
      const field = detailMatch[2]!
      if (!cuotaHeaders.has(num)) cuotaHeaders.set(num, {})
      cuotaHeaders.get(num)![field] = h
    }
  }

  return { cuotaHeaders, cuotaSimpleHeaders }
}

/**
 * Import "Pagos - Proyectos Infantil" tab from the Germany Excel madre sheet.
 *
 * Upserts into germany_payments_kpi with conflict on (nombre, promo_numero, sheet_id).
 * Cuota columns are grouped into JSONB array.
 */
export async function importGermanyPagos(sheetId: string): Promise<GermanyPagosResult> {
  const result: GermanyPagosResult = { upserted: 0, skipped: 0, errors: [] }

  let rows: ServiceSheetRow[]
  try {
    rows = await readSheetByName(sheetId, 'Pagos - Proyectos Infantil')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Failed to read Pagos - Proyectos Infantil tab: ${msg}`)
    return result
  }

  if (rows.length === 0) {
    result.errors.push('Pagos - Proyectos Infantil tab returned no data')
    return result
  }

  const headers = Object.keys(rows[0]!)
  const headerMap = buildHeaderMap(headers, PAGOS_COLUMN_MAP)
  const { cuotaHeaders, cuotaSimpleHeaders } = parseCuotaHeaders(headers)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    const mapped = extractMapped(row, headerMap)

    const nombre = mapped['nombre']
    if (!nombre) {
      result.skipped++
      continue
    }

    const promoNumero = parseInteger(mapped['promo_numero'])

    // Build cuotas JSONB
    let cuotas: CuotaEntry[] = []
    if (cuotaHeaders.size > 0) {
      cuotas = extractCuotas(row, cuotaHeaders)
    } else if (cuotaSimpleHeaders.size > 0) {
      // Plain "Cuota N" columns — treat as importe only
      for (const [num, rawHeader] of cuotaSimpleHeaders) {
        const val = row[rawHeader]?.trim()
        const importe = parseNumber(val)
        if (importe !== null) {
          cuotas.push({ numero: num, importe, fecha: null, pagado: null })
        }
      }
      cuotas.sort((a, b) => a.numero - b.numero)
    }

    const payload = {
      nombre,
      zoho_candidate_id: mapped['zoho_candidate_id'] ?? null,
      promo_numero: promoNumero,
      profesion: mapped['profesion'] ?? null,
      empresa: mapped['empresa'] ?? null,
      estado: mapped['estado'] ?? null,
      modalidad: mapped['modalidad'] ?? null,
      coordinador: mapped['coordinador'] ?? null,
      fecha_inicio_formacion: parseDate(mapped['fecha_inicio_formacion']),
      fecha_abandono_formacion: parseDate(mapped['fecha_abandono_formacion']),
      fecha_inicio_contrato: parseDate(mapped['fecha_inicio_contrato']),
      opcion_financiacion: mapped['opcion_financiacion'] ?? null,
      fecha_inicio_pago: parseDate(mapped['fecha_inicio_pago']),
      importe_formacion: parseNumber(mapped['importe_formacion']),
      importe_piso_gw: parseNumber(mapped['importe_piso_gw']),
      importe_total: parseNumber(mapped['importe_total']),
      cuotas: cuotas.length > 0 ? cuotas : null,
      importe_pendiente: parseNumber(mapped['importe_pendiente']),
      enviar_abogado: mapped['enviar_abogado'] ?? null,
      comentarios_coordinadores: mapped['comentarios_coordinadores'] ?? null,
      comentarios_contabilidad: mapped['comentarios_contabilidad'] ?? null,
      correo: mapped['correo'] ?? null,
      sheet_id: sheetId,
      synced_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin
      .from('germany_payments_kpi' as any)
      .upsert(payload, { onConflict: 'nombre,promo_numero,sheet_id' })

    if (upsertError) {
      result.errors.push(`Row ${rowNum} (${nombre}): ${upsertError.message}`)
    } else {
      result.upserted++
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface GermanyExcelMadreResult {
  baseDatos: GermanyBaseDatosResult
  examenes: GermanyExamenesResult
  pagos: GermanyPagosResult
  errors: string[]
}

/**
 * Orchestrates all three Germany imports in parallel.
 *
 * Pipeline:
 *   - Base Datos — candidate enrichment data
 *   - Exámenes — exam results per promo
 *   - Pagos - Proyectos Infantil — payment tracking
 *
 * All three run concurrently via Promise.all.
 */
export async function importGermanyExcelMadre(sheetId: string): Promise<GermanyExcelMadreResult> {
  const errors: string[] = []

  const [baseDatosRaw, examenesRaw, pagosRaw] = await Promise.allSettled([
    importGermanyBaseDatos(sheetId),
    importGermanyExamenes(sheetId),
    importGermanyPagos(sheetId),
  ])

  const baseDatos: GermanyBaseDatosResult =
    baseDatosRaw.status === 'fulfilled'
      ? baseDatosRaw.value
      : { upserted: 0, skipped: 0, errors: [`Fatal: ${String((baseDatosRaw as PromiseRejectedResult).reason)}`] }

  const examenes: GermanyExamenesResult =
    examenesRaw.status === 'fulfilled'
      ? examenesRaw.value
      : { upserted: 0, skipped: 0, errors: [`Fatal: ${String((examenesRaw as PromiseRejectedResult).reason)}`] }

  const pagos: GermanyPagosResult =
    pagosRaw.status === 'fulfilled'
      ? pagosRaw.value
      : { upserted: 0, skipped: 0, errors: [`Fatal: ${String((pagosRaw as PromiseRejectedResult).reason)}`] }

  if (baseDatos.errors.length > 0) errors.push(...baseDatos.errors.map((e) => `[BaseDatos] ${e}`))
  if (examenes.errors.length > 0) errors.push(...examenes.errors.map((e) => `[Examenes] ${e}`))
  if (pagos.errors.length > 0) errors.push(...pagos.errors.map((e) => `[Pagos] ${e}`))

  return { baseDatos, examenes, pagos, errors }
}
