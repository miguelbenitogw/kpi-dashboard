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

    return (await response.json()) as T
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
