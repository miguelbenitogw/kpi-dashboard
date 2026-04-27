import { NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'

export const maxDuration = 300

type VacancyRow = {
  id: string | null
  title: string | null
}

type WeeklyKpiRow = {
  vacancy_id: string
  week_start: string
  candidate_count: number
  synced_at: string
}

type VacancyCvWeeklyUpsertClient = {
  from: (table: string) => {
    upsert: (
      values: WeeklyKpiRow[],
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getIsoWeekStart(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utcDate.getUTCDay()

  // Semana laboral: lunes a viernes.
  // Si cae fin de semana, lo atribuimos al viernes previo para que
  // el agrupado semanal siempre represente la semana laboral vigente.
  if (day === 6) {
    utcDate.setUTCDate(utcDate.getUTCDate() - 1)
  } else if (day === 0) {
    utcDate.setUTCDate(utcDate.getUTCDate() - 2)
  }

  const adjustedDay = utcDate.getUTCDay()
  const diffToMonday = adjustedDay === 0 ? -6 : 1 - adjustedDay
  utcDate.setUTCDate(utcDate.getUTCDate() + diffToMonday)
  return toIsoDate(utcDate)
}

function getCandidateWeekStart(candidate: Record<string, unknown>, fallbackDate: Date): string {
  const createdTime = candidate['Created_Time']

  if (typeof createdTime === 'string' && createdTime.trim().length > 0) {
    const parsed = new Date(createdTime)
    if (!Number.isNaN(parsed.getTime())) {
      return getIsoWeekStart(parsed)
    }
  }

  return getIsoWeekStart(fallbackDate)
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildWeeklyRows(
  vacancyId: string,
  candidates: Record<string, unknown>[],
  syncedAtIso: string,
): WeeklyKpiRow[] {
  const fallbackDate = new Date(syncedAtIso)
  const weeklyCounts = new Map<string, number>()

  for (const candidate of candidates) {
    const weekStart = getCandidateWeekStart(candidate, fallbackDate)
    weeklyCounts.set(weekStart, (weeklyCounts.get(weekStart) ?? 0) + 1)
  }

  return Array.from(weeklyCounts.entries()).map(([week_start, candidate_count]) => ({
    vacancy_id: vacancyId,
    week_start,
    candidate_count,
    synced_at: syncedAtIso,
  }))
}

async function isAuthorizedRequest(request: Request): Promise<boolean> {
  if (validateApiKey(request)) return true

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return Boolean(user) && !error
}

export async function POST(request: Request) {
  if (!(await isAuthorizedRequest(request))) {
    return unauthorizedResponse()
  }

  const startedAt = Date.now()
  const syncedAtIso = new Date().toISOString()
  const errors: string[] = []

  const { data: vacancies, error: vacancyError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)

  if (vacancyError) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch active vacancies: ${vacancyError.message}` },
      { status: 500 },
    )
  }

  const vacancyList: VacancyRow[] = (vacancies ?? []) as VacancyRow[]
  const validVacancies = vacancyList
    .map((vacancy) => ({
      id: toNonEmptyString(vacancy.id),
      title: toNonEmptyString(vacancy.title) ?? 'Sin titulo',
    }))
    .filter((vacancy): vacancy is { id: string; title: string } => vacancy.id !== null)

  let vacanciesProcessed = 0
  let rowsUpserted = 0

  for (let i = 0; i < validVacancies.length; i++) {
    const vacancy = validVacancies[i]

    try {
      const candidates = await fetchAllCandidatesByJobOpening(vacancy.id)
      const rows = buildWeeklyRows(vacancy.id, candidates, syncedAtIso)

      if (rows.length > 0) {
        const upsertClient = supabaseAdmin as unknown as VacancyCvWeeklyUpsertClient
        const { error: upsertError } = await upsertClient
          .from('vacancy_cv_weekly_kpi')
          .upsert(rows, { onConflict: 'vacancy_id,week_start' })

        if (upsertError) {
          errors.push(`${vacancy.title} (${vacancy.id}): ${upsertError.message}`)
        } else {
          rowsUpserted += rows.length
        }
      }

      vacanciesProcessed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${vacancy.title} (${vacancy.id}): ${message}`)
    }

    if (i < validVacancies.length - 1) {
      await sleep(500)
    }
  }

  const invalidVacancies = vacancyList.length - validVacancies.length

  return NextResponse.json(
    {
      success: errors.length === 0,
      vacancies_total: vacancyList.length,
      vacancies_processed: vacanciesProcessed,
      vacancies_skipped_invalid_id: Math.max(invalidVacancies, 0),
      rows_upserted: rowsUpserted,
      errors,
      duration_ms: Date.now() - startedAt,
    },
    { status: errors.length > 0 ? 207 : 200 },
  )
}
