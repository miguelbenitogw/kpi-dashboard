import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importPromoSheet } from '@/lib/google-sheets/import'

export const maxDuration = 60

/**
 * GET /api/cron/sync-sheets
 *
 * Cron-triggered route that syncs ALL registered Google Sheets.
 * Protected by CRON_SECRET (same pattern as existing cron routes).
 * Processes sheets sequentially with early exit if time is running out.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const TIMEOUT_MS = 50_000 // Stop processing at 50s to leave margin for the 60s limit

  try {
    // Fetch all sheets that are not disabled
    const { data: sheets, error } = await supabaseAdmin
      .from('promo_sheets')
      .select('id, sheet_url, sheet_name, job_opening_id, sync_status')
      .neq('sync_status', 'disabled')

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch sheets: ${error.message}` },
        { status: 500 }
      )
    }

    if (!sheets || sheets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sheets to sync',
        sheets_synced: 0,
      })
    }

    const results: Array<{
      sheet_name: string | null
      status: 'success' | 'error' | 'skipped'
      imported?: number
      error?: string
    }> = []

    for (const sheet of sheets) {
      // Early exit if we're running out of time
      if (Date.now() - startTime > TIMEOUT_MS) {
        results.push({
          sheet_name: sheet.sheet_name,
          status: 'skipped',
          error: 'Timeout: skipped to stay within execution limit',
        })
        continue
      }

      if (!sheet.job_opening_id) {
        results.push({
          sheet_name: sheet.sheet_name,
          status: 'skipped',
          error: 'No job_opening_id linked',
        })
        continue
      }

      try {
        // Mark as syncing
        await supabaseAdmin
          .from('promo_sheets')
          .update({ sync_status: 'syncing' })
          .eq('id', sheet.id)

        const importResult = await importPromoSheet(
          sheet.sheet_url,
          sheet.job_opening_id,
          sheet.sheet_name ?? undefined
        )

        results.push({
          sheet_name: sheet.sheet_name,
          status: 'success',
          imported: importResult.imported,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)

        // Update sheet with error status
        await supabaseAdmin
          .from('promo_sheets')
          .update({
            sync_status: 'error',
            sync_error: msg,
          })
          .eq('id', sheet.id)

        results.push({
          sheet_name: sheet.sheet_name,
          status: 'error',
          error: msg,
        })
      }
    }

    const succeeded = results.filter((r) => r.status === 'success').length
    const failed = results.filter((r) => r.status === 'error').length
    const skipped = results.filter((r) => r.status === 'skipped').length

    return NextResponse.json(
      {
        success: true,
        sheets_total: sheets.length,
        sheets_synced: succeeded,
        sheets_failed: failed,
        sheets_skipped: skipped,
        duration_ms: Date.now() - startTime,
        results,
      },
      { status: failed > 0 ? 207 : 200 }
    )
  } catch (error) {
    console.error('[cron/sync-sheets] Fatal error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
