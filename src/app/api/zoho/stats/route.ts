import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { getAggregatedStats } from '@/lib/zoho/direct-queries'

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
    const jobOpeningId = searchParams.get('job_opening_id') || undefined

    const stats = await getAggregatedStats(jobOpeningId)

    return Response.json({ data: stats }, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('204') || message.includes('No Content')) {
      return Response.json(
        {
          data: {
            total_candidates: 0,
            by_status: {},
            by_source: {},
          },
        },
        { headers: CORS_HEADERS }
      )
    }

    return Response.json(
      { error: `Zoho API error: ${message}` },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
