/**
 * Global Placement tab import pipeline.
 *
 * Imports the "Global Placement" tab (gid=1470777220) from Excel madre.
 * This tab tracks placement status for candidates who have completed training.
 * Maps placement data to candidates: placement_status, placement_client,
 * placement_location, hpr_number, flight_date, hospitering_dates.
 *
 * Matching strategy: by candidate ID first, then by full name cross-reference.
 */

import { supabaseAdmin } from '@/lib/supabase/server'
import { buildCsvUrl, parseCSV } from './client'
import { MADRE_SHEET_ID } from './import-madre'

// ---------------------------------------------------------------------------
// Sheet constants
// ---------------------------------------------------------------------------

export const GLOBAL_PLACEMENT_GID = '1470777220'

// ---------------------------------------------------------------------------
// Column mapping for Global Placement tab
// ---------------------------------------------------------------------------

const PLACEMENT_COLUMN_MAP: Record<string, string[]> = {
  id: ['id', 'zoho id', 'zoho_id', 'candidate id', 'candidateid'],
  full_name: ['nombre y apellidos', 'nombre completo', 'nombre', 'name'],
  promocion: ['promocion', 'promoción', 'promo'],
  placement_status: [
    'placement status',
    'estado de colocación',
    'estado colocacion',
    'estado colocación',
    'status placement',
    'placement',
  ],
  placement_client: ['cliente', 'client', 'empresa', 'company'],
  placement_location: [
    'ubicación',
    'ubicacion',
    'location',
    'ciudad',
    'city',
    'destino',
  ],
  placement_date: [
    'fecha de colocación',
    'fecha colocacion',
    'fecha colocación',
    'placement date',
    'fecha inicio trabajo',
  ],
  flight_date: [
    'fecha de vuelo',
    'fecha vuelo',
    'flight date',
    'vuelo',
  ],
  hospitering_dates: [
    'hospitering',
    'hospedaje',
    'hospitering dates',
    'fechas hospitering',
  ],
  hpr_number: [
    'hpr',
    'hpr number',
    'número hpr',
    'numero hpr',
    'n° hpr',
    'nº hpr',
  ],
  // Extended GP fields (added 2026-04-17, from migration 010)
  gp_kontaktperson: ['kontaktperson', 'kontakt', 'contact person', 'contacto'],
  gp_training_status: ['status (training)', 'training status', 'estado formación', 'estado formacion'],
  gp_availability: ['availability', 'disponibilidad', 'available'],
  gp_open_to: ['open to', 'abierto a', 'abierta a'],
  gp_priority: ['priority', 'prioridad'],
  gp_shots: ['shots', 'shots program', 'vacunas'],
  gp_has_profile: ['has global placement profile?', 'has gp profile', 'gp profile', 'tiene perfil gp', 'perfil gp'],
}

function mapPlacementHeader(header: string): string | null {
  const lower = header.toLowerCase().trim()
  // Exact match first
  for (const [canonical, variants] of Object.entries(PLACEMENT_COLUMN_MAP)) {
    if (variants.some((v) => lower === v)) {
      return canonical
    }
  }
  // Substring match for longer variants (min 4 chars)
  for (const [canonical, variants] of Object.entries(PLACEMENT_COLUMN_MAP)) {
    if (variants.some((v) => v.length >= 4 && lower.includes(v))) {
      return canonical
    }
  }
  return null
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
  const euroMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (euroMatch) {
    const [, d, m, y] = euroMatch
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  return null
}

// ---------------------------------------------------------------------------
// Name normalization for fuzzy matching
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // strip parenthetical nicknames like "(Alex)"
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '') // strip non-alphanumeric
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Import function
// ---------------------------------------------------------------------------

export interface GlobalPlacementResult {
  updated: number
  skipped: number
  notMatched: number
  errors: string[]
}

/**
 * Import the Global Placement tab from the Excel madre sheet.
 *
 * For each row:
 *   1. Try matching by ID column (= zoho candidate id = candidates.id)
 *   2. If no ID, try matching by normalized full_name
 *   3. Update matched candidates with placement fields
 */
