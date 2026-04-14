import { type NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { importPromoSheet, importDropoutsTab } from '@/lib/google-sheets/import'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

interface ImportRequestBody {
  sheet_url: string
  job_opening_id: string
  sheet_name?: string
  /** When set to 'dropouts', uses the dedicated Dropouts tab import pipeline */
  tab?: 'dropouts' | 'all'
}

/**
 * POST /api/sheets/import
 *
 * Registers a new Google Sheet and imports all candidates from it.
 *
 * Body: { sheet_url: string, job_opening_id: string, sheet_name?: string }
 *
 * Returns: { imported, matched_to_zoho, tabs_found, errors }
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  let body: ImportRequestBody
  try {
    body = (await request.json()) as ImportRequestBody
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { sheet_url, job_opening_id, sheet_name, tab } = body

  if (!sheet_url || typeof sheet_url !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: sheet_url' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (!job_opening_id || typeof job_opening_id !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: job_opening_id' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  try {
    const result = tab === 'dropouts'
      ? await importDropoutsTab(sheet_url, job_opening_id, sheet_name)
      : await importPromoSheet(sheet_url, job_opening_id, sheet_name)

    return NextResponse.json(
      {
        success: true,
        imported: result.imported,
        matched_to_zoho: result.matched_to_zoho,
        tabs_found: result.tabs_found,
        errors: result.errors,
      },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
