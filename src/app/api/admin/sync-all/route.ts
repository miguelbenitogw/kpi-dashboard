/**
 * POST /api/admin/sync-all?phase=excel-madre|promo-sheets|placement
 *
 * Manual trigger for the full sync pipeline, split into 3 independent calls
 * so each one fits within the 60s Vercel function limit.
 *
 * Protected by Supabase session (dashboard login).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importExcelMadre } from '@/lib/google-sheets/import-madre'
import { importPromoSheet } from '@/lib/google-sheets/import'
import { importPlacement } from '@/lib/google-sheets/import-placement'

export const maxDuration = 300

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------
async function requireAuth(): Promise<boolean> {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Phase result type
// ---------------------------------------------------------------------------
export interface PhaseSummary {
  phase: string
  duration_ms: number
  updated: number
  inserted: number
  errors: number
  skipped: number
  all_errors: string[]
}

// ---------------------------------------------------------------------------
// Phase 1 — Excel Madre
// ---------------------------------------------------------------------------
async function runExcelMadre(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'excel-madre', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('madre_sheets_kpi')
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .order('year', { ascending: true })

  if (error) { s.all_errors.push(`Failed to fetch madre_sheets_kpi: ${error.message}`); s.errors++; s.duration_ms = Date.now() - t0; return s }

  for (const madre of (sheets ?? [])) {
    try {
      const r = await importExcelMadre(madre.sheet_id)
      s.updated  += r.baseDatos.updated + r.resumen.upserted
      s.inserted += r.baseDatos.inserted
      s.errors   += r.errors.length
      s.all_errors.push(...r.errors.map((e: string) => `[${madre.label}] ${e}`))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.errors++
      s.all_errors.push(`[${madre.label}] Fatal: ${msg}`)
    }
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 2 — Promo Sheets
// ---------------------------------------------------------------------------
async function runPromoSheets(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'promo-sheets', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()
  const TIMEOUT_MS = 270_000

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('promo_sheets_kpi')
    .select('id, sheet_url, sheet_name, promocion_nombre, sync_status, group_filter')
    .neq('sync_status', 'disabled')

  if (error) { s.all_errors.push(`Failed to fetch promo_sheets_kpi: ${error.message}`); s.errors++; s.duration_ms = Date.now() - t0; return s }

  for (const sheet of (sheets ?? [])) {
    if (Date.now() - t0 > TIMEOUT_MS) { s.skipped++; continue }
    if (!sheet.promocion_nombre) { s.skipped++; continue }

    try {
      await (supabaseAdmin as any).from('promo_sheets_kpi').update({ sync_status: 'syncing' }).eq('id', sheet.id)
      const r = await importPromoSheet(sheet.sheet_url, sheet.promocion_nombre, sheet.sheet_name ?? undefined, sheet.group_filter ?? '')
      s.inserted += r.imported ?? 0
      s.updated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.errors++
      s.all_errors.push(`[${sheet.sheet_name}] ${msg}`)
      await (supabaseAdmin as any).from('promo_sheets_kpi').update({ sync_status: 'error', sync_error: msg }).eq('id', sheet.id)
    }
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Phase 3 — Norway Placement
// ---------------------------------------------------------------------------
async function runPlacement(): Promise<PhaseSummary> {
  const s: PhaseSummary = { phase: 'placement', duration_ms: 0, updated: 0, inserted: 0, errors: 0, skipped: 0, all_errors: [] }
  const t0 = Date.now()

  const { data: sheets, error } = await (supabaseAdmin as any)
    .from('madre_sheets_kpi')
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .in('year', [2025, 2026])
    .order('year', { ascending: true })

  if (error) { s.all_errors.push(`Failed to fetch madre_sheets_kpi: ${error.message}`); s.errors++; s.duration_ms = Date.now() - t0; return s }

  for (const madre of (sheets ?? [])) {
    try {
      const results = await importPlacement(madre.sheet_id, madre.year)
      for (const r of results) {
        s.updated  += r.updated
        s.inserted += r.inserted
        s.errors   += r.errors.length
        s.all_errors.push(...r.errors.map((e) => `[${madre.label}/${r.source}] ${e}`))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.errors++
      s.all_errors.push(`[${madre.label}] Fatal: ${msg}`)
    }
  }

  s.duration_ms = Date.now() - t0
  return s
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const phase = new URL(req.url).searchParams.get('phase') ?? 'excel-madre'

    let result: PhaseSummary
    if (phase === 'excel-madre')   result = await runExcelMadre()
    else if (phase === 'promo-sheets') result = await runPromoSheets()
    else if (phase === 'placement')    result = await runPlacement()
    else return NextResponse.json({ error: `Unknown phase: ${phase}` }, { status: 400 })

    return NextResponse.json(result, { status: result.errors > 0 ? 207 : 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-all] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
