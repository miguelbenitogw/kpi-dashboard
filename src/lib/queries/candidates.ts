import { supabase } from '@/lib/supabase/client'
import type { Candidate } from '@/lib/supabase/types'
import { TERMINAL_STATUSES } from '@/lib/zoho/transform'

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
    .from('candidates')
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
    .from('candidates')
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
    .from('candidates')
    .select('*', { count: 'exact', head: true })

  // Status breakdown — fetch all candidates' status (lightweight)
  const { data: statusRows } = await supabase
    .from('candidates')
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
    .from('candidates')
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
    .from('candidates')
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
