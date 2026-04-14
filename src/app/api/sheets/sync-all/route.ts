import { NextResponse } from 'next/server'
import { syncAllPromoSheets } from '@/lib/google-sheets/import'

/**
 * POST /api/sheets/sync-all
 *
 * Triggers a sync for all active promo sheets.
 * Called from the dashboard UI (internal route).
 */
export async function POST() {
  try {
    const results = await syncAllPromoSheets()

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0)
    const totalErrors = results.flatMap((r) => r.errors)

    return NextResponse.json({
      success: true,
      sheets_synced: results.length,
      total_imported: totalImported,
      total_errors: totalErrors.length,
      results: results.map((r) => ({
        sheet_name: r.sheet_name,
        imported: r.imported,
        errors: r.errors,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
