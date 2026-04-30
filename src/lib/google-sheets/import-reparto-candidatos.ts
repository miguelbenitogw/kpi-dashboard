/**
 * One-time import for the Norway historical "Reparto personas- cliente" tab.
 *
 * Source: Norway historical Google Sheet
 *   Sheet ID : 1wtB1Mn64iQgJC9eauABSiLT8vu5Ye605swAKYVpXJdg
 *   Tab GID  : 1818389707  ("Reparto personas- cliente")
 *
 * NOTE: Row 0 of this tab is empty — the actual headers live on row 2.
 * We pass { headerRow: 2 } to readSheetAsRows.
 *
 * Matching strategy: primary key is the "ID" column (= candidates_kpi.id).
 * Rows without an ID or whose ID is not found in the DB are skipped.
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { readSheetAsRows } from './client'

// ---------------------------------------------------------------------------
// Constants (exported so the route can reference them)
// ---------------------------------------------------------------------------

export const NORWAY_SHEET_ID = '1wtB1Mn64iQgJC9eauABSiLT8vu5Ye605swAKYVpXJdg'
export const REPARTO_CANDIDATOS_GID = '1818389707'

// ---------------------------------------------------------------------------
// Helpers (copied from import-madre.ts — keep in sync if changed there)
// ---------------------------------------------------------------------------

/**
 * Normalize a raw promotion name to the canonical "Promoción NNN" format.
 * Handles: "P113", "p113" → "Promoción 113"
 * Leaves already-canonical names ("Promoción 113", "Promoción Bélgica") untouched.
 */
function normalizePromoName(name: string): string {
  const trimmed = name.trim()
  const shortMatch = trimmed.match(/^[Pp](\d+)$/)
  if (shortMatch) return `Promoción ${shortMatch[1]}`
  return trimmed
}

/**
 * Parse a date string that may be in DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY,
 * or ISO format. Returns an ISO date string (YYYY-MM-DD) or null.
 */
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
// Column mapping
// ---------------------------------------------------------------------------

/**
 * Maps lowercase/trimmed header substrings to canonical DB field names.
 *
 * Rules:
 *   - "cliente asignado" is preferred over "cliente estimado inicial"
 *     → we match on substring "cliente asignado" (case-insensitive).
 *   - "Facturado a cliente" and "Concatenar..." are explicitly skipped.
 *   - ID column is used only for matching, not stored separately.
 */
const REPARTO_COLUMN_MAP: Record<string, string[]> = {
  // match key — not written to DB directly (it IS the PK)
  id: ['id'],
  // fields written to candidates_kpi
  promocion_nombre: ['promoción', 'promocion'],
  coordinador: ['coordinador'],
  full_name: ['nombre y apellidos', 'nombre completo'],
  gp_training_status: ['estado (approved, hired', 'estado'],
  fecha_fin_formacion: ['fecha fin de formación', 'fecha fin de formacion'],
  fecha_inicio_trabajo: ['fecha inicio de trabajo en noruega', 'fecha inicio de trabajo'],
  tiempo_colocacion: ['tiempo de colocación', 'tiempo de colocacion'],
  tipo_perfil: ['tipo de perfil'],
  quincena: ['quincena'],
  mes_llegada: ['mes y año de llegada', 'mes y ano de llegada'],
  // "cliente asignado" wins over "cliente estimado inicial"
  cliente: ['cliente asignado'],
  notas_excel: ['notas (indicar histórico', 'notas (indicar historico', 'notas'],
}

/**
 * Columns to explicitly skip (matched by substring).
 */
const SKIP_COLUMNS = ['concatenar', 'facturado a cliente']

