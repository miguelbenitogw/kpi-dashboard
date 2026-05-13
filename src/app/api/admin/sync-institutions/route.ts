/**
 * POST /api/admin/sync-institutions
 *
 * Manual trigger to sync institution data from the "BBDD Instituciones"
 * Google Sheet into institutions_kpi + institution_contacts_kpi.
 * Protected by Supabase session (dashboard login).
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { importInstitutions } from '@/lib/google-sheets/import-institutions'

export const maxDuration = 300

const SPREADSHEET_ID = '1Lmw5SIbpobXBySaYEMXYw0YKMy6xP-cTAKm3-n6KPJY'

async function requireAuth(): Promise<boolean> {
  try {
    const client = await createServerSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

export async function POST() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const { total, byProfesion } = await importInstitutions(SPREADSHEET_ID)

    return NextResponse.json({
      success: true,
      duration_ms: Date.now() - startTime,
      total: {
        inserted: total.inserted,
        updated: total.updated,
        skipped: total.skipped,
        errors: total.errors.length,
      },
      by_profesion: Object.fromEntries(
        Object.entries(byProfesion).map(([prof, r]) => [
          prof,
          { inserted: r.inserted, updated: r.updated, skipped: r.skipped, errors: r.errors.length },
        ]),
      ),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, duration_ms: Date.now() - startTime, error: message },
      { status: 500 },
    )
  }
}
