import { supabaseAdmin } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type CandidateRow = {
  id: string
  full_name: string | null
  hpr_number: string | null
  current_status: string | null
  gp_training_status: string | null
  gp_open_to: string | null
  gp_availability: string | null
  gp_comments: string | null
  gp_last_update_placement: string | null
  gp_priority: string | null
  placement_status: string | null
  assigned_agency: string | null
}

export interface ParsedCandidatePlacementRow {
  rowNumber: number
  full_name: string
  hpr_number: string | null
  gp_training_status: string | null
  gp_availability: string | null
  gp_comments: string | null
  gp_last_update_placement: string | null
  gp_open_to: string | null
  gp_priority: string | null
  placement_status: string | null
  assigned_agency: string | null
}

export interface CandidatePlacementImportOptions {
  apply?: boolean
  syncCurrentStatus?: boolean
}

export interface CandidatePlacementImportResult {
  dryRun: boolean
  totalRows: number
  matched: number
  unmatched: number
  ambiguous: number
  conflicts: number
  unchanged: number
  rowsWithChanges: number
  updated: number
  fieldChanges: Record<string, number>
  trainingStatusCounts: Record<string, number>
  placementStatusCounts: Record<string, number>
  preferenceCounts: Record<string, number>
  hiredCandidates: Array<{
    rowNumber: number
    full_name: string
    matched_candidate_id: string
    placement_status: string | null
    gp_training_status: string | null
    gp_open_to: string | null
    assigned_agency: string | null
  }>
  unmatchedRows: Array<{
    rowNumber: number
    full_name: string
    hpr_number: string | null
    reason: string
  }>
  changePreview: Array<{
    rowNumber: number
    candidate_id: string
    full_name: string
    changed_fields: string[]
  }>
}

type CandidateUpdate = Database['public']['Tables']['candidates_kpi']['Update']

const HEADER_MAP: Record<string, string[]> = {
  full_name: ['name', 'nombre', 'nombre completo', 'nombre y apellidos'],
  hpr_number: ['hpr-nummer', 'hpr number', 'hpr', 'numero hpr', 'número hpr'],
  gp_training_status: ['status (training)', 'training status'],
  gp_availability: ['availability', 'available', 'disponibilidad'],
  gp_comments: ['comments (coordinators)', 'comments'],
  gp_last_update_placement: ['last update (placement)', 'last update placement', 'last update'],
  gp_open_to: ['open to', 'abierto a', 'abierta a'],
  gp_priority: ['priority', 'prioridad'],
  placement_status: ['status (placement)', 'placement status'],
  assigned_agency: ['assigned agency', 'agency', 'agencia asignada'],
}

