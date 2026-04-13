import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { searchModule } from '@/lib/zoho/direct-queries'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

const ALLOWED_MODULES = ['Candidates', 'Job_Openings'] as const

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const module = searchParams.get('module')
    const criteria = searchParams.get('criteria')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)))

    if (!module) {
      return Response.json(
        { error: 'Query parameter "module" is required. Allowed: Candidates, Job_Openings' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Normalize module name: accept "JobOpenings" as alias for "Job_Openings"
    const normalizedModule = module === 'JobOpenings' ? 'Job_Openings' : module

    if (!ALLOWED_MODULES.includes(normalizedModule as typeof ALLOWED_MODULES[number])) {
      return Response.json(
        { error: `Invalid module "${module}". Allowed: Candidates, Job_Openings (or JobOpenings)` },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!criteria) {
      return Response.json(
        { error: 'Query parameter "criteria" is required. Use Zoho criteria syntax, e.g. (Field_Name:equals:value)' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const result = await searchModule(normalizedModule, criteria, page, perPage)

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
