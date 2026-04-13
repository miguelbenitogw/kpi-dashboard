import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { searchCandidates, getCandidatesByStatus } from '@/lib/zoho/direct-queries'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const jobOpeningId = searchParams.get('job_opening_id')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)))
    const search = searchParams.get('search')

    // Build criteria based on query params
    if (jobOpeningId) {
      const result = await getCandidatesByStatus(jobOpeningId, status || undefined, page, perPage)
      return Response.json(result, { headers: CORS_HEADERS })
    }

    const criteriaParts: string[] = []

    if (status) {
      criteriaParts.push(`(Candidate_Status:equals:${status})`)
    }

    if (search) {
      criteriaParts.push(`(Full_Name:contains:${search})`)
    }

    const criteria = criteriaParts.length > 0 ? criteriaParts.join(' and ') : undefined

    const result = await searchCandidates({ criteria, page, per_page: perPage })

    return Response.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    // Handle Zoho-specific errors
    if (message.includes('204') || message.includes('No Content')) {
      return Response.json(
        { data: [], pagination: { page: 1, per_page: 50, more_records: false, count: 0 } },
        { headers: CORS_HEADERS }
      )
    }

    return Response.json(
      { error: `Zoho API error: ${message}` },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
