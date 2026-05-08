/**
 * POST /api/admin/sync-all
 *
 * Manual trigger for the full sync-madre pipeline.
 * Protected by Supabase session (dashboard login), not CRON_SECRET.
 *
 * Runs the same 3 phases as the daily cron:
 *   1. importExcelMadre — Base Datos + Resumen per madre sheet
 *   2. importPromoSheet — all registered promo sheets
 *   3. importPlacement  — Norway Global Placement (years 2025/2026)
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importPromoSheet } from '@/lib/google-sheets/import'
import { importPlacement } from '@/lib/google-sheets/import-placement'

export const maxDuration = 60

export async function POST() {
  // --- Session auth ---
  const client = await createServerSupabaseClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const TIMEOUT_MS = 55_000

  // ---- Load all active madre sheets once -----------------------------------
  const { data: madreSheets, error: madreErr } = await (supabaseAdmin as any)
    .from('madre_sheets_kpi')
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .order('year', { ascending: true })

  if (madreErr) {
    return NextResponse.json({ error: `Failed to fetch madre_sheets_kpi: ${madreErr.message}` }, { status: 500 })
  }

  const sheets = (madreSheets as Array<{ sheet_id: string; label: string; year: number }>) ?? []

  const summary = {
    duration_ms: 0,
    excel_madre: { updated: 0, inserted: 0, errors: 0 },
    promo_sheets: { success: 0, error: 0, skipped: 0 },
    placement:    { updated: 0, inserted: 0, errors: 0 },
    all_errors: [] as string[],
  }

  // ---- Phase 1: Excel Madre ------------------------------------------------
  for (const madre of sheets) {
    try {
      const r = await importExcelMadre(madre.sheet_id)
      summary.excel_madre.updated  += r.baseDatos.updated + r.resumen.upserted
      summary.excel_madre.inserted += r.baseDatos.inserted
      summary.excel_madre.errors   += r.errors.length
      summary.all_errors.push(...r.errors.map((e) => `[ExcelMadre ${madre.label}] ${e}`))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      summary.excel_madre.errors++
      summary.all_errors.push(`[ExcelMadre ${madre.label}] Fatal: ${msg}`)
    }
  }

  // ---- Phase 2: Promo sheets -----------------------------------------------
  const { data: promoSheets } = await (supabaseAdmin as any)
    .from('promo_sheets_kpi')
    .select('id, sheet_url, sheet_name, promocion_nombre, sync_status, group_filter')
    .neq('sync_status', 'disabled')

  for (const sheet of promoSheets ?? []) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      summary.promo_sheets.skipped++
      continue
    }
    if (!sheet.promocion_nombre) { summary.promo_sheets.skipped++; continue }

    try {
      await (supabaseAdmin as any)
        .from('promo_sheets_kpi')
        .update({ sync_status: 'syncing' })
        .eq('id', sheet.id)

      await importPromoSheet(
        sheet.sheet_url,
        sheet.promocion_nombre,
        sheet.sheet_name ?? undefined,
        sheet.group_filter ?? '',
      )
      summary.promo_sheets.success++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      summary.promo_sheets.error++
      summary.all_errors.push(`[PromoSheet ${sheet.sheet_name}] ${msg}`)
      await (supabaseAdmin as any)
        .from('promo_sheets_kpi')
        .update({ sync_status: 'error', sync_error: msg })
        .eq('id', sheet.id)
    }
  }

  // ---- Phase 3: Norway Placement -------------------------------------------
  const norwaySheets = sheets.filter((s) => s.year === 2025 || s.year === 2026)

  for (const madre of norwaySheets) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      summary.placement.skipped = (summary.placement as any).skipped ?? 0
      continue
    }
    try {
      const results = await importPlacement(madre.sheet_id, madre.year)
      for (const r of results) {
        summary.placement.updated  += r.updated
        summary.placement.inserted += r.inserted
        summary.placement.errors   += r.errors.length
        summary.all_errors.push(...r.errors.map((e) => `[Placement ${madre.label}/${r.source}] ${e}`))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      summary.placement.errors++
      summary.all_errors.push(`[Placement ${madre.label}] Fatal: ${msg}`)
    }
  }

  summary.duration_ms = Date.now() - startTime
  const hasErrors = summary.all_errors.length > 0

  return NextResponse.json(
    { success: true, summary, errors: summary.all_errors },
    { status: hasErrors ? 207 : 200 },
  )
}
