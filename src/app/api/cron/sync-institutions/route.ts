import { NextRequest, NextResponse } from 'next/server'
import { importInstitutions } from '@/lib/google-sheets/import-institutions'

export const maxDuration = 300

/**
 * GET /api/cron/sync-institutions
 *
 * Cron route that imports/refreshes institution data from the "BBDD Instituciones"
 * Google Sheet. Syncs all 7 profession tabs into institutions_kpi and
 * institution_contacts_kpi.
 *
 * Protected by CRON_SECRET (same pattern as other cron routes).
 */

const SPREADSHEET_ID = '1Lmw5SIbpobXBySaYEMXYw0YKMy6xP-cTAKm3-n6KPJY'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const { total, byProfesion } = await importInstitutions(SPREADSHEET_ID)

    const hasErrors = total.errors.length > 0

    return NextResponse.json(
      {
        success: true,
        duration_ms: Date.now() - startTime,
        total: {
          inserted: total.inserted,
          updated: total.updated,
          skipped: total.skipped,
          error_count: total.errors.length,
        },
        by_profesion: Object.fromEntries(
          Object.entries(byProfesion).map(([profesion, r]) => [
            profesion,
            {
              inserted: r.inserted,
              updated: r.updated,
              skipped: r.skipped,
              error_count: r.errors.length,
              errors: r.errors,
            },
          ]),
        ),
        errors: total.errors,
      },
      { status: hasErrors ? 207 : 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        success: false,
        duration_ms: Date.now() - startTime,
        error: msg,
      },
      { status: 500 },
    )
  }
}
