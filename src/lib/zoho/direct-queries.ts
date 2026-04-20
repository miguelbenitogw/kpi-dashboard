import { zohoFetch, fetchAllPages } from './client'
import { transformCandidate, transformJobOpening } from './transform'

interface ZohoListResponse<T> {
  data: T[]
  info: {
    more_records: boolean
    per_page: number
    count: number
    page: number
  }
}

const RATE_LIMIT_DELAY_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Candidate queries
// ---------------------------------------------------------------------------

export interface SearchCandidatesOptions {
  criteria?: string
  page?: number
  per_page?: number
  fields?: string
}

const DEFAULT_CANDIDATE_FIELDS = [
  'Full_Name',
  'Email',
  'Phone',
  'Candidate_Status',
  'Candidate_Stage',
  'Candidate_Owner',
  'Source',
  'Origin',
  'Created_Time',
  'Modified_Time',
  'Last_Activity_Time',
  'Nacionalidad_Nationality',
  'Idioma_nativo_Native_Language',
  'Nivel_de_Ingl_s_English_Language',
  'Nivel_de_Alem_n_German_Language',
  'Permiso_de_trabajo_Work_permit',
  'Candidate_ID',
  'Promoci_n',
  'Associated_Tags',
  'Country',
].join(',')

/**
 * Search candidates using Zoho criteria syntax.
 * Returns transformed candidate data + pagination info.
 */
export async function searchCandidates(options: SearchCandidatesOptions = {}) {
  const { criteria, page = 1, per_page = 50, fields } = options

  const params: Record<string, string> = {
    fields: fields || DEFAULT_CANDIDATE_FIELDS,
    per_page: String(Math.min(per_page, 200)),
    page: String(page),
  }

  // Use /search endpoint when criteria is provided, otherwise list endpoint
  const endpoint = criteria ? '/Candidates/search' : '/Candidates'
  if (criteria) {
    params.criteria = criteria
  }

  const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
    endpoint,
    params
  )

  const candidates = (response.data ?? []).map(transformCandidate)

  return {
    data: candidates,
    pagination: {
      page,
      per_page: response.info?.per_page ?? per_page,
      more_records: response.info?.more_records ?? false,
      count: response.info?.count ?? candidates.length,
    },
  }
}

/**
 * Get candidates filtered by job opening and optionally by status.
 */
export async function getCandidatesByStatus(
  jobOpeningId: string,
  status?: string,
  page = 1,
  perPage = 50
) {
  const parts: string[] = [`(Job_Opening:equals:${jobOpeningId})`]

  if (status) {
    parts.push(`(Candidate_Status:equals:${status})`)
  }

  const criteria = parts.join(' and ')

  return searchCandidates({ criteria, page, per_page: perPage })
}

/**
 * Get count of candidates per status for a specific job opening.
 * Queries each status individually because Zoho doesn't support GROUP BY.
 */
export async function getStatusBreakdown(jobOpeningId: string) {
  const breakdown: Record<string, number> = {}
  let total = 0

  // Fetch all candidates for this job opening and count in memory
  const allCandidates = await fetchAllPages<Record<string, unknown>>(
    '/Candidates/search',
    {
      criteria: `(Job_Opening:equals:${jobOpeningId})`,
      fields: 'Candidate_Status',
    }
  )

  for (const candidate of allCandidates) {
    const status = (candidate.Candidate_Status as string) || 'Unknown'
    breakdown[status] = (breakdown[status] || 0) + 1
    total++
  }

  return { job_opening_id: jobOpeningId, total, by_status: breakdown }
}

/**
 * Get full candidate record by ID.
 */
export async function getCandidateDetail(candidateId: string) {
  const response = await zohoFetch<{ data: Record<string, unknown>[] }>(
    `/Candidates/${candidateId}`
  )

  const raw = response.data?.[0]
  if (!raw) {
    return null
  }

  // Return both transformed and raw data for maximum detail
  return {
    ...transformCandidate(raw),
    raw_fields: raw,
  }
}

