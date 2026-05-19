/**
 * POST /api/sheets/import-pagos
 * Manual trigger for the Pagos importer. Runs against all active madre sheets
 * (or a specific sheetId if provided in the body).
 *
 * Body (optional): { sheetId?: string }
 * Returns detailed per-sheet results including errors.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importPagos } from '@/lib/google-sheets/import-pagos'
import { validateApiKey, unauthorizedResponse } from '@/app/api/sync/middleware'

export const maxDuration = 120

export async function POST(req: Request) {
  if (!validateApiKey(req)) return unauthorizedResponse()
  let customSheetId: string | undefined

  try {
    const body = await req.json().catch(() => ({}))
    customSheetId = body?.sheetId
  } catch {
    // ignore parse errors
  }

  // Fetch sheets to process
  let sheetIds: Array<{ id: string; label: string }>

  if (customSheetId) {
    sheetIds = [{ id: customSheetId, label: 'custom' }]
  } else {
    const { data, error } = await supabaseAdmin
      .from('madre_sheets_kpi')
      .select('sheet_id, label')
      .eq('is_active', true)
      .order('label', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    sheetIds = (data ?? []).map((r: { sheet_id: string; label: string }) => ({
      id: r.sheet_id,
      label: r.label,
    }))
  }

  const results: Array<{
    label: string
    sheetId: string
    updated: number
    inserted: number
    skipped: number
    errors: string[]
  }> = []

  for (const sheet of sheetIds) {
    try {
      const res = await importPagos(sheet.id)
      results.push({
        label: sheet.label,
        sheetId: sheet.id,
        ...res,
      })
    } catch (err: unknown) {
      results.push({
        label: sheet.label,
        sheetId: sheet.id,
        updated: 0,
        inserted: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      })
    }
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0)
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0)

  return NextResponse.json({
    sheets: results.length,
    totalInserted,
    totalUpdated,
    totalErrors,
    results,
  })
}
