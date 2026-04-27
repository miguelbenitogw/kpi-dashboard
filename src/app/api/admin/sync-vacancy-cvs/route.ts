import { NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'

export const maxDuration = 300

type VacancyRow = {
  id: string | null
  title: string | null
  total_candidates: number | null
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

type VacancyCvWeeklyDeleteClient = {
  from: (table: string) => {
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>
    }
  }
}

type VacancyCvSyncStateRow = {
  vacancy_id: string
  last_sync_at: string
  last_total_candidates: number | null
}

type VacancyCvSyncStateUpsertRow = {
  vacancy_id: string
  last_sync_at: string
  last_total_candidates: number
  status: 'synced' | 'skipped_unchanged' | 'error'
  last_error: string | null
  last_duration_ms: number
  updated_at: string
}

type VacancyCvSyncStateClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{ data: VacancyCvSyncStateRow[] | null; error: { message: string } | null }>
    }
    upsert: (
      value: VacancyCvSyncStateUpsertRow,
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

function toNonNegativeInt(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.trunc(value)
}

function toIsoDateMs(input: string | null | undefined): number | null {
  if (!input) return null
  const parsed = Date.parse(input)
  if (Number.isNaN(parsed)) return null
  return parsed
}

function getRefreshHours(): number {
  const parsed = Number(process.env.VACANCY_CV_SYNC_FULL_REFRESH_HOURS ?? 24)
  if (!Number.isFinite(parsed) || parsed <= 0) return 24
  return parsed
}

function shouldSyncVacancy(
  vacancy: { totalCandidates: number },
  state: VacancyCvSyncStateRow | undefined,
  nowMs: number,
  fullRefreshHours: number,
): boolean {
  if (!state) return true

  const previousTotal = toNonNegativeInt(state.last_total_candidates)
  if (vacancy.totalCandidates > previousTotal) return true

  const lastSyncMs = toIsoDateMs(state.last_sync_at)
  if (lastSyncMs === null) return true

  const maxAgeMs = fullRefreshHours * 60 * 60 * 1000
  return nowMs - lastSyncMs >= maxAgeMs
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
  const fullRefreshHours = getRefreshHours()
  const syncedAtIso = new Date().toISOString()
  const errors: string[] = []
  const syncStateClient = supabaseAdmin as unknown as VacancyCvSyncStateClient
  const weeklyDeleteClient = supabaseAdmin as unknown as VacancyCvWeeklyDeleteClient

  const { data: vacancies, error: vacancyError } = await supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title, total_candidates')
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
      totalCandidates: toNonNegativeInt(vacancy.total_candidates),
    }))
    .filter(
      (vacancy): vacancy is { id: string; title: string; totalCandidates: number } =>
        vacancy.id !== null,
    )

  const validVacancyIds = validVacancies.map((vacancy) => vacancy.id)
  let stateMap = new Map<string, VacancyCvSyncStateRow>()

  if (validVacancyIds.length > 0) {
    const { data: stateRows, error: stateError } = await syncStateClient
      .from('vacancy_cv_sync_state_kpi')
      .select('vacancy_id, last_sync_at, last_total_candidates')
      .in('vacancy_id', validVacancyIds)

    if (stateError) {
      errors.push(`sync_state: ${stateError.message}`)
    }

    stateMap = new Map<string, VacancyCvSyncStateRow>(
      ((stateRows ?? []) as VacancyCvSyncStateRow[]).map((row) => [row.vacancy_id, row]),
    )
  }

  let vacanciesProcessed = 0
  let vacanciesSynced = 0
  let vacanciesSkippedUnchanged = 0
  let rowsUpserted = 0

  for (let i = 0; i < validVacancies.length; i++) {
    const vacancy = validVacancies[i]
    const vacancyStartedAt = Date.now()
    const previousState = stateMap.get(vacancy.id)
    const shouldSync = shouldSyncVacancy(
      { totalCandidates: vacancy.totalCandidates },
      previousState,
      Date.now(),
      fullRefreshHours,
    )

    if (!shouldSync) {
      vacanciesProcessed += 1
      vacanciesSkippedUnchanged += 1

      const statePayload: VacancyCvSyncStateUpsertRow = {
        vacancy_id: vacancy.id,
        last_sync_at: previousState?.last_sync_at ?? syncedAtIso,
        last_total_candidates: vacancy.totalCandidates,
        status: 'skipped_unchanged',
        last_error: null,
        last_duration_ms: Date.now() - vacancyStartedAt,
        updated_at: syncedAtIso,
      }

      await syncStateClient
        .from('vacancy_cv_sync_state_kpi')
        .upsert(statePayload, { onConflict: 'vacancy_id' })

      if (i < validVacancies.length - 1) {
        await sleep(200)
      }
      continue
    }

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
      } else {
        const { error: deleteError } = await weeklyDeleteClient
          .from('vacancy_cv_weekly_kpi')
          .delete()
          .eq('vacancy_id', vacancy.id)

        if (deleteError) {
          errors.push(`${vacancy.title} (${vacancy.id}): ${deleteError.message}`)
        }
      }

      vacanciesProcessed += 1
      vacanciesSynced += 1

      const statePayload: VacancyCvSyncStateUpsertRow = {
        vacancy_id: vacancy.id,
        last_sync_at: syncedAtIso,
        last_total_candidates: vacancy.totalCandidates,
        status: 'synced',
        last_error: null,
        last_duration_ms: Date.now() - vacancyStartedAt,
        updated_at: syncedAtIso,
      }

      await syncStateClient
        .from('vacancy_cv_sync_state_kpi')
        .upsert(statePayload, { onConflict: 'vacancy_id' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${vacancy.title} (${vacancy.id}): ${message}`)

      const statePayload: VacancyCvSyncStateUpsertRow = {
        vacancy_id: vacancy.id,
        last_sync_at: previousState?.last_sync_at ?? syncedAtIso,
        last_total_candidates: vacancy.totalCandidates,
        status: 'error',
        last_error: message.slice(0, 1000),
        last_duration_ms: Date.now() - vacancyStartedAt,
        updated_at: syncedAtIso,
      }

      await syncStateClient
        .from('vacancy_cv_sync_state_kpi')
        .upsert(statePayload, { onConflict: 'vacancy_id' })
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
      vacancies_synced: vacanciesSynced,
      vacancies_skipped_unchanged: vacanciesSkippedUnchanged,
      vacancies_skipped_invalid_id: Math.max(invalidVacancies, 0),
      rows_upserted: rowsUpserted,
      synced_at: syncedAtIso,
      errors,
      duration_ms: Date.now() - startedAt,
    },
    { status: errors.length > 0 ? 207 : 200 },
  )
}
