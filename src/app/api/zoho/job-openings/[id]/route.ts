import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../../sync/middleware'
import { getJobOpeningDetail, getStatusBreakdown } from '@/lib/zoho/direct-queries'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const { id } = await params

    if (!id) {
      return Response.json(
        { error: 'Job Opening ID is required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const jobOpening = await getJobOpeningDetail(id)

    if (!jobOpening) {
      return Response.json(
        { error: `Job Opening ${id} not found` },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    // Optionally include candidate breakdown
    const includeBreakdown = request.nextUrl.searchParams.get('include_candidates') === 'true'
    let candidateBreakdown = null

    if (includeBreakdown) {
      try {
        candidateBreakdown = await getStatusBreakdown(id)
      } catch {
        // Non-fatal: return job opening without breakdown
        candidateBreakdown = null
      }
    }

    return Response.json(
      {
        data: jobOpening,
        ...(candidateBreakdown ? { candidate_breakdown: candidateBreakdown } : {}),
      },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { error: `Zoho API error: ${message}` },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
