import { getAccessToken } from './auth'

interface ZohoPageInfo {
  more_records: boolean
  per_page: number
  count: number
  page: number
}

interface ZohoListResponse<T> {
  data: T[]
  info: ZohoPageInfo
}

const RATE_LIMIT_DELAY_MS = 200
const MAX_PER_PAGE = 200

function getApiBaseUrl(): string {
  const url = process.env.ZOHO_API_BASE_URL
  if (!url) {
    throw new Error('Missing env var: ZOHO_API_BASE_URL')
  }
  return url.replace(/\/$/, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function zohoFetch<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const token = await getAccessToken()
  const baseUrl = getApiBaseUrl()

  const url = new URL(`${baseUrl}${endpoint}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Zoho API error ${response.status} on ${endpoint}: ${body}`)
    }

    // Handle 204 No Content or empty body gracefully
    if (response.status === 204) {
      return { data: [], info: { more_records: false, per_page: 0, count: 0, page: 1 } } as T
    }

    const text = await response.text()
    if (!text || text.trim().length === 0) {
      console.warn(`[zohoFetch] Empty response body for ${endpoint}, returning empty data`)
      return { data: [], info: { more_records: false, per_page: 0, count: 0, page: 1 } } as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      console.warn(`[zohoFetch] Malformed JSON for ${endpoint}: ${text.slice(0, 200)}`)
      return { data: [], info: { more_records: false, per_page: 0, count: 0, page: 1 } } as T
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Zoho API error')) {
      throw error
    }
    throw new Error(
      `Zoho API request failed for ${endpoint}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function fetchAllPages<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T[]> {
  const allItems: T[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const pageParams: Record<string, string> = {
      ...params,
      per_page: String(MAX_PER_PAGE),
      page: String(page),
    }

    try {
      const response = await zohoFetch<ZohoListResponse<T>>(endpoint, pageParams)

      if (response.data && response.data.length > 0) {
        allItems.push(...response.data)
      }

      hasMore = response.info?.more_records ?? false
      page++

      if (hasMore) {
        await sleep(RATE_LIMIT_DELAY_MS)
      }
    } catch (error) {
      // If we get a "no data" response (204 or empty), stop pagination
      if (
        error instanceof Error &&
        (error.message.includes('204') || error.message.includes('No Content'))
      ) {
        break
      }
      throw error
    }
  }

  return allItems
}

const CANDIDATE_FIELDS = [
  'Full_Name',
  'Email',
  'Phone',
  'Candidate_Status',
  'Candidate_Stage',
  'Candidate_Owner',
  'Source',
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
  'Origin',
  'Associated_Tags',
  'Country',
].join(',')

export async function fetchCandidates(
  modifiedSince?: string
): Promise<Record<string, unknown>[]> {
  const params: Record<string, string> = {
    fields: CANDIDATE_FIELDS,
  }

  if (modifiedSince) {
    params.criteria = `(Modified_Time:greater_than:${modifiedSince})`
  }

  try {
    return await fetchAllPages<Record<string, unknown>>('/Candidates', params)
  } catch (error) {
    throw new Error(
      `Failed to fetch candidates: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

const JOB_OPENING_FIELDS = [
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
  'Job_Description',
  'Associated_Tags',
  'Publish',
  'Keep_on_Career_Site',
].join(',')

export async function fetchJobOpenings(): Promise<Record<string, unknown>[]> {
  try {
    return await fetchAllPages<Record<string, unknown>>('/Job_Openings', {
      fields: JOB_OPENING_FIELDS,
    })
  } catch (error) {
    throw new Error(
      `Failed to fetch job openings: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export interface CandidatesPageResult {
  candidates: Record<string, unknown>[]
  more_records: boolean
  page: number
  total_count?: number
}

export async function fetchCandidatesPage(
  page: number,
  modifiedSince?: string
): Promise<CandidatesPageResult> {
  const params: Record<string, string> = {
    fields: CANDIDATE_FIELDS,
    per_page: String(MAX_PER_PAGE),
    page: String(page),
  }

  if (modifiedSince) {
    params.criteria = `(Modified_Time:greater_than:${modifiedSince})`
  }

  try {
    const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
      '/Candidates',
      params
    )

    return {
      candidates: response.data ?? [],
      more_records: response.info?.more_records ?? false,
      page,
      total_count: response.info?.count,
    }
  } catch (error) {
    // If we get a "no data" response (204 or empty), return empty
    if (
      error instanceof Error &&
      (error.message.includes('204') || error.message.includes('No Content'))
    ) {
      return { candidates: [], more_records: false, page, total_count: 0 }
    }
    throw new Error(
      `Failed to fetch candidates page ${page}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function fetchCandidatesByJobOpening(
  jobOpeningId: string,
  page: number = 1
): Promise<CandidatesPageResult> {
  // The /associate endpoint only supports: page, per_page, candidate_statuses, posting_title
  // It does NOT support the "fields" parameter (causes 400 error)
  const params: Record<string, string> = {
    per_page: String(MAX_PER_PAGE),
    page: String(page),
  }

  try {
    // Zoho Recruit "Get Associated Records" endpoint:
    // GET /Job_Openings/{id}/associate
    // TESTED: Only /Job_Openings (plural, underscore) + /associate works
    // Docs: https://www.zoho.com/recruit/developer-guide/apiv2/get-associated-records.html
    const response = await zohoFetch<ZohoListResponse<Record<string, unknown>>>(
      `/Job_Openings/${jobOpeningId}/associate`,
      params
    )

    return {
      candidates: response.data ?? [],
      more_records: response.info?.more_records ?? false,
      page,
      total_count: response.info?.count,
    }
  } catch (error) {
    // If we get a "no data" response (204 or empty), return empty
    if (
      error instanceof Error &&
      (error.message.includes('204') || error.message.includes('No Content'))
    ) {
      return { candidates: [], more_records: false, page, total_count: 0 }
    }
    throw new Error(
      `Failed to fetch candidates for job opening ${jobOpeningId}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function fetchAllCandidatesByJobOpening(
  jobOpeningId: string
): Promise<Record<string, unknown>[]> {
  const allCandidates: Record<string, unknown>[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const result = await fetchCandidatesByJobOpening(jobOpeningId, page)
    allCandidates.push(...result.candidates)
    hasMore = result.more_records
    page++

    if (hasMore) {
      await sleep(RATE_LIMIT_DELAY_MS)
    }
  }

  return allCandidates
}

export async function fetchCandidatesByJobOpenings(
  jobOpeningIds: string[]
): Promise<{ candidates: Record<string, unknown>[]; apiCalls: number }> {
  const allCandidates: Record<string, unknown>[] = []
  let apiCalls = 0

  for (const jobOpeningId of jobOpeningIds) {
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await fetchCandidatesByJobOpening(jobOpeningId, page)
      apiCalls++
      allCandidates.push(...result.candidates)
      hasMore = result.more_records
      page++

      // Rate limit: 200ms between calls
      await sleep(RATE_LIMIT_DELAY_MS)
    }
  }

  return { candidates: allCandidates, apiCalls }
}

export async function fetchCandidateNotes(
  candidateId: string
): Promise<Record<string, unknown>[]> {
  try {
    const response = await zohoFetch<{ data: Record<string, unknown>[] }>(
      `/Candidates/${candidateId}/Notes`
    )
    return response.data || []
  } catch (error) {
    throw new Error(
      `Failed to fetch notes for candidate ${candidateId}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
