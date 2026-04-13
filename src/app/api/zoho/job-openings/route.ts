import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { searchJobOpenings } from '@/lib/zoho/direct-queries'

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
    const status = searchParams.get('status') // open, closed, all
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)))

    const criteriaParts: string[] = []

    if (status && status !== 'all') {
      if (status === 'open') {
        criteriaParts.push('(Job_Opening_Status:in:In-progress,Open)')
      } else if (status === 'closed') {
        criteriaParts.push('(Job_Opening_Status:equals:Closed)')
      } else {
        // Allow arbitrary status values
        criteriaParts.push(`(Job_Opening_Status:equals:${status})`)
      }
    }

    if (search) {
      criteriaParts.push(`(Job_Opening_Name:contains:${search})`)
    }

    const criteria = criteriaParts.length > 0 ? criteriaParts.join(' and ') : undefined

    const result = await searchJobOpenings({ criteria, page, per_page: perPage })

    return Response.json(result, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

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
