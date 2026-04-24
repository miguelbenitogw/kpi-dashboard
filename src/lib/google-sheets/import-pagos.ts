/**
 * Pagos - Proyectos tab import pipeline.
 *
 * Imports the "Pagos - Proyectos 2025/2026" tab (gid=1007684536) from Excel madre.
 * This tab contains billing/payment data for candidates who dropped out or were expelled.
 *
 * Matching strategy: by full_name + promocion_nombre (no candidate ID column in this tab).
 * Upserts into pagos_candidato using candidate_id as the conflict key.
 *
 * The tab has three sets of "Promoción anterior" columns (indices 17-19, 20-22, 23-25)
 * which are packed into a single JSONB array: promociones_anteriores.
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { readSheetAsRows } from './client'

// ---------------------------------------------------------------------------
// Sheet constants
// ---------------------------------------------------------------------------

export const PAGOS_GID = '1007684536'

// ---------------------------------------------------------------------------
// Column mapping
// Actual headers (row 1) from the Pagos - Proyectos tab:
//   [0]  NOMBRE Y APELLIDOS
//   [1]  Email
//   [2]  Teléfono
//   [3]  Perfil
//   [4]  Nº Promoción
//   [5]  Coordinador/a
//   [6]  Modalidad
//   [7]  Estado
//   [8]  Fecha de viaje a Noruega (en caso de haber viajado)
//   [9]  Fecha de inicio formación
//   [10] Fecha del abandono o expulsión de formación
//   [11] Fecha de respuesta al mail de expulsión o abandono
//   [12] Fase en la que abandona
//   [13] Condiciones de la fase en la que abandona o es expulsado
//   [14] Precio/hora (€/h)
//   [15] Horas cursadas
//   [16] Precio total (€)
//   [17] Promoción anterior cursada  (1st)
//   [18] Anexo firmado               (1st)
//   [19] Precio de esa formación     (1st)
//   [20] Promoción anterior cursada  (2nd)
//   [21] Anexo firmado               (2nd)
//   [22] Precio de esa formación     (2nd)
//   [23] Promoción anterior cursada  (3rd)
//   [24] Anexo firmado               (3rd)
//   [25] Precio de esa formación     (3rd)
//   [26] Autorización tramitada
//   [27] Precio de autorización (si se ha pagado)
//   [28] Importe por formación actual
//   [29] Importe por formaciones previas
//   [30] Importe Piso GW
//   [31] Importe Devolución Ayuda Estudio
//   [32] Autorización (si se ha pagado y no debe el total)
//   [33] Importe total
//   [34] Fecha cobro
//   [35] Importe pagado 2024
//   [36] Importe pagado 2025
//   [37] Importe pagado 2026
//   [38] Importe pendiente de pago
//   [39] Condiciones de pago según contrato/Modo de devolución
//   [40] Fecha de notificación de la cantidad pendiente de abono
//   [41] Comentarios coordinadores...
//   [42] Comentarios contabilidad
// ---------------------------------------------------------------------------

const PAGOS_COLUMN_MAP: Record<string, string[]> = {
  full_name:             ['nombre y apellidos', 'nombre', 'name'],
  email:                 ['email'],
  telefono:              ['teléfono', 'telefono', 'phone', 'tel'],
  perfil:                ['perfil', 'profile'],
  promocion_nombre:      ['nº promoción', 'nº promocion', 'n° promoción', 'n° promocion', 'promocion', 'promo'],
  coordinador:           ['coordinador/a', 'coordinador', 'coordinadora'],
  modalidad:             ['modalidad', 'modality'],
  estado:                ['estado', 'status'],
  fecha_viaje_noruega:   ['fecha de viaje a noruega', 'fecha viaje noruega', 'fecha viaje'],
  fecha_inicio_formacion:['fecha de inicio formación', 'fecha de inicio formacion', 'fecha inicio formación', 'fecha inicio formacion'],
  fecha_abandono:        ['fecha del abandono o expulsión', 'fecha del abandono o expulsion', 'fecha abandono', 'fecha expulsion'],
  fecha_respuesta_mail:  ['fecha de respuesta al mail', 'fecha respuesta mail', 'fecha respuesta'],
  fase_abandono:         ['fase en la que abandona', 'fase abandona', 'fase'],
  condiciones_fase:      ['condiciones de la fase', 'condiciones fase'],
  precio_hora:           ['precio/hora', 'precio hora', 'precio/hora (€/h)'],
  horas_cursadas:        ['horas cursadas', 'horas'],
  precio_total:          ['precio total', 'precio total (€)'],
  // Billing columns (migration 014)
  autorizacion_tramitada:      ['autorización tramitada', 'autorizacion tramitada'],
  precio_autorizacion:         ['precio de autorización', 'precio de autorizacion', 'precio autorizacion'],
  importe_formacion_actual:    ['importe por formación actual', 'importe por formacion actual', 'importe formación actual'],
  importe_formaciones_previas: ['importe por formaciones previas', 'importe formaciones previas'],
  importe_piso_gw:             ['importe piso gw'],
  importe_devolucion_ayuda:    ['importe devolución ayuda estudio', 'importe devolucion ayuda estudio', 'importe devolución ayuda', 'importe devolucion ayuda'],
  importe_autorizacion:        ['autorización (si se ha pagado y no debe el total)', 'autorizacion (si se ha pagado', 'importe autorizacion'],
  importe_total:               ['importe total'],
  fecha_cobro:                 ['fecha cobro'],
  importe_pagado_2024:         ['importe pagado 2024'],
  importe_pagado_2025:         ['importe pagado 2025'],
  importe_pagado_2026:         ['importe pagado 2026'],
  importe_pendiente:           ['importe pendiente de pago', 'importe pendiente'],
  condiciones_pago:            ['condiciones de pago', 'condiciones pago', 'modo de devolución', 'modo de devolucion'],
  fecha_notificacion:          ['fecha de notificación', 'fecha de notificacion', 'fecha notificacion'],
  comentarios_coordinadores:   ['comentarios coordinadores', 'comentarios coord'],
  comentarios_contabilidad:    ['comentarios contabilidad', 'contabilidad'],
}

// Suffixes for the three "Promoción anterior" column groups
// The sheet repeats these three headers three times (cols 17-19, 20-22, 23-25)
const PROMO_ANTERIOR_HEADERS = [
  'promoción anterior cursada',
  'promocion anterior cursada',
  'promoción anterior',
  'promocion anterior',
]
const ANEXO_FIRMADO_HEADERS = ['anexo firmado']
const PRECIO_FORMACION_HEADERS = ['precio de esa formación', 'precio de esa formacion', 'precio esa formacion']

function mapPagosHeader(header: string): string | null {
  const lower = header.toLowerCase().trim()
  // Exact match first
  for (const [canonical, variants] of Object.entries(PAGOS_COLUMN_MAP)) {
    if (variants.some((v) => lower === v)) {
      return canonical
    }
  }
  // Substring match (min 5 chars)
  for (const [canonical, variants] of Object.entries(PAGOS_COLUMN_MAP)) {
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

/** Strip currency symbols, spaces and normalise comma decimals → float string */
function parseEuro(value: string): number | null {
  if (!value || !value.trim()) return null
  const cleaned = value
    .trim()
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')   // thousands separator
    .replace(',', '.')    // decimal separator
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

function parseBool(value: string): boolean {
  return ['true', 'yes', 'si', 'sí', '1'].includes((value ?? '').toLowerCase().trim())
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Derive a promotion nombre string from the raw "Nº Promoción" column value.
 *  The column contains just "113" — we normalise to "Promoción 113".
 */
function normalizePromoNombre(raw: string): string {
  const trimmed = raw.trim()
  // Already looks like "Promoción 113" or "Promo 113"
  if (/[a-zA-Z]/i.test(trimmed)) return trimmed
  // Bare number: "113" → "Promoción 113"
  return `Promoción ${trimmed}`
}

// ---------------------------------------------------------------------------
// Export result interface
// ---------------------------------------------------------------------------

export interface PagosResult {
  updated: number
  inserted: number
  skipped: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Import the "Pagos - Proyectos" tab from the Excel madre sheet.
 *
 * Matching: by (full_name, promocion_nombre) pair against candidates.
 * Upserts into pagos_candidato using candidate_id.
 *
 * The three repeated "Promoción anterior / Anexo firmado / Precio" column groups
 * are packed into a JSONB array: promociones_anteriores = [{promo, anexo_firmado, precio}].
 */
export async function importPagos(sheetId: string): Promise<PagosResult> {
  const result: PagosResult = {
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  const { headers, rows } = await readSheetAsRows(sheetId, parseInt(PAGOS_GID, 10))

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('Pagos tab returned no data')
    return result
  }

  // -------------------------------------------------------------------------
  // Build header mapping — handle duplicate "Promoción anterior" columns
  // We track them as promo_ant_0, promo_ant_1, promo_ant_2 etc. by occurrence
  // -------------------------------------------------------------------------
  const headerMap = new Map<string, string>()   // raw header string → canonical
  const promoAntOccurrences: number[] = []      // indices of "Promoción anterior" columns
  const anexoOccurrences: number[] = []
  const precioAntOccurrences: number[] = []

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!
    const lower = h.toLowerCase().trim()

    if (PROMO_ANTERIOR_HEADERS.some((v) => lower === v || lower.includes(v))) {
      promoAntOccurrences.push(i)
      continue
    }
    if (ANEXO_FIRMADO_HEADERS.some((v) => lower === v || lower.includes(v))) {
      anexoOccurrences.push(i)
      continue
    }
    if (PRECIO_FORMACION_HEADERS.some((v) => lower === v || lower.includes(v))) {
      precioAntOccurrences.push(i)
      continue
    }

    const canonical = mapPagosHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  // Build a name+promo → candidate_id lookup
  const { data: allCandidates, error: candError } = await supabaseAdmin
    .from('candidates_kpi')
    .select('id, full_name, promocion_nombre')
    .not('full_name', 'is', null)

  if (candError) {
    result.errors.push(`Failed to fetch candidates for matching: ${candError.message}`)
    return result
  }

  // Index by normalizedName|promoNombre for precise matching
  const namePromoToId = new Map<string, string>()
  // Also index by name alone as fallback
  const nameToIds = new Map<string, string[]>()

  for (const c of allCandidates ?? []) {
    if (!c.full_name) continue
    const normName = normalizeName(c.full_name)
    const promoKey = c.promocion_nombre
      ? `${normName}|${c.promocion_nombre}`
      : null
    if (promoKey) namePromoToId.set(promoKey, c.id)
    const existing = nameToIds.get(normName) ?? []
    existing.push(c.id)
    nameToIds.set(normName, existing)
  }

  // -------------------------------------------------------------------------
  // Process rows
  // -------------------------------------------------------------------------
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    // Extract mapped values
    const mapped: Record<string, string> = {}
    for (const [rawHeader, canonical] of headerMap) {
      const value = row[rawHeader]?.trim()
      if (value) mapped[canonical] = value
    }

    const rawName = mapped['full_name']
    if (!rawName) {
      result.skipped++
      continue
    }

    // Skip obvious summary/header rows
    const lowerName = rawName.toLowerCase()
    if (
      lowerName.includes('total') ||
      lowerName.includes('resumen') ||
      lowerName === 'nombre y apellidos' ||
      lowerName === 'nombre'
    ) {
      result.skipped++
      continue
    }

    // Resolve promo name
    const rawPromo = mapped['promocion_nombre']
    const promoNombre = rawPromo ? normalizePromoNombre(rawPromo) : null

    // Match candidate by name + promo
    const normName = normalizeName(rawName)
    let candidateId: string | null = null

    if (promoNombre) {
      candidateId = namePromoToId.get(`${normName}|${promoNombre}`) ?? null
    }
    // Fallback: match by name alone (pick first if unique)
    if (!candidateId) {
      const ids = nameToIds.get(normName)
      if (ids && ids.length === 1) {
        candidateId = ids[0]!
      }
    }

    // Build promociones_anteriores JSONB from duplicate column groups
    // promoAntOccurrences[n], anexoOccurrences[n], precioAntOccurrences[n]
    const promoAnterioresArr: { promo: string | null; anexo_firmado: boolean; precio: number | null }[] = []
    const maxGroups = Math.max(
      promoAntOccurrences.length,
      anexoOccurrences.length,
      precioAntOccurrences.length
    )
    for (let g = 0; g < maxGroups; g++) {
      const promoHeader = promoAntOccurrences[g] !== undefined
        ? headers[promoAntOccurrences[g]!]
        : null
      const anexoHeader = anexoOccurrences[g] !== undefined
        ? headers[anexoOccurrences[g]!]
        : null
      const precioHeader = precioAntOccurrences[g] !== undefined
        ? headers[precioAntOccurrences[g]!]
        : null

      const promoVal = promoHeader ? (row[promoHeader] ?? '').trim() : ''
      const anexoVal = anexoHeader ? (row[anexoHeader] ?? '').trim() : ''
      const precioVal = precioHeader ? (row[precioHeader] ?? '').trim() : ''

      // Only include groups where at least one field is non-empty
      if (promoVal || precioVal) {
        promoAnterioresArr.push({
          promo: promoVal || null,
          anexo_firmado: parseBool(anexoVal),
          precio: parseEuro(precioVal),
        })
      }
    }

    // Build upsert payload
    const payload: Record<string, unknown> = {
      full_name: rawName,
      candidate_id: candidateId,
      promocion_nombre: promoNombre,
      email: mapped['email'] ?? null,
      telefono: mapped['telefono'] ?? null,
      perfil: mapped['perfil'] ?? null,
      coordinador: mapped['coordinador'] ?? null,
      modalidad: mapped['modalidad'] ?? null,
      estado: mapped['estado'] ?? null,
      fecha_viaje_noruega:    parseDate(mapped['fecha_viaje_noruega'] ?? ''),
      fecha_inicio_formacion: parseDate(mapped['fecha_inicio_formacion'] ?? ''),
      fecha_abandono:         parseDate(mapped['fecha_abandono'] ?? ''),
      fecha_respuesta_mail:   parseDate(mapped['fecha_respuesta_mail'] ?? ''),
      fase_abandono:    mapped['fase_abandono'] ?? null,
      condiciones_fase: mapped['condiciones_fase'] ?? null,
      precio_hora:      parseEuro(mapped['precio_hora'] ?? ''),
      horas_cursadas:   parseEuro(mapped['horas_cursadas'] ?? ''),
      precio_total:     parseEuro(mapped['precio_total'] ?? ''),
      // Fields from migration 010 (already existed)
      promocion_anterior: null, // superseded by promociones_anteriores JSONB
      anexo_firmado: promoAnterioresArr.length > 0 ? promoAnterioresArr[0]?.anexo_firmado ?? null : null,
      precio_formacion: promoAnterioresArr.length > 0 ? promoAnterioresArr[0]?.precio ?? null : null,
      // New billing fields (migration 014)
      autorizacion_tramitada:      mapped['autorizacion_tramitada']
        ? parseBool(mapped['autorizacion_tramitada'])
        : null,
      precio_autorizacion:         parseEuro(mapped['precio_autorizacion'] ?? ''),
      importe_formacion_actual:    parseEuro(mapped['importe_formacion_actual'] ?? ''),
      importe_formaciones_previas: parseEuro(mapped['importe_formaciones_previas'] ?? ''),
      importe_piso_gw:             parseEuro(mapped['importe_piso_gw'] ?? ''),
      importe_devolucion_ayuda:    parseEuro(mapped['importe_devolucion_ayuda'] ?? ''),
      importe_autorizacion:        parseEuro(mapped['importe_autorizacion'] ?? ''),
      importe_total:               parseEuro(mapped['importe_total'] ?? ''),
      fecha_cobro:                 parseDate(mapped['fecha_cobro'] ?? ''),
      importe_pagado_2024:         parseEuro(mapped['importe_pagado_2024'] ?? ''),
      importe_pagado_2025:         parseEuro(mapped['importe_pagado_2025'] ?? ''),
      importe_pagado_2026:         parseEuro(mapped['importe_pagado_2026'] ?? ''),
      importe_pendiente:           parseEuro(mapped['importe_pendiente'] ?? ''),
      condiciones_pago:            mapped['condiciones_pago'] ?? null,
      fecha_notificacion:          parseDate(mapped['fecha_notificacion'] ?? ''),
      comentarios_coordinadores:   mapped['comentarios_coordinadores'] ?? null,
      comentarios_contabilidad:    mapped['comentarios_contabilidad'] ?? null,
      promociones_anteriores:      promoAnterioresArr.length > 0
        ? promoAnterioresArr
        : null,
      updated_at: new Date().toISOString(),
    }

    // Check if a record already exists for this candidate
    // Note: (supabaseAdmin as any) cast because pagos_candidato is added in migration 014
    // and the generated types haven't been regenerated yet.
    if (candidateId) {
      const { data: existing, error: selectError } = await (supabaseAdmin as any)
        .from('pagos_candidato_kpi')
        .select('id')
        .eq('candidate_id', candidateId)
        .maybeSingle()

      if (selectError) {
        result.errors.push(
          `Row ${rowNum} (${rawName}): select error: ${selectError.message}`
        )
        continue
      }

      if (existing) {
        const { error: updateError } = await (supabaseAdmin as any)
          .from('pagos_candidato_kpi')
          .update(payload)
          .eq('id', existing.id)

        if (updateError) {
          result.errors.push(
            `Row ${rowNum} (${rawName}): update error: ${updateError.message}`
          )
        } else {
          result.updated++
        }
        continue
      }
    }

    // Insert new record
    const { error: insertError } = await (supabaseAdmin as any)
      .from('pagos_candidato_kpi')
      .insert(payload)

    if (insertError) {
      result.errors.push(
        `Row ${rowNum} (${rawName}): insert error: ${insertError.message}`
      )
    } else {
      result.inserted++
    }
  }

  return result
}
