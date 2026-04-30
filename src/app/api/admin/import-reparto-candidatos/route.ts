/**
 * Admin endpoint — one-time import of Norway historical
 * "Reparto personas- cliente" tab into candidates_kpi.
 *
 * No auth check — internal admin use only.
 *
 * GET /api/admin/import-reparto-candidatos           → dry-run (default)
 * GET /api/admin/import-reparto-candidatos?dryRun=false → live upsert
 *
 * Response:
 *   { processed, updated, skipped, errors, dryRun, preview: first 20 rows }
 */

import { NextRequest, NextResponse } from 'next/server'
import { importRepartoCandidatos } from '@/lib/google-sheets/import-reparto-candidatos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dryRunParam = req.nextUrl.searchParams.get('dryRun')
  // Default to dry-run unless explicitly set to "false"
  const dryRun = dryRunParam !== 'false'

  try {
    const result = await importRepartoCandidatos(dryRun)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
