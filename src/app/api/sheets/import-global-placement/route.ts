import { type NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/sheets/import-global-placement
 *
 * Imports the Global Placement tab from the Excel madre Google Sheet.
 * Updates gp_* fields (gp_training_status, gp_open_to, etc.) on candidates.
 * Protected by x-api-key (SYNC_API_KEY env var).
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  try {
    const result = await importGlobalPlacement()

    return NextResponse.json(
      {
        success: true,
        updated: result.updated,
        skipped: result.skipped,
        not_matched: result.notMatched,
        errors: result.errors,
      },
      { status: result.errors.length > 0 ? 207 : 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
