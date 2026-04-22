import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importPromoSheet } from '@/lib/google-sheets/import'
import { importGlobalPlacement } from '@/lib/google-sheets/import-global-placement'

export const maxDuration = 60

/**
 * GET /api/cron/sync-madre
 *
 * Daily cron route that:
 *   1. Imports/refreshes data from the Excel madre sheet (Base Datos + Resumen)
 *   2. Re-syncs all registered promo sheets (promo_sheets table)
 *
 * Protected by CRON_SECRET (same pattern as existing cron routes).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const TIMEOUT_MS = 50_000

  const results: {
    excel_madre: {
      base_datos: { updated: number; inserted: number; skipped: number } | null
      resumen: { upserted: number; skipped: number } | null
      errors: string[]
    }
    global_placement: {
      updated: number
      skipped: number
      not_matched: number
      errors: string[]
    }
    promo_sheets: Array<{
      sheet_name: string | null
      status: 'success' | 'error' | 'skipped'
      imported?: number
      error?: string
    }>
  } = {
    excel_madre: { base_datos: null, resumen: null, errors: [] },
    global_placement: { updated: 0, skipped: 0, not_matched: 0, errors: [] },
    promo_sheets: [],
  }

  // ---- Phase 1: Excel madre import ----------------------------------------
  try {
    const madreResult = await importExcelMadre()

    results.excel_madre = {
      base_datos: {
        updated: madreResult.baseDatos.updated,
        inserted: madreResult.baseDatos.inserted,
        skipped: madreResult.baseDatos.skipped,
      },
      resumen: {
        upserted: madreResult.resumen.upserted,
        skipped: madreResult.resumen.skipped,
      },
      errors: madreResult.errors,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.excel_madre.errors.push(`Fatal: ${msg}`)
  }

  // ---- Phase 2: Global Placement tab import --------------------------------
  try {
    const gpResult = await importGlobalPlacement()
    results.global_placement = {
      updated: gpResult.updated,
      skipped: gpResult.skipped,
      not_matched: gpResult.notMatched,
      errors: gpResult.errors,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    results.global_placement.errors.push(`Fatal: ${msg}`)
  }

  // ---- Phase 3: Re-sync all registered promo sheets -----------------------
  const { data: sheets, error: sheetsError } = await (supabaseAdmin
    .from('promo_sheets_kpi') as any)
    .select('id, sheet_url, sheet_name, promocion_nombre, sync_status, group_filter')
    .neq('sync_status', 'disabled')

  if (sheetsError) {
    results.promo_sheets.push({
      sheet_name: null,
      status: 'error',
      error: `Failed to fetch sheets: ${sheetsError.message}`,
    })
  } else if (sheets && sheets.length > 0) {
    for (const sheet of sheets) {
      // Early exit if running out of time
      if (Date.now() - startTime > TIMEOUT_MS) {
        results.promo_sheets.push({
          sheet_name: sheet.sheet_name,
          status: 'skipped',
          error: 'Timeout: skipped to stay within execution limit',
        })
        continue
      }

      if (!sheet.promocion_nombre) {
        results.promo_sheets.push({
          sheet_name: sheet.sheet_name,
          status: 'skipped',
          error: 'No promocion_nombre linked',
        })
        continue
      }

      try {
        await supabaseAdmin
          .from('promo_sheets_kpi')
          .update({ sync_status: 'syncing' })
          .eq('id', sheet.id)

        const importResult = await importPromoSheet(
          sheet.sheet_url,
          sheet.promocion_nombre,
          sheet.sheet_name ?? undefined,
          sheet.group_filter ?? '',
        )

        results.promo_sheets.push({
          sheet_name: sheet.sheet_name,
          status: 'success',
          imported: importResult.imported,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)

        await supabaseAdmin
          .from('promo_sheets_kpi')
          .update({ sync_status: 'error', sync_error: msg })
          .eq('id', sheet.id)

        results.promo_sheets.push({
          sheet_name: sheet.sheet_name,
          status: 'error',
          error: msg,
        })
      }
    }
  }

  const hasErrors =
    results.excel_madre.errors.length > 0 ||
    results.global_placement.errors.length > 0 ||
    results.promo_sheets.some((r) => r.status === 'error')

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      ...results,
    },
    { status: hasErrors ? 207 : 200 }
  )
}
