/**
 * Excel madre import pipeline.
 *
 * Fetches data from the "Excel madre" Google Sheet and syncs it into Supabase.
 * Two tabs are imported:
 *   - Base Datos: individual candidate enrichment data
 *   - Resumen: promo-level aggregate targets
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { buildCsvUrl, parseCSV, type SheetRow } from './client'
import { importGlobalPlacement, type GlobalPlacementResult } from './import-global-placement'
import {
  extractPromoNumber,
  syncPromotionsFromCandidates,
  type SyncPromotionCountsResult,
} from '@/lib/queries/promotions-core'

// ---------------------------------------------------------------------------
// Sheet constants
// ---------------------------------------------------------------------------

export const MADRE_SHEET_ID = '1XLawLxIbwfBOHwEejR1ksOl0v2gyolHtuqLs0aF1Ujo'
export const BASE_DATOS_GID = '1510708848'
export const RESUMEN_GID = '562297340'

// ---------------------------------------------------------------------------
// CSV fetching (public sheet, no auth)
// ---------------------------------------------------------------------------

async function fetchMadreCSV(gid: string): Promise<string> {
  const url = buildCsvUrl(MADRE_SHEET_ID, gid)

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/csv,text/plain,*/*' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Excel madre tab (gid=${gid}): HTTP ${response.status}`
    )
  }

  return response.text()
}

// ---------------------------------------------------------------------------
// Date parsing helper
// ---------------------------------------------------------------------------