export async function importGlobalPlacement(): Promise<GlobalPlacementResult> {
  const result: GlobalPlacementResult = {
    updated: 0,
    skipped: 0,
    notMatched: 0,
    errors: [],
  }

  // Fetch CSV
  const url = buildCsvUrl(MADRE_SHEET_ID, GLOBAL_PLACEMENT_GID)
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/csv,text/plain,*/*' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Global Placement tab (gid=${GLOBAL_PLACEMENT_GID}): HTTP ${response.status}`
    )
  }

  const csv = await response.text()
  const { headers, rows } = parseCSV(csv)

  if (headers.length === 0 || rows.length === 0) {
    result.errors.push('Global Placement tab returned no data')
    return result
  }

  // Build header mapping
  const headerMap = new Map<string, string>()
  for (const h of headers) {
    const canonical = mapPlacementHeader(h)
    if (canonical) headerMap.set(h, canonical)
  }

  // Build a name->id index from candidates for fallback matching
  const { data: allCandidates, error: candError } = await supabaseAdmin
    .from('candidates')
    .select('id, full_name')
    .not('full_name', 'is', null)

  if (candError) {
    result.errors.push(`Failed to fetch candidates for matching: ${candError.message}`)
    return result
  }

  const nameToIdMap = new Map<string, string>()
  for (const c of allCandidates ?? []) {
    if (c.full_name) {
      nameToIdMap.set(normalizeName(c.full_name), c.id)
    }
  }

  // Process rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    // Extract mapped values
    const mapped: Record<string, string> = {}
    for (const [rawHeader, canonical] of headerMap) {
      const value = row[rawHeader]?.trim()
      if (value) mapped[canonical] = value
    }

    // Try to find candidate ID
    let candidateId: string | null = mapped['id'] || null

    // Fallback: match by name
    if (!candidateId && mapped['full_name']) {
      const normalizedName = normalizeName(mapped['full_name'])
      candidateId = nameToIdMap.get(normalizedName) ?? null
    }

    if (!candidateId) {
      // Can't match this row to any candidate
      result.notMatched++
      continue
    }

    // Build update payload
    const updateData: Record<string, unknown> = {}

    if (mapped['placement_status']) {
      updateData.placement_status = mapped['placement_status']
    }
    if (mapped['placement_client']) {
      updateData.placement_client = mapped['placement_client']
    }
    if (mapped['placement_location']) {
      updateData.placement_location = mapped['placement_location']
    }
    if (mapped['placement_date']) {
      updateData.placement_date = parseDate(mapped['placement_date'])
    }
    if (mapped['flight_date']) {
      updateData.flight_date = parseDate(mapped['flight_date'])
    }
    if (mapped['hospitering_dates']) {
      updateData.hospitering_dates = mapped['hospitering_dates']
    }
    if (mapped['hpr_number']) {
      updateData.hpr_number = mapped['hpr_number']
    }
    // Extended GP fields (migration 010)
    if (mapped['gp_kontaktperson']) {
      updateData.gp_kontaktperson = mapped['gp_kontaktperson']
    }
    if (mapped['gp_training_status']) {
      updateData.gp_training_status = mapped['gp_training_status']
    }
    if (mapped['gp_availability']) {
      updateData.gp_availability = mapped['gp_availability']
    }
    if (mapped['gp_open_to']) {
      updateData.gp_open_to = mapped['gp_open_to']
    }
    if (mapped['gp_priority']) {
      updateData.gp_priority = mapped['gp_priority']
    }
    if (mapped['gp_shots']) {
      updateData.gp_shots = mapped['gp_shots']
    }
    if (mapped['gp_has_profile'] !== undefined) {
      const val = mapped['gp_has_profile']?.toLowerCase().trim()
      updateData.gp_has_profile = val === 'yes' || val === 'sí' || val === 'si' || val === 'true' || val === '1'
    }

    // Skip rows with no placement data to update
    if (Object.keys(updateData).length === 0) {
      result.skipped++
      continue
    }

    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update(updateData as any)
      .eq('id', candidateId)

    if (updateError) {
      result.errors.push(`Row ${rowNum}: update error for ${candidateId}: ${updateError.message}`)
    } else {
      result.updated++
    }
  }

  return result
}
