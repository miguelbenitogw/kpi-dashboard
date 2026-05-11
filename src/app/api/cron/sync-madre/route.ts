import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'

export const maxDuration = 300

/**
 * GET /api/cron/sync-madre
 *
 * Daily cron route that imports/refreshes data from the Excel madre sheet
 * (Base Datos + Resumen) for all active madre sheets.
 *
 * Promo sheets are now handled by /api/cron/sync-promo-sheets.
 * Norway placement is handled by /api/cron/sync-placement.
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

  const results: {
    excel_madre: Array<{
      label: string
      base_datos: { updated: number; inserted: number; skipped: number } | null
      resumen: { upserted: number; skipped: number } | null
      errors: string[]
    }>
  } = {
    excel_madre: [],
  }

  // ---- Excel madre import (all active sheets) --------------------------------
  const { data: madreSheets } = await supabaseAdmin
    .from('madre_sheets_kpi' as any)
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .order('year', { ascending: true })

  for (const madre of (madreSheets as Array<{ sheet_id: string; label: string; year: number }> | null) ?? []) {
    try {
      const madreResult = await importExcelMadre(madre.sheet_id)
      results.excel_madre.push({
        label: madre.label,
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
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.excel_madre.push({ label: madre.label, base_datos: null, resumen: null, errors: [`Fatal: ${msg}`] })
    }
  }

  const hasErrors = results.excel_madre.some((m) => m.errors.length > 0)

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      ...results,
    },
    { status: hasErrors ? 207 : 200 }
  )
}
