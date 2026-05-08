/**
 * POST /api/sheets/import-placement
 *
 * Manual trigger for the Norway Global Placement import pipeline.
 * Reads all active madre_sheets_kpi rows where year IN (2025, 2026),
 * runs importPlacement() for each, and returns a breakdown by sheet+source.
 *
 * Auth: Bearer ${CRON_SECRET} in Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { importPlacement, PlacementImportResult } from '@/lib/google-sheets/import-placement'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // --- Auth ---
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  // --- Fetch Norway madre sheets (year 2025 or 2026) ---
  const { data: madreSheets, error: sheetsError } = await (supabaseAdmin as any)
    .from('madre_sheets_kpi')
    .select('sheet_id, label, year')
    .eq('is_active', true)
    .in('year', [2025, 2026])
    .order('year', { ascending: true })

  if (sheetsError) {
    return NextResponse.json(
      { error: `Failed to fetch madre_sheets_kpi: ${sheetsError.message}` },
      { status: 500 },
    )
  }

  const sheets = (madreSheets as Array<{ sheet_id: string; label: string; year: number }>) ?? []

  if (sheets.length === 0) {
    return NextResponse.json(
      { success: true, duration_ms: Date.now() - startTime, results: [], message: 'No active Norway sheets found' },
      { status: 200 },
    )
  }

  // --- Run import for each sheet ---
  const allResults: Array<{
    label: string
    year: number
    results: PlacementImportResult[]
    error?: string
  }> = []

  for (const madre of sheets) {
    try {
      const results = await importPlacement(madre.sheet_id, madre.year)
      allResults.push({ label: madre.label, year: madre.year, results })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      allResults.push({
        label: madre.label,
        year: madre.year,
        results: [],
        error: `Fatal: ${msg}`,
      })
    }
  }

  // --- Summary stats ---
  const totalUpdated  = allResults.flatMap((s) => s.results).reduce((n, r) => n + r.updated, 0)
  const totalInserted = allResults.flatMap((s) => s.results).reduce((n, r) => n + r.inserted, 0)
  const totalSkipped  = allResults.flatMap((s) => s.results).reduce((n, r) => n + r.skipped, 0)
  const allErrors     = allResults.flatMap((s) => [...s.results.flatMap((r) => r.errors), ...(s.error ? [s.error] : [])])

  const hasErrors = allErrors.length > 0

  return NextResponse.json(
    {
      success: true,
      duration_ms: Date.now() - startTime,
      summary: {
        sheets_processed: sheets.length,
        total_updated:    totalUpdated,
        total_inserted:   totalInserted,
        total_skipped:    totalSkipped,
        total_errors:     allErrors.length,
      },
      results: allResults,
    },
    { status: hasErrors ? 207 : 200 },
  )
}
