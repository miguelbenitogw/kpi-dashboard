import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
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
 * Imports the Global Placement tab from all active Excel madre sheets.
 * Updates gp_* fields (gp_training_status, gp_open_to, etc.) on candidates.
 * Protected by x-api-key (SYNC_API_KEY env var).
 */
export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  try {
    const { data: madreSheets } = await supabaseAdmin
      .from('madre_sheets_kpi' as any)
      .select('sheet_id, label')
      .eq('is_active', true)
      .order('year', { ascending: true })

    let updated = 0
    let skipped = 0
    let notMatched = 0
    const errors: string[] = []

    for (const madre of (madreSheets as Array<{ sheet_id: string; label: string }> | null) ?? []) {
      const result = await importGlobalPlacement(madre.sheet_id)
      updated += result.updated
      skipped += result.skipped
      notMatched += result.notMatched
      errors.push(...result.errors)
    }

    return NextResponse.json(
      {
        success: true,
        updated,
        skipped,
        not_matched: notMatched,
        errors,
      },
      { status: errors.length > 0 ? 207 : 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: message },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