// ---------------------------------------------------------------------------
// Job Opening queries
// ---------------------------------------------------------------------------

const DEFAULT_JOB_OPENING_FIELDS = [
  'Job_Opening_Name',
  'Job_Opening_Status',
  'Date_Opened',
  'Client_Name',
  'Account_Manager',
  'No_of_Candidates_Associated',
  'No_of_Candidates_Hired',
  'Number_of_Positions',
  'City',
  'Country',
  'Pa_s_Country',
  'Job_Opening_ID',
  'Posting_Title',
  'Job_Type',
  'Type_of_Contract',
  'Idioma_Principal_Main_Language_Required',
].join(',')

export interface SearchJobOpeningsOptions {
  criteria?: string
  page?: number
  per_page?: number
}

/**
 * Search job openings using Zoho criteria syntax.
 */
export async function searchJobOpenings(options: SearchJobOpeningsOptions = {}) {
  const { criteria, page = 1, per_page = 50 } = options

  const params: Record<string, string> = {
    fields: DEFAULT_JOB_OPENING_FIELDS,
    per_page: String(Math.min(per_page, 200)),
    page: String(page),
  }

  const endpoint = criteria ? '/Job_Openings/search' : '/Job_Openings'
  if (criteria) {
    params.criteria = criteria
  }

  const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
    endpoint,
    params
  )

  const jobOpenings = (response.data ?? []).map(transformJobOpening)

  return {
    data: jobOpenings,
    pagination: {
      page,
      per_page: response.info?.per_page ?? per_page,
      more_records: response.info?.more_records ?? false,
      count: response.info?.count ?? jobOpenings.length,
    },
  }
}

/**
 * Get full job opening record by ID.
 */
export async function getJobOpeningDetail(jobOpeningId: string) {
  const response = await zohoFetch<{ data: Record<string, unknown>[] }>(
    `/Job_Openings/${jobOpeningId}`
  )

  const raw = response.data?.[0]
  if (!raw) {
    return null
  }

  return {
    ...transformJobOpening(raw),
    raw_fields: raw,
  }
}

// ---------------------------------------------------------------------------
// Generic module search
// ---------------------------------------------------------------------------

export async function searchModule(
  module: string,
  criteria: string,
  page = 1,
  perPage = 50
) {
  const params: Record<string, string> = {
    criteria,
    per_page: String(Math.min(perPage, 200)),
    page: String(page),
  }

  const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
    `/${module}/search`,
    params
  )

  return {
    data: response.data ?? [],
    pagination: {
      page,
      per_page: response.info?.per_page ?? perPage,
      more_records: response.info?.more_records ?? false,
      count: response.info?.count ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

/**
 * Get aggregated stats: total candidates, by status, by source.
 * Optionally scoped to a specific job opening.
 */
export async function getAggregatedStats(jobOpeningId?: string) {
  const params: Record<string, string> = {
    fields: 'Candidate_Status,Source,Origin',
  }

  let endpoint: string
  if (jobOpeningId) {
    endpoint = '/Candidates/search'
    params.criteria = `(Job_Opening:equals:${jobOpeningId})`
  } else {
    endpoint = '/Candidates'
  }

  const allCandidates = await fetchAllPages<Record<string, unknown>>(
    endpoint,
    params
  )

  const byStatus: Record<string, number> = {}
  const bySource: Record<string, number> = {}

  for (const candidate of allCandidates) {
    const status = (candidate.Candidate_Status as string) || 'Unknown'
    byStatus[status] = (byStatus[status] || 0) + 1

    const source =
      (candidate.Source as string) || (candidate.Origin as string) || 'Unknown'
    bySource[source] = (bySource[source] || 0) + 1
  }

  return {
    total_candidates: allCandidates.length,
    by_status: byStatus,
    by_source: bySource,
    ...(jobOpeningId ? { job_opening_id: jobOpeningId } : {}),
  }
}