function parseDate(value: string): string | null {
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

// ---------------------------------------------------------------------------
// Numeric parsing helper
// ---------------------------------------------------------------------------

function parseNumber(value: string): number | null {
  if (!value || !value.trim()) return null
  // Remove % signs, spaces, and handle comma decimals
  const cleaned = value.trim().replace(/%/g, '').replace(/\s/g, '').replace(',', '.')
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

// ---------------------------------------------------------------------------
// Base Datos import
// ---------------------------------------------------------------------------

/**
 * Column mapping for the Base Datos tab.
 * Maps lowercase header variants to our canonical field names.
 */
const BASE_DATOS_COLUMN_MAP: Record<string, string[]> = {
  id: ['id'],
  promocion_nombre: ['promocion', 'promoción'],
  coordinador: ['coordinador', 'coordinadora'],
  full_name: ['nombre y apellidos', 'nombre completo', 'nombre'],
  estado: ['estado'],
  fecha_fin_formacion: ['fecha fin de formacion', 'fecha fin de formación', 'fecha fin formacion'],
  fecha_inicio_trabajo: ['fecha inicio de trabajo en noruega', 'fecha inicio trabajo', 'fecha inicio de trabajo'],
  tiempo_colocacion: ['tiempo de colocacion', 'tiempo de colocación', 'tiempo colocacion'],
  tipo_perfil: ['tipo de perfil', 'tipo perfil'],
  quincena: ['quincena'],
  mes_ano_llegada: ['mes y ano de llegada', 'mes y año de llegada', 'mes año llegada'],
  cliente: ['cliente'],
  notas_excel: ['notas'],
}

function mapBaseDatosHeader(header: string): string | null {
  const lower = header.toLowerCase().trim()
  // First pass: exact match only (avoids false positives like "apellidos" matching "id")
  for (const [canonical, variants] of Object.entries(BASE_DATOS_COLUMN_MAP)) {
    if (variants.some((v) => lower === v)) {
      return canonical
    }
  }
  // Second pass: substring match for longer variants only (min 4 chars to avoid "id" in "apellidos")
  for (const [canonical, variants] of Object.entries(BASE_DATOS_COLUMN_MAP)) {
    if (variants.some((v) => v.length >= 4 && lower.includes(v))) {
      return canonical
    }
  }
  return null
}

export interface BaseDatosResult {
  updated: number
  inserted: number
  skipped: number
  errors: string[]
}

/**
 * Import the Base Datos tab from the Excel madre sheet.
 *
 * For each row:
 *   - Match to existing candidates by the "ID" column (= zoho_candidate_id = candidates.id)
 *   - UPDATE matched candidates with enrichment data
 *   - If no match: INSERT a new candidate with the Excel data
 */
export async function importBaseDatos(): Promise<BaseDatosResult> {
  const result: BaseDatosResult = {
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  const csv = await fetchMadreCSV(BASE_DATOS_GID)
  const { headers, rows } = parseCSV(csv)

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('Base Datos tab returned no data')
    return result
  }

  // Build header mapping once
  const headerMap = new Map<string, string>()
  for (const h of headers) {
    const canonical = mapBaseDatosHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2 // 1-indexed, header is row 1

    // Extract mapped values
    const mapped: Record<string, string> = {}
    for (const [rawHeader, canonical] of headerMap) {
      const value = row[rawHeader]?.trim()
      if (value) mapped[canonical] = value
    }

    const candidateId = mapped['id']
    if (!candidateId) {
      result.skipped++
      continue
    }

    // Build the update payload — include full_name and current_status from Excel
    const fullName = mapped['full_name'] ?? null
    const estado = mapped['estado'] ?? null

    const updateData: Record<string, unknown> = {
      coordinador: mapped['coordinador'] ?? null,
      tipo_perfil: mapped['tipo_perfil'] ?? null,
      cliente: mapped['cliente'] ?? null,
      fecha_fin_formacion: parseDate(mapped['fecha_fin_formacion'] ?? ''),
      fecha_inicio_trabajo: parseDate(mapped['fecha_inicio_trabajo'] ?? ''),
      tiempo_colocacion: mapped['tiempo_colocacion'] ?? null,
      notas_excel: mapped['notas_excel'] ?? null,
      promocion_nombre: mapped['promocion_nombre'] ?? null,
    }
    // Always set name and status from Excel if available
    if (fullName) updateData.full_name = fullName
    if (estado) updateData.current_status = estado

    // Try UPDATE first (candidate already exists from Zoho sync)
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('id', candidateId)
      .maybeSingle()

    if (selectError) {
      result.errors.push(`Row ${rowNum}: select error for ${candidateId}: ${selectError.message}`)
      continue
    }

    if (existing) {
      // UPDATE existing candidate
      const { error: updateError } = await supabaseAdmin
        .from('candidates')
        .update(updateData as any)
        .eq('id', candidateId)

      if (updateError) {
        result.errors.push(`Row ${rowNum}: update error for ${candidateId}: ${updateError.message}`)
      } else {
        result.updated++
      }
    } else {
      // INSERT new candidate with Excel data
      const fullName = mapped['full_name'] ?? null
      const estado = mapped['estado'] ?? null

      const { error: insertError } = await supabaseAdmin
        .from('candidates')
        .insert({
          id: candidateId,
          full_name: fullName,
          current_status: estado,
          ...updateData,
        })

      if (insertError) {
        result.errors.push(`Row ${rowNum}: insert error for ${candidateId}: ${insertError.message}`)
      } else {
        result.inserted++
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Resumen import
// ---------------------------------------------------------------------------

/**
 * Column mapping for the Resumen tab.
 */
const RESUMEN_COLUMN_MAP: Record<string, string[]> = {
  promocion: ['promocion', 'promoción'],
  modalidad: ['modalidad'],
  pais: ['pais', 'país'],
  coordinador: ['coord.', 'coord', 'coordinador', 'coordinadora'],
  cliente: ['cliente'],
  fecha_inicio: ['fecha inicio', 'fecha de inicio', 'inicio'],
  fecha_fin: ['fecha fin', 'fecha de fin', 'fin'],
  objetivo_atraccion: ['objetivo atraccion', 'objetivo atracción', 'obj. atraccion', 'obj. atracción'],
  total_aceptados: ['total aceptados', 'aceptados'],
  pct_consecucion_atraccion: ['% consecucion atraccion', '% consecución atracción', 'consecucion atraccion', 'consecución atracción'],
  objetivo_programa: ['objetivo programa', 'obj. programa'],
  total_programa: ['total programa'],
  pct_consecucion_programa: ['% consecucion programa', '% consecución programa', 'consecucion programa', 'consecución programa'],
  expectativa_finalizan: ['expectativa finalizan', 'exp. finalizan'],
  pct_exito_estimado: ['% exito estimado', '% éxito estimado', 'exito estimado', 'éxito estimado'],
  contratos_firmados: ['contratos firmados', 'contratos'],
}

function mapResumenHeader(header: string): string | null {
  const lower = header.toLowerCase().trim()
  for (const [canonical, variants] of Object.entries(RESUMEN_COLUMN_MAP)) {
    if (variants.some((v) => lower === v || lower.includes(v))) {
      return canonical
    }
  }
  return null
}

export interface ResumenResult {
  upserted: number
  skipped: number
  errors: string[]
}

/**
 * Import the Resumen tab from the Excel madre sheet.
 * Upserts promo-level aggregate data into the promo_targets table.
 *
 * Skips rows without a "Promocion" value (totals/summary rows).
 */
export async function importResumen(): Promise<ResumenResult> {
  const result: ResumenResult = {
    upserted: 0,
    skipped: 0,
    errors: [],
  }

  const csv = await fetchMadreCSV(RESUMEN_GID)
  const { headers, rows } = parseCSV(csv)

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('Resumen tab returned no data')
    return result
  }

  // Build header mapping
  const headerMap = new Map<string, string>()
  for (const h of headers) {
    const canonical = mapResumenHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    // Extract mapped values
    const mapped: Record<string, string> = {}
    for (const [rawHeader, canonical] of headerMap) {
      const value = row[rawHeader]?.trim()
      if (value) mapped[canonical] = value
    }

    const promocion = mapped['promocion']
    if (!promocion) {
      // Skip totals/summary rows that have no Promocion value
      result.skipped++
      continue
    }

    // Skip obvious summary rows
    const lowerPromo = promocion.toLowerCase()
    if (lowerPromo.includes('total') || lowerPromo.includes('resumen') || lowerPromo.includes('promedio')) {
      result.skipped++
      continue
    }

    const upsertPayload = {
      promocion,
      modalidad: mapped['modalidad'] ?? null,
      pais: mapped['pais'] ?? null,
      coordinador: mapped['coordinador'] ?? null,
      cliente: mapped['cliente'] ?? null,
      fecha_inicio: parseDate(mapped['fecha_inicio'] ?? ''),
      fecha_fin: parseDate(mapped['fecha_fin'] ?? ''),
      objetivo_atraccion: parseNumber(mapped['objetivo_atraccion'] ?? ''),
      total_aceptados: parseNumber(mapped['total_aceptados'] ?? ''),
      pct_consecucion_atraccion: parseNumber(mapped['pct_consecucion_atraccion'] ?? ''),
      objetivo_programa: parseNumber(mapped['objetivo_programa'] ?? ''),
      total_programa: parseNumber(mapped['total_programa'] ?? ''),
      pct_consecucion_programa: parseNumber(mapped['pct_consecucion_programa'] ?? ''),
      expectativa_finalizan: parseNumber(mapped['expectativa_finalizan'] ?? ''),
      pct_exito_estimado: parseNumber(mapped['pct_exito_estimado'] ?? ''),
      contratos_firmados: parseNumber(mapped['contratos_firmados'] ?? ''),
      raw_data: row as unknown as Record<string, string>,
    }

    const { error: upsertError } = await supabaseAdmin
      .from('promo_targets')
      .upsert(upsertPayload, { onConflict: 'promocion' })

    if (upsertError) {
      result.errors.push(`Row ${rowNum} (${promocion}): ${upsertError.message}`)
    } else {
      result.upserted++
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface PromotionsCreateResult {
  created: number
  updated: number
  errors: string[]
}

export interface ExcelMadreResult {
  baseDatos: BaseDatosResult
  resumen: ResumenResult
  globalPlacement: GlobalPlacementResult
  promotionsCreate: PromotionsCreateResult
  promotionsSync: SyncPromotionCountsResult
  errors: string[]
}

/**
 * Create/update promotion records from distinct promocion_nombre values in candidates.
 * Also enriches from Resumen data in promo_targets.
 */
async function createPromotionsFromCandidates(): Promise<PromotionsCreateResult> {
  const result: PromotionsCreateResult = { created: 0, updated: 0, errors: [] }

  // Get distinct promocion_nombre values from candidates
  const { data: candidates, error: candError } = await supabaseAdmin
    .from('candidates')
    .select('promocion_nombre')
    .not('promocion_nombre', 'is', null)

  if (candError) {
    result.errors.push(`Failed to fetch candidates: ${candError.message}`)
    return result
  }

  const promoNames = new Set<string>()
  for (const c of candidates ?? []) {
    if (c.promocion_nombre) promoNames.add(c.promocion_nombre)
  }

  if (promoNames.size === 0) return result

  // Get existing promo_targets for enrichment
  const { data: targets } = await supabaseAdmin
    .from('promo_targets')
    .select('*')

  const targetMap = new Map<string, (typeof targets extends (infer T)[] | null ? T : never)>()
  for (const t of targets ?? []) {
    targetMap.set(t.promocion, t)
  }

  // Upsert each promotion
  for (const nombre of promoNames) {
    const target = targetMap.get(nombre)
    const numero = extractPromoNumber(nombre)

    const payload: Record<string, unknown> = {
      nombre,
      numero,
      modalidad: target?.modalidad ?? null,
      pais: target?.pais ?? null,
      coordinador: target?.coordinador ?? null,
      cliente: target?.cliente ?? null,
      fecha_inicio: target?.fecha_inicio ?? null,
      fecha_fin: target?.fecha_fin ?? null,
      objetivo_atraccion: target?.objetivo_atraccion ?? null,
      objetivo_programa: target?.objetivo_programa ?? null,
      expectativa_finalizan: target?.expectativa_finalizan ?? null,
    }

    const { error: upsertError, data: upsertData } = await supabaseAdmin
      .from('promotions')
      .upsert(payload as any, { onConflict: 'nombre' })
      .select('id')
      .single()

    if (upsertError) {
      result.errors.push(`${nombre}: ${upsertError.message}`)
    } else if (upsertData) {
      result.created++
    }
  }

  return result
}

/**
 * Orchestrates all imports from the Excel madre sheet.
 *
 * Pipeline order:
 *   1. Base Datos — enrich candidates
 *   2. Resumen — import promo targets
 *   3. Create/update promotions from distinct promo names
 *   4. Global Placement — import placement data
 *   5. Sync promotion counts from candidates
 */
export async function importExcelMadre(): Promise<ExcelMadreResult> {
  const errors: string[] = []

  let baseDatos: BaseDatosResult = { updated: 0, inserted: 0, skipped: 0, errors: [] }
  let resumen: ResumenResult = { upserted: 0, skipped: 0, errors: [] }
  let globalPlacement: GlobalPlacementResult = { updated: 0, skipped: 0, notMatched: 0, errors: [] }
  let promotionsCreate: PromotionsCreateResult = { created: 0, updated: 0, errors: [] }
  let promotionsSync: SyncPromotionCountsResult = { synced: 0, errors: [] }

  // Step 1: Base Datos
  try {
    baseDatos = await importBaseDatos()
    if (baseDatos.errors.length > 0) {
      errors.push(...baseDatos.errors.map((e) => `[BaseDatos] ${e}`))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[BaseDatos] Fatal: ${msg}`)
  }

  // Step 2: Resumen
  try {
    resumen = await importResumen()
    if (resumen.errors.length > 0) {
      errors.push(...resumen.errors.map((e) => `[Resumen] ${e}`))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[Resumen] Fatal: ${msg}`)
  }

  // Step 3: Create/update promotions
  try {
    promotionsCreate = await createPromotionsFromCandidates()
    if (promotionsCreate.errors.length > 0) {
      errors.push(...promotionsCreate.errors.map((e) => `[Promotions] ${e}`))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[Promotions] Fatal: ${msg}`)
  }

  // Step 4: Global Placement
  try {
    globalPlacement = await importGlobalPlacement()
    if (globalPlacement.errors.length > 0) {
      errors.push(...globalPlacement.errors.map((e) => `[GlobalPlacement] ${e}`))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[GlobalPlacement] Fatal: ${msg}`)
  }

  // Step 5: Sync promotion counts
  try {
    promotionsSync = await syncPromotionsFromCandidates()
    if (promotionsSync.errors.length > 0) {
      errors.push(...promotionsSync.errors.map((e) => `[PromoSync] ${e}`))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`[PromoSync] Fatal: ${msg}`)
  }

  return { baseDatos, resumen, globalPlacement, promotionsCreate, promotionsSync, errors }
}
