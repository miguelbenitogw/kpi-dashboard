import { supabase } from '@/lib/supabase/client'
import type { Candidate, JobOpening, CandidateJobHistory } from '@/lib/supabase/types'
import { TERMINAL_STATUSES } from '@/lib/constants'

export interface CandidateQueryOptions {
  page?: number
  perPage?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  statuses?: string[]
  nationalities?: string[]
  sources?: string[]
  jobOpeningId?: string
}

export interface CandidateQueryResult {
  data: Candidate[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface CandidateStats {
  total: number
  byStatus: { status: string; count: number }[]
  byNationality: { nationality: string; count: number }[]
  bySources: { source: string; count: number }[]
  activeCount: number
  terminalCount: number
}

/**
 * Paginated, filterable, sortable query for candidates.
 * Server-side pagination via Supabase — required for 4K+ rows.
 */
export async function getCandidates(
  options: CandidateQueryOptions = {}
): Promise<CandidateQueryResult> {
  const {
    page = 1,
    perPage = 50,
    sortBy = 'modified_time',
    sortOrder = 'desc',
    search,
    statuses,
    nationalities,
    sources,
    jobOpeningId,
  } = options

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from('candidates_kpi')
    .select('*', { count: 'exact' })

  if (jobOpeningId) {
    query = query.eq('job_opening_id', jobOpeningId)
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`)
  }

  if (statuses && statuses.length > 0) {
    query = query.in('current_status', statuses)
  }

  if (nationalities && nationalities.length > 0) {
    query = query.in('nationality', nationalities)
  }

  if (sources && sources.length > 0) {
    query = query.in('source', sources)
  }

  // Sort
  const ascending = sortOrder === 'asc'
  query = query.order(sortBy, { ascending, nullsFirst: false })

  // Paginate
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error('getCandidates error:', error)
    throw error
  }

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
 * Fetch a single candidate by their Zoho ID.
 */
export async function getCandidateById(
  zohoId: string
): Promise<Candidate | null> {
  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('*')
    .eq('id', zohoId)
    .single()

  if (error) {
    console.error('getCandidateById error:', error)
    return null
  }

  return data
}

/**
 * Aggregate stats for candidate filters and dashboard cards.
 */
export async function getCandidateStats(): Promise<CandidateStats> {
  // Total count
  const { count: total } = await supabase
    .from('candidates_kpi')
    .select('*', { count: 'exact', head: true })

  // Status breakdown — fetch all candidates' status (lightweight)
  const { data: statusRows } = await supabase
    .from('candidates_kpi')
    .select('current_status')

  const statusMap = new Map<string, number>()
  let activeCount = 0
  let terminalCount = 0

  for (const row of statusRows ?? []) {
    const s = row.current_status ?? 'Unknown'
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
    if (TERMINAL_STATUSES.includes(s)) {
      terminalCount++
    } else {
      activeCount++
    }
  }

  const byStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  // Nationality breakdown
  const { data: natRows } = await supabase
    .from('candidates_kpi')
    .select('nationality')

  const natMap = new Map<string, number>()
  for (const row of natRows ?? []) {
    const n = row.nationality ?? 'Unknown'
    natMap.set(n, (natMap.get(n) ?? 0) + 1)
  }

  const byNationality = Array.from(natMap.entries())
    .map(([nationality, count]) => ({ nationality, count }))
    .sort((a, b) => b.count - a.count)

  // Source breakdown
  const { data: srcRows } = await supabase
    .from('candidates_kpi')
    .select('source')

  const srcMap = new Map<string, number>()
  for (const row of srcRows ?? []) {
    const s = row.source ?? 'Unknown'
    srcMap.set(s, (srcMap.get(s) ?? 0) + 1)
  }

  const bySources = Array.from(srcMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  return {
    total: total ?? 0,
    byStatus,
    byNationality,
    bySources,
    activeCount,
    terminalCount,
  }
}

/**
 * Candidates scoped to a specific promo/job opening with filters.
 */
export async function getCandidatesByPromo(
  jobOpeningId: string,
  options: Omit<CandidateQueryOptions, 'jobOpeningId'> = {}
): Promise<CandidateQueryResult> {
  return getCandidates({ ...options, jobOpeningId })
}

// ---------------------------------------------------------------------------
// Attraction vacancies
// ---------------------------------------------------------------------------

export interface AttractionVacancy {
  id: string
  title: string
  status: string | null
  client_name: string | null
  date_opened: string | null
  candidate_count: number
}

/**
 * Returns job openings whose title does NOT contain "promo" (case-insensitive).
 * These are considered "attraction" vacancies.
 * Each vacancy includes a live candidate count.
 */
export async function getAttractionVacancies(): Promise<AttractionVacancy[]> {
  // Step 1: Get all job_openings whose title does NOT ilike '%promo%'
  const { data: openings, error: joError } = await supabase
    .from('job_openings_kpi')
    .select('id, title, status, client_name, date_opened')
    .not('title', 'ilike', '%promo%')
    .order('date_opened', { ascending: false, nullsFirst: false })

  if (joError) {
    console.error('getAttractionVacancies JO error:', joError)
    throw joError
  }

  if (!openings || openings.length === 0) return []

  // Step 2: Get candidate counts per job_opening_id for these openings
  const openingIds = openings.map((o) => o.id)
  const { data: countRows, error: countError } = await supabase
    .from('candidates_kpi')
    .select('job_opening_id')
    .in('job_opening_id', openingIds)

  if (countError) {
    console.error('getAttractionVacancies count error:', countError)
    throw countError
  }

  const countMap = new Map<string, number>()
  for (const row of countRows ?? []) {
    const joId = row.job_opening_id ?? ''
    countMap.set(joId, (countMap.get(joId) ?? 0) + 1)
  }

  // Step 3: Combine and sort by candidate count desc
  const vacancies: AttractionVacancy[] = openings.map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status,
    client_name: o.client_name,
    date_opened: o.date_opened,
    candidate_count: countMap.get(o.id) ?? 0,
  }))

  vacancies.sort((a, b) => b.candidate_count - a.candidate_count)

  return vacancies
}

/**
 * Paginated candidates for a specific vacancy (attraction context).
 */
export async function getCandidatesByVacancy(
  jobOpeningId: string,
  options: Omit<CandidateQueryOptions, 'jobOpeningId'> = {}
): Promise<CandidateQueryResult> {
  return getCandidates({ ...options, jobOpeningId })
}

// ---------------------------------------------------------------------------
// Candidate job history (vacantes asociadas a un candidato)
// ---------------------------------------------------------------------------

export type { CandidateJobHistory }

/**
 * Returns all job openings associated with a given candidate
 * from candidate_job_history_kpi, ordered by fetched_at desc.
 */
export async function getCandidateJobHistory(
  candidateId: string
): Promise<CandidateJobHistory[]> {
  const { data, error } = await supabase
    .from('candidate_job_history_kpi')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('fetched_at', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('getCandidateJobHistory error:', error)
    throw error
  }

  return data ?? []
}
