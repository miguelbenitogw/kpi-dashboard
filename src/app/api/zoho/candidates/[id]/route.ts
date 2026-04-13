import { type NextRequest } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../../sync/middleware'
import { getCandidateDetail } from '@/lib/zoho/direct-queries'

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
        { error: 'Candidate ID is required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const candidate = await getCandidateDetail(id)

    if (!candidate) {
      return Response.json(
        { error: `Candidate ${id} not found` },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    return Response.json({ data: candidate }, { headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { error: `Zoho API error: ${message}` },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
