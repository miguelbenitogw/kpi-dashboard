import { supabase } from '@/lib/supabase/client'
import type { Candidate } from '@/lib/supabase/types'
import type { Promotion } from '@/lib/supabase/types'
import { TERMINAL_STATUSES } from '@/lib/constants'

// --- Types ---

export interface PromoSummaryCard {
  promocion: string
  coordinador: string | null
  total: number
  hiredCount: number
  dropoutCount: number
  activeCount: number
  statusBreakdown: { status: string; count: number }[]
}

export interface StudentListOptions {
  page?: number
  perPage?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  statusFilter?: string[]
}

export interface StudentListResult {
  data: Candidate[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface DropoutCandidate {
  id: string
  full_name: string | null
  current_status: string | null
  dropout_date: string | null
  dropout_reason: string | null
  dropout_attendance_pct: number | null
  dropout_language_level: string | null
  transferred_to: string | null
  dropout_notes: string | null
}

export interface ConversionMetrics {
  promocion: string
  target: Promotion | null
  actual: {
    totalCandidates: number
    accepted: number
    startedProgram: number
    finishedTraining: number
    hired: number
    dropouts: number
  }
  rates: {
    attractionPct: number
    programPct: number
    finishPct: number
    hirePct: number
    dropoutPct: number
  }
}

export interface PromoComparisonItem {
  promocion: string
  total: number
  hired: number
  dropouts: number
  dropoutRate: number
  conversionPct: number
  coordinador: string | null
  target: Promotion | null
}

// Hired-like statuses
const HIRED_STATUSES = [
  'Hired',
  'Converted - Temp',
  'Converted - Employee',
  'Permanent Kommune',
  'Temporary Kommune',
  'Permanent Agency',
  'Temporary Agency',
]

// Dropout-related statuses
const DROPOUT_STATUSES = [
  'Offer-Declined',
  'Offer-Withdrawn',
  'Expelled',
  'Transferred',
  'Rejected',
  'Not Valid',
  'Un-Qualified',
]

// Training/program statuses (started program)
const PROGRAM_STATUSES = [
  'In Training',
  'Training Finished',
  'In Training out of GW',
  'To Place',
  'Assigned',
  'Forward-to-Onboarding',
  ...HIRED_STATUSES,
]

// Finished training statuses
const FINISHED_TRAINING_STATUSES = [
  'Training Finished',
  'To Place',
  'Assigned',
  'Forward-to-Onboarding',
  ...HIRED_STATUSES,
]

// --- Queries ---

/**
 * Get all distinct promos with summary counts
 */
export async function getPerformancePromos(): Promise<PromoSummaryCard[]> {
  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('promocion_nombre, current_status, coordinador')
    .not('promocion_nombre', 'is', null)

  if (error) throw error
  if (!data || data.length === 0) return []

  const promoMap = new Map<
    string,
    {
      coordinador: string | null
      statuses: Map<string, number>
      total: number
      hiredCount: number
      dropoutCount: number
      activeCount: number
    }
  >()

  for (const row of data) {
    const promo = row.promocion_nombre!
    const status = row.current_status ?? 'Unknown'

    if (!promoMap.has(promo)) {
      promoMap.set(promo, {
        coordinador: row.coordinador,
        statuses: new Map(),
        total: 0,
        hiredCount: 0,
        dropoutCount: 0,
        activeCount: 0,
      })
    }

    const entry = promoMap.get(promo)!
    entry.total++
    entry.statuses.set(status, (entry.statuses.get(status) ?? 0) + 1)

    if (HIRED_STATUSES.includes(status)) {
      entry.hiredCount++
    } else if (DROPOUT_STATUSES.includes(status) || row.current_status === null) {
      // Only count as dropout if status is a dropout status
      if (DROPOUT_STATUSES.includes(status)) {
        entry.dropoutCount++
      }
    }

    if (!TERMINAL_STATUSES.includes(status)) {
      entry.activeCount++
    }
  }

  return Array.from(promoMap.entries())
    .map(([promocion, entry]) => ({
      promocion,
      coordinador: entry.coordinador,
      total: entry.total,
      hiredCount: entry.hiredCount,
      dropoutCount: entry.dropoutCount,
      activeCount: entry.activeCount,
      statusBreakdown: Array.from(entry.statuses.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => a.promocion.localeCompare(b.promocion))
}

/**
 * Get paginated student list for a promo
 */
export async function getPromoStudentList(
  promocion: string,
  options: StudentListOptions = {}
): Promise<StudentListResult> {
  const {
    page = 1,
    perPage = 50,
    sortBy = 'full_name',
    sortOrder = 'asc',
    statusFilter,
  } = options

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from('candidates_kpi')
    .select('*', { count: 'exact' })
    .eq('promocion_nombre', promocion)

  if (statusFilter && statusFilter.length > 0) {
    query = query.in('current_status', statusFilter)
  }

  query = query.order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) throw error

  const total = count ?? 0
  return {
    data: data ?? [],
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

/**
 * Get dropout candidates for a promo from the linked Excel sheet
 * (promo_students_kpi, tab_name = 'Dropouts').
 * Only returns data if the promo has a linked sheet with a Dropouts tab.
 */
export async function getPromoDropouts(
  promocion: string
): Promise<DropoutCandidate[]> {
  const { data, error } = await supabase
    .from('promo_students_kpi')
    .select(
      'id, full_name, sheet_status, dropout_date, dropout_reason, dropout_attendance_pct, dropout_language_level, transferred_to, dropout_notes'
    )
    .eq('promocion_nombre', promocion)
    .eq('tab_name', 'Dropouts')
    .order('dropout_date', { ascending: false, nullsFirst: false })

  if (error) throw error

  // Map promo_students_kpi shape to DropoutCandidate
  return (data ?? []).map((r: any) => ({
    id: r.id,
    full_name: r.full_name,
    current_status: r.sheet_status,
    dropout_date: r.dropout_date,
    dropout_reason: r.dropout_reason,
    dropout_attendance_pct: r.dropout_attendance_pct,
    dropout_language_level: r.dropout_language_level,
    transferred_to: r.transferred_to,
    dropout_notes: r.dropout_notes,
  })) as DropoutCandidate[]
}

/**
 * Get conversion metrics for a promo (candidates + targets)
 */
export async function getPromoConversionMetrics(
  promocion: string
): Promise<ConversionMetrics> {
  // Fetch candidates and target in parallel
  const [candidatesResult, targetResult] = await Promise.all([
    supabase
      .from('candidates_kpi')
      .select('current_status')
      .eq('promocion_nombre', promocion),
    supabase
      .from('promotions_kpi')
      .select('*')
      .eq('nombre', promocion)
      .maybeSingle(),
  ])

  if (candidatesResult.error) throw candidatesResult.error
  if (targetResult.error) throw targetResult.error

  const candidates = candidatesResult.data ?? []
  const target = targetResult.data

  let accepted = 0
  let startedProgram = 0
  let finishedTraining = 0
  let hired = 0
  let dropouts = 0

  for (const c of candidates) {
    const status = c.current_status ?? ''

    // Everyone in the promo was accepted at some point
    accepted++

    if (PROGRAM_STATUSES.includes(status)) {
      startedProgram++
    }
    if (FINISHED_TRAINING_STATUSES.includes(status)) {
      finishedTraining++
    }
    if (HIRED_STATUSES.includes(status)) {
      hired++
    }
    if (DROPOUT_STATUSES.includes(status)) {
      dropouts++
    }
  }

  const total = candidates.length
  const objAtraccion = target?.objetivo_atraccion ?? total

  return {
    promocion,
    target,
    actual: {
      totalCandidates: total,
      accepted,
      startedProgram,
      finishedTraining,
      hired,
      dropouts,
    },
    rates: {
      attractionPct: objAtraccion > 0 ? Math.round((accepted / objAtraccion) * 100) : 0,
      programPct: accepted > 0 ? Math.round((startedProgram / accepted) * 100) : 0,
      finishPct: startedProgram > 0 ? Math.round((finishedTraining / startedProgram) * 100) : 0,
      hirePct: finishedTraining > 0 ? Math.round((hired / finishedTraining) * 100) : 0,
      dropoutPct: total > 0 ? Math.round((dropouts / total) * 100) : 0,
    },
  }
}

/**
 * Get comparison data for multiple promos
 */
export async function getPromoComparison(
  promociones: string[]
): Promise<PromoComparisonItem[]> {
  if (promociones.length === 0) return []

  // Fetch all candidates + targets in parallel
  const [candidatesResult, targetsResult] = await Promise.all([
    supabase
      .from('candidates_kpi')
      .select('promocion_nombre, current_status, coordinador')
      .in('promocion_nombre', promociones),
    supabase
      .from('promotions_kpi')
      .select('*')
      .in('nombre', promociones),
  ])

  if (candidatesResult.error) throw candidatesResult.error
  if (targetsResult.error) throw targetsResult.error

  const candidates = candidatesResult.data ?? []
  const targets = targetsResult.data ?? []

  // Index targets by nombre
  const targetMap = new Map<string, Promotion>()
  for (const t of targets) {
    targetMap.set(t.nombre, t)
  }

  // Group candidates by promo
  const promoMap = new Map<
    string,
    { total: number; hired: number; dropouts: number; coordinador: string | null }
  >()

  for (const c of candidates) {
    const promo = c.promocion_nombre!
    if (!promoMap.has(promo)) {
      promoMap.set(promo, { total: 0, hired: 0, dropouts: 0, coordinador: c.coordinador })
    }
    const entry = promoMap.get(promo)!
    entry.total++
    const status = c.current_status ?? ''
    if (HIRED_STATUSES.includes(status)) entry.hired++
    if (DROPOUT_STATUSES.includes(status)) entry.dropouts++
  }

  return promociones.map((promo) => {
    const entry = promoMap.get(promo) ?? { total: 0, hired: 0, dropouts: 0, coordinador: null }
    return {
      promocion: promo,
      total: entry.total,
      hired: entry.hired,
      dropouts: entry.dropouts,
      dropoutRate: entry.total > 0 ? Math.round((entry.dropouts / entry.total) * 100) : 0,
      conversionPct: entry.total > 0 ? Math.round((entry.hired / entry.total) * 100) : 0,
      coordinador: entry.coordinador,
      target: targetMap.get(promo) ?? null,
    }
  })
}

// --- History types ---

export interface CandidateHistoryRecord {
  id: string
  job_opening_title: string | null
  candidate_status_in_jo: string | null
  association_type: string | null
  associated_at: string | null
}

export interface CandidateWithHistory {
  candidate_id: string
  candidate_name: string | null
  current_status: string | null
  history: CandidateHistoryRecord[]
  atraccionCount: number
  formacionCount: number
}

/**
 * Get history overview for all candidates in a promo.
 * Joins candidates (by promocion_nombre) with candidate_job_history.
 */
export async function getPromoHistoryOverview(
  promocion: string
): Promise<CandidateWithHistory[]> {
  // Step 1: get all candidates in this promo
  const { data: candidates, error: candError } = await supabase
    .from('candidates_kpi')
    .select('id, full_name, current_status')
    .eq('promocion_nombre', promocion)
    .order('full_name', { ascending: true })

  if (candError) throw candError
  if (!candidates || candidates.length === 0) return []

  const candidateIds = candidates.map((c) => c.id)

  // Step 2: get all history records for these candidates
  const { data: historyRows, error: histError } = await supabase
    .from('candidate_job_history_kpi')
    .select('id, candidate_id, job_opening_title, candidate_status_in_jo, association_type, associated_at')
    .in('candidate_id', candidateIds)
    .order('associated_at', { ascending: true, nullsFirst: false })

  if (histError) throw histError

  // Step 3: group history by candidate
  const historyMap = new Map<string, CandidateHistoryRecord[]>()
  for (const row of historyRows ?? []) {
    const list = historyMap.get(row.candidate_id) ?? []
    list.push({
      id: row.id,
      job_opening_title: row.job_opening_title,
      candidate_status_in_jo: row.candidate_status_in_jo,
      association_type: row.association_type,
      associated_at: row.associated_at ?? null,
    })
    historyMap.set(row.candidate_id, list)
  }

  return candidates.map((c) => {
    const history = historyMap.get(c.id) ?? []
    return {
      candidate_id: c.id,
      candidate_name: c.full_name,
      current_status: c.current_status,
      history,
      atraccionCount: history.filter((h) => h.association_type === 'atraccion').length,
      formacionCount: history.filter((h) => h.association_type === 'formacion').length,
    }
  })
}

/**
 * Get history for a single candidate
 */
export async function getCandidateHistory(
  candidateId: string
): Promise<CandidateHistoryRecord[]> {
  const { data, error } = await supabase
    .from('candidate_job_history_kpi')
    .select('id, job_opening_title, candidate_status_in_jo, association_type, associated_at')
    .eq('candidate_id', candidateId)
    .order('associated_at', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as CandidateHistoryRecord[]
}

// --- Notes types ---

export interface CandidateNote {
  id: string
  note_title: string | null
  note_content: string | null
  author: string | null
  is_system: boolean
  created_at: string | null
}

/**
 * Get notes for a single candidate, ordered by created_at descending
 */
export async function getCandidateNotes(candidateId: string): Promise<CandidateNote[]> {
  const { data, error } = await supabase
    .from('candidate_notes_kpi')
    .select('id, note_title, note_content, author, is_system, created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as CandidateNote[]
}

/**
 * Get single promotion row (replaces old promo_targets_kpi query)
 */
export async function getPromotions(
  promocion: string
): Promise<Promotion | null> {
  const { data, error } = await supabase
    .from('promotions_kpi')
    .select('*')
    .eq('nombre', promocion)
    .maybeSingle()

  if (error) throw error
  return data
}
