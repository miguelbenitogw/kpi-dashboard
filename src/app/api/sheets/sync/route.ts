import { type NextRequest, NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { syncAllPromoSheets } from '@/lib/google-sheets/import'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/sheets/sync
 *
 * Re-syncs all registered promo sheets from Google Sheets.
 * Re-fetches all tabs, re-parses rows, re-attempts Zoho matching,
 * and upserts updated records into promo_students.
 *
 * Returns: array of per-sheet sync results.
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  try {
    const results = await syncAllPromoSheets()

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0)
    const totalMatched = results.reduce((sum, r) => sum + r.matched_to_zoho, 0)
    const totalErrors = results.flatMap((r) => r.errors)

    return NextResponse.json(
      {
        success: true,
        sheets_synced: results.length,
        total_imported: totalImported,
        total_matched_to_zoho: totalMatched,
        total_errors: totalErrors.length,
        results,
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
