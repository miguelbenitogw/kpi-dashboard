import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importPromoSheet } from '@/lib/google-sheets/import'
import { importPlacement, PlacementImportResult } from '@/lib/google-sheets/import-placement'

export const maxDuration = 300

/**
 * GET /api/cron/sync-madre
 *
 * Daily cron route that:
 *   1. Imports/refreshes data from the Excel madre sheet (Base Datos + Resumen)
 *   2. Re-syncs all registered promo sheets (promo_sheets table)
 *   3. Imports Global Placement for active years
 *
 * maxDuration = 300s (Vercel Pro cron limit). No internal timeout — the full
 * pipeline is allowed to run to completion within that window.
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
    promo_sheets: Array<{
      sheet_name: string | null
      status: 'success' | 'error' | 'skipped'
      imported?: number
      error?: string
    }>
    placement: Array<{
      label: string
      year: number
      results: PlacementImportResult[]
      error?: string
    }>
  } = {
    excel_madre: [],
    promo_sheets: [],
    placement: [],
  }

  // ---- Phase 1: Excel madre import (all active sheets) --------------------
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

  // ---- Phase 2: Re-sync all registered promo sheets -----------------------
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

  // ---- Phase 3: Norway Global Placement import (years 2025 + 2026) --------
  const norwaySheets = (madreSheets as Array<{ sheet_id: string; label: string; year: number }> | null)
    ?.filter((s) => s.year === 2025 || s.year === 2026) ?? []

  for (const madre of norwaySheets) {
    try {
      const placementResults = await importPlacement(madre.sheet_id, madre.year)
      results.placement.push({ label: madre.label, year: madre.year, results: placementResults })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.placement.push({ label: madre.label, year: madre.year, results: [], error: `Fatal: ${msg}` })
    }
  }

  const hasErrors =
    results.excel_madre.some((m) => m.errors.length > 0) ||
    results.promo_sheets.some((r) => r.status === 'error') ||
    results.placement.some((p) => p.error != null || p.results.some((r) => r.errors.length > 0))

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      ...results,
    },
    { status: hasErrors ? 207 : 200 }
  )
}
