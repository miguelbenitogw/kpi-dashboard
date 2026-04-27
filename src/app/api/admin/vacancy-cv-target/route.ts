import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'

type Payload = {
  vacancyId?: string
  weeklyTarget?: number | null
}

async function isAuthorizedRequest(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return Boolean(user) && !error
}

function toSafeTarget(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0) return 0
  return Math.trunc(parsed)
}

export async function PATCH(request: Request) {
  if (!(await isAuthorizedRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Payload | null
  const vacancyId = typeof body?.vacancyId === 'string' ? body.vacancyId.trim() : ''
  if (!vacancyId) {
    return NextResponse.json({ error: 'vacancyId is required' }, { status: 400 })
  }

  const weeklyTarget = toSafeTarget(body?.weeklyTarget)
  if (body?.weeklyTarget !== null && body?.weeklyTarget !== undefined && weeklyTarget === null) {
    return NextResponse.json({ error: 'weeklyTarget must be a number >= 0 or null' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('job_openings_kpi')
    .update({ weekly_cv_target: weeklyTarget, updated_at: new Date().toISOString() })
    .eq('id', vacancyId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, vacancyId, weeklyTarget })
}
