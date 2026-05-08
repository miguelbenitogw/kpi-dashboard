/**
 * POST /api/admin/sync-zoho-vacancies
 *
 * Manual trigger to sync active job openings from Zoho into Supabase.
 * Protected by Supabase session (dashboard login) — no API key needed.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'
import { syncJobOpenings } from '@/lib/zoho/sync-job-openings'

export const maxDuration = 300

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

  try {
    const result = await syncJobOpenings()
    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.synced,
      api_calls: result.api_calls,
      errors: result.errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