function resolveHeader(rawHeader: string): string | null {
  const lower = rawHeader.toLowerCase().trim()

  // Explicitly skip unwanted columns
  if (SKIP_COLUMNS.some((skip) => lower.includes(skip))) return null

  // Exact match first
  for (const [canonical, variants] of Object.entries(REPARTO_COLUMN_MAP)) {
    if (variants.some((v) => lower === v)) return canonical
  }

  // Substring match (min 4 chars to avoid false positives)
  for (const [canonical, variants] of Object.entries(REPARTO_COLUMN_MAP)) {
    if (variants.some((v) => v.length >= 4 && lower.includes(v))) return canonical
  }

  return null
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface RepartoCandidatosPreviewRow {
  rowNum: number
  id: string
  full_name: string | null
  action: 'update' | 'skip'
  reason?: string
  payload?: Record<string, unknown>
}

export interface RepartoCandidatosResult {
  processed: number
  updated: number
  skipped: number
  errors: string[]
  dryRun: boolean
  preview: RepartoCandidatosPreviewRow[]
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

/**
 * Reads the "Reparto personas- cliente" tab and syncs it into candidates_kpi.
 *
 * @param dryRun - When true (default), no DB writes are performed.
 */
export async function importRepartoCandidatos(
  dryRun = true,
): Promise<RepartoCandidatosResult> {
  const result: RepartoCandidatosResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    dryRun,
    preview: [],
  }

  // Fetch the sheet — headerRow=2 because row 1 is empty
  const { headers, rows } = await readSheetAsRows(
    NORWAY_SHEET_ID,
    parseInt(REPARTO_CANDIDATOS_GID, 10),
    { headerRow: 2 },
  )

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('Reparto personas- cliente tab returned no data')
    return result
  }

  // Build header → canonical mapping once
  const headerMap = new Map<string, string>()
  for (const h of headers) {
    const canonical = resolveHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    // rowNum is relative to the sheet: headerRow=2, so data starts at row 3
    const rowNum = i + 3

    // Extract mapped values
    const mapped: Record<string, string> = {}
    for (const [rawHeader, canonical] of headerMap) {
      const value = row[rawHeader]?.trim()
      if (value) mapped[canonical] = value
    }

    const candidateId = mapped['id']
    if (!candidateId) {
      result.skipped++
      result.processed++
      if (result.preview.length < 20) {
        result.preview.push({
          rowNum,
          id: '',
          full_name: mapped['full_name'] ?? null,
          action: 'skip',
          reason: 'Empty ID column',
        })
      }
      continue
    }

    result.processed++

    // Build update payload — only include non-empty values
    const rawPromoNombre = mapped['promocion_nombre'] ?? null
    const normalizedPromoNombre = rawPromoNombre ? normalizePromoName(rawPromoNombre) : null

    const payload: Record<string, unknown> = {}

    if (normalizedPromoNombre) payload.promocion_nombre = normalizedPromoNombre
    if (mapped['coordinador']) payload.coordinador = mapped['coordinador']
    if (mapped['full_name']) payload.full_name = mapped['full_name']
    if (mapped['gp_training_status']) payload.gp_training_status = mapped['gp_training_status']
    if (mapped['tipo_perfil']) payload.tipo_perfil = mapped['tipo_perfil']
    if (mapped['cliente']) payload.cliente = mapped['cliente']
    if (mapped['quincena']) payload.quincena = mapped['quincena']
    if (mapped['mes_llegada']) payload.mes_llegada = mapped['mes_llegada']
    if (mapped['tiempo_colocacion']) payload.tiempo_colocacion = mapped['tiempo_colocacion']
    if (mapped['notas_excel']) payload.notas_excel = mapped['notas_excel']

    const fechaFin = parseDate(mapped['fecha_fin_formacion'] ?? '')
    if (fechaFin) payload.fecha_fin_formacion = fechaFin

    const fechaInicio = parseDate(mapped['fecha_inicio_trabajo'] ?? '')
    if (fechaInicio) payload.fecha_inicio_trabajo = fechaInicio

    // Dry-run: collect preview and move on
    if (dryRun) {
      if (result.preview.length < 20) {
        result.preview.push({
          rowNum,
          id: candidateId,
          full_name: (mapped['full_name'] as string | undefined) ?? null,
          action: 'update',
          payload,
        })
      }
      result.updated++
      continue
    }

    // Check the candidate exists
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('candidates_kpi')
      .select('id')
      .eq('id', candidateId)
      .maybeSingle()

    if (selectError) {
      result.errors.push(`Row ${rowNum}: select error for ${candidateId}: ${selectError.message}`)
      result.skipped++
      continue
    }

    if (!existing) {
      result.skipped++
      if (result.preview.length < 20) {
        result.preview.push({
          rowNum,
          id: candidateId,
          full_name: (mapped['full_name'] as string | undefined) ?? null,
          action: 'skip',
          reason: 'Candidate not found in DB',
        })
      }
      continue
    }

    if (Object.keys(payload).length === 0) {
      result.skipped++
      if (result.preview.length < 20) {
        result.preview.push({
          rowNum,
          id: candidateId,
          full_name: (mapped['full_name'] as string | undefined) ?? null,
          action: 'skip',
          reason: 'No non-empty fields to update',
        })
      }
      continue
    }

    const { error: updateError } = await supabaseAdmin
      .from('candidates_kpi')
      .update(payload as any)
      .eq('id', candidateId)

    if (updateError) {
      result.errors.push(`Row ${rowNum}: update error for ${candidateId}: ${updateError.message}`)
      result.skipped++
    } else {
      result.updated++
      if (result.preview.length < 20) {
        result.preview.push({
          rowNum,
          id: candidateId,
          full_name: (mapped['full_name'] as string | undefined) ?? null,
          action: 'update',
          payload,
        })
      }
    }
  }

  return result
}