const HIRED_PLACEMENT_STATUSES = new Set([
  'hired by kommuner fast',
  'hired by kommuner temporary',
  'hired by agency',
])

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHpr(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function cleanCell(value: string | undefined): string | null {
  if (value === undefined) return null
  const trimmed = value.replace(/\uFEFF/g, '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function detectDelimiter(input: string): string {
  const firstLine = input.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  if (firstLine.includes('\t')) return '\t'
  const commaCount = (firstLine.match(/,/g) ?? []).length
  const semicolonCount = (firstLine.match(/;/g) ?? []).length
  return semicolonCount > commaCount ? ';' : ','
}

function parseDelimited(input: string): string[][] {
  const delimiter = detectDelimiter(input)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const normalized = input.replace(/^\uFEFF/, '')

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!
    const next = normalized[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(field)
      field = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function mapHeader(header: string): string | null {
  const normalized = normalizeHeader(header)
  for (const [canonical, aliases] of Object.entries(HEADER_MAP)) {
    if (aliases.some((alias) => normalized === alias)) return canonical
  }
  for (const [canonical, aliases] of Object.entries(HEADER_MAP)) {
    if (aliases.some((alias) => alias.length >= 4 && normalized.includes(alias))) return canonical
  }
  return null
}

export function parseCandidatePlacementCsv(raw: string): ParsedCandidatePlacementRow[] {
  const rows = parseDelimited(raw)
  const headerRowIndex = rows.findIndex((cells) =>
    cells.some((cell) => normalizeHeader(cell) === 'name') &&
    cells.some((cell) => normalizeHeader(cell).includes('status (placement)'))
  )

  if (headerRowIndex === -1) {
    throw new Error('No pude encontrar la cabecera del CSV/TSV de placement.')
  }

  const headerRow = rows[headerRowIndex]!
  const headerIndexes = new Map<string, number>()
  headerRow.forEach((header, index) => {
    const canonical = mapHeader(header)
    if (canonical) headerIndexes.set(canonical, index)
  })

  if (!headerIndexes.has('full_name')) {
    throw new Error('La cabecera no contiene la columna Name.')
  }

  const parsed: ParsedCandidatePlacementRow[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const cells = rows[i] ?? []
    const fullName = cleanCell(cells[headerIndexes.get('full_name') ?? -1])
    if (!fullName) continue

    parsed.push({
      rowNumber: i + 1,
      full_name: fullName,
      hpr_number: normalizeHpr(cleanCell(cells[headerIndexes.get('hpr_number') ?? -1])),
      gp_training_status: cleanCell(cells[headerIndexes.get('gp_training_status') ?? -1]),
      gp_availability: cleanCell(cells[headerIndexes.get('gp_availability') ?? -1]),
      gp_comments: cleanCell(cells[headerIndexes.get('gp_comments') ?? -1]),
      gp_last_update_placement: cleanCell(cells[headerIndexes.get('gp_last_update_placement') ?? -1]),
      gp_open_to: cleanCell(cells[headerIndexes.get('gp_open_to') ?? -1]),
      gp_priority: cleanCell(cells[headerIndexes.get('gp_priority') ?? -1]),
      placement_status: cleanCell(cells[headerIndexes.get('placement_status') ?? -1]),
      assigned_agency: cleanCell(cells[headerIndexes.get('assigned_agency') ?? -1]),
    })
  }

  return parsed
}

function increment(map: Record<string, number>, key: string | null | undefined) {
  if (!key) return
  map[key] = (map[key] ?? 0) + 1
}

function buildIndex<T>(rows: T[], getter: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = getter(row)
    if (!key) continue
    const list = map.get(key)
    if (list) {
      list.push(row)
    } else {
      map.set(key, [row])
    }
  }
  return map
}

function valuesDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) !== (b ?? null)
}

function deriveCurrentStatus(row: ParsedCandidatePlacementRow): string | null {
  const placement = row.placement_status?.toLowerCase().trim() ?? ''
  if (HIRED_PLACEMENT_STATUSES.has(placement)) return 'Hired'
  if ((row.gp_training_status ?? '').toLowerCase().trim() === 'hired') return 'Hired'
  return row.gp_training_status
}

export async function importCandidatePlacementCsv(
  raw: string,
  options: CandidatePlacementImportOptions = {},
): Promise<CandidatePlacementImportResult> {
  const apply = options.apply === true
  const syncCurrentStatus = options.syncCurrentStatus !== false
  const parsedRows = parseCandidatePlacementCsv(raw)

  const { data, error } = await supabaseAdmin
    .from('candidates_kpi')
    .select(
      'id, full_name, hpr_number, current_status, gp_training_status, gp_open_to, gp_availability, gp_comments, gp_last_update_placement, gp_priority, placement_status, assigned_agency',
    )

  if (error) {
    throw new Error(`Supabase: ${error.message}`)
  }

  const candidates = (data ?? []) as CandidateRow[]
  const byHpr = buildIndex(candidates, (row) => normalizeHpr(row.hpr_number))
  const byName = buildIndex(candidates, (row) => (row.full_name ? normalizeName(row.full_name) : null))

  const result: CandidatePlacementImportResult = {
    dryRun: !apply,
    totalRows: parsedRows.length,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    conflicts: 0,
    unchanged: 0,
    rowsWithChanges: 0,
    updated: 0,
    fieldChanges: {},
    trainingStatusCounts: {},
    placementStatusCounts: {},
    preferenceCounts: {},
    hiredCandidates: [],
    unmatchedRows: [],
    changePreview: [],
  }

  for (const row of parsedRows) {
    increment(result.trainingStatusCounts, row.gp_training_status)
    increment(result.placementStatusCounts, row.placement_status)
    increment(result.preferenceCounts, row.gp_open_to)

    const hprMatches = row.hpr_number ? byHpr.get(row.hpr_number) ?? [] : []
    const nameKey = normalizeName(row.full_name)
    const nameMatches = nameKey ? byName.get(nameKey) ?? [] : []

    let matched: CandidateRow | null = null

    if (hprMatches.length > 1) {
      result.ambiguous++
      result.unmatched++
      result.unmatchedRows.push({
        rowNumber: row.rowNumber,
        full_name: row.full_name,
        hpr_number: row.hpr_number,
        reason: 'HPR duplicado en la BBDD',
      })
      continue
    }

    if (nameMatches.length > 1 && hprMatches.length === 0) {
      result.ambiguous++
      result.unmatched++
      result.unmatchedRows.push({
        rowNumber: row.rowNumber,
        full_name: row.full_name,
        hpr_number: row.hpr_number,
        reason: 'Nombre duplicado en la BBDD',
      })
      continue
    }

    if (hprMatches.length === 1) {
      matched = hprMatches[0]!
      if (nameMatches.length === 1 && nameMatches[0]!.id !== matched.id) {
        result.conflicts++
      }
    } else if (nameMatches.length === 1) {
      matched = nameMatches[0]!
    }

    if (!matched) {
      result.unmatched++
      result.unmatchedRows.push({
        rowNumber: row.rowNumber,
        full_name: row.full_name,
        hpr_number: row.hpr_number,
        reason: row.hpr_number ? 'Sin match por HPR ni nombre' : 'Sin match por nombre',
      })
      continue
    }

    result.matched++

    const updateData: CandidateUpdate = {}
    const changedFields: string[] = []

    const maybeChange = (field: keyof CandidateRow, nextValue: string | null) => {
      if (nextValue === null) return
      const currentValue = matched?.[field]
      if (!valuesDiffer(currentValue, nextValue)) return
      updateData[field] = nextValue
      changedFields.push(field)
      result.fieldChanges[field] = (result.fieldChanges[field] ?? 0) + 1
    }

    maybeChange('hpr_number', row.hpr_number)
    maybeChange('gp_training_status', row.gp_training_status)
    maybeChange('gp_availability', row.gp_availability)
    maybeChange('gp_comments', row.gp_comments)
    maybeChange('gp_last_update_placement', row.gp_last_update_placement)
    maybeChange('gp_open_to', row.gp_open_to)
    maybeChange('gp_priority', row.gp_priority)
    maybeChange('placement_status', row.placement_status)
    maybeChange('assigned_agency', row.assigned_agency)

    if (syncCurrentStatus) {
      maybeChange('current_status', deriveCurrentStatus(row))
    }

    if ((row.placement_status ?? '').toLowerCase().includes('hired')) {
      result.hiredCandidates.push({
        rowNumber: row.rowNumber,
        full_name: row.full_name,
        matched_candidate_id: matched.id,
        placement_status: row.placement_status,
        gp_training_status: row.gp_training_status,
        gp_open_to: row.gp_open_to,
        assigned_agency: row.assigned_agency,
      })
    }

    if (changedFields.length === 0) {
      result.unchanged++
      continue
    }

    result.changePreview.push({
      rowNumber: row.rowNumber,
      candidate_id: matched.id,
      full_name: matched.full_name ?? row.full_name,
      changed_fields: changedFields,
    })
    result.rowsWithChanges++

    if (!apply) continue

    const { error: updateError } = await supabaseAdmin
      .from('candidates_kpi')
      .update(updateData)
      .eq('id', matched.id)

    if (updateError) {
      throw new Error(`Error actualizando ${matched.id} (${matched.full_name ?? row.full_name}): ${updateError.message}`)
    }

    result.updated++
  }

  return result
}
