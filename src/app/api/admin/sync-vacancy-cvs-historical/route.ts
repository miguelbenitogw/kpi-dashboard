import { NextResponse } from 'next/server'
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllCandidatesByJobOpening } from '@/lib/zoho/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerSupabaseClient } from '@/lib/supabase/server-auth'

export const maxDuration = 300

const BATCH_SIZE = 20

type VacancyRow = {
  id: string | null
  title: string | null
  es_proceso_atraccion_actual: boolean | null
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

type RequestBody = {
  vacancyIds?: string[]
  onlyInactive?: boolean
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

function parseRequestBody(raw: unknown): RequestBody {
  if (raw === null || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>

  const vacancyIds =
    Array.isArray(obj['vacancyIds']) &&
    (obj['vacancyIds'] as unknown[]).every((v) => typeof v === 'string')
      ? (obj['vacancyIds'] as string[])
      : undefined

  const onlyInactive = typeof obj['onlyInactive'] === 'boolean' ? obj['onlyInactive'] : true

  return { vacancyIds, onlyInactive }
}

export async function POST(request: Request) {
  if (!(await isAuthorizedRequest(request))) {
    return unauthorizedResponse()
  }

  const startedAt = Date.now()
  const syncedAtIso = new Date().toISOString()
  const errors: string[] = []

  // Parse optional body — tolerate empty / non-JSON bodies gracefully
  let body: RequestBody = { onlyInactive: true }
  try {
    const rawBody = (await request.json()) as unknown
    body = parseRequestBody(rawBody)
  } catch {
    // No body or invalid JSON → use defaults
  }

  const { vacancyIds, onlyInactive = true } = body

  // Build Supabase query
  type SupabaseQuery = ReturnType<typeof supabaseAdmin.from> & {
    eq: (column: string, value: unknown) => SupabaseQuery
    in: (column: string, values: string[]) => SupabaseQuery
  }

  // We cast to `unknown` and then to the right shape to stay type-safe without `any`
  let query = supabaseAdmin
    .from('job_openings_kpi')
    .select('id, title, es_proceso_atraccion_actual') as unknown as SupabaseQuery

  if (vacancyIds && vacancyIds.length > 0) {
    // Specific IDs requested — ignore onlyInactive filter
    query = query.in('id', vacancyIds)
  } else if (onlyInactive) {
    query = query.eq('es_proceso_atraccion_actual', false)
  }
  // else: fetch ALL vacancies (active + inactive) — no filter needed

  const { data: vacancies, error: vacancyError } = await (
    query as unknown as Promise<{ data: VacancyRow[] | null; error: { message: string } | null }>
  )

  if (vacancyError) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch vacancies: ${vacancyError.message}`,
      },
      { status: 500 },
    )
  }

  const vacancyList: VacancyRow[] = (vacancies ?? []) as VacancyRow[]

  const validVacancies = vacancyList
    .map((vacancy) => ({
      id: toNonEmptyString(vacancy.id),
      title: toNonEmptyString(vacancy.title) ?? 'Sin titulo',
      isActive: vacancy.es_proceso_atraccion_actual === true,
    }))
    .filter(
      (vacancy): vacancy is { id: string; title: string; isActive: boolean } =>
        vacancy.id !== null,
    )

  let vacanciesSynced = 0
  let vacanciesFailed = 0
  let rowsUpserted = 0

  const upsertClient = supabaseAdmin as unknown as VacancyCvWeeklyUpsertClient
  const weeklyDeleteClient = supabaseAdmin as unknown as VacancyCvWeeklyDeleteClient

  // Process in batches of BATCH_SIZE to avoid memory issues
  const totalBatches = Math.ceil(validVacancies.length / BATCH_SIZE)

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE
    const batch = validVacancies.slice(batchStart, batchStart + BATCH_SIZE)

    console.log(
      `[sync-vacancy-cvs-historical] Batch ${batchIdx + 1}/${totalBatches} — processing ${batch.length} vacancies`,
    )

    for (let i = 0; i < batch.length; i++) {
      const vacancy = batch[i]

      try {
        // Always do a full refresh — no skip optimization for historical data
        const candidates = await fetchAllCandidatesByJobOpening(vacancy.id)
        const rows = buildWeeklyRows(vacancy.id, candidates, syncedAtIso)

        if (rows.length > 0) {
          const { error: upsertError } = await upsertClient
            .from('vacancy_cv_weekly_kpi')
            .upsert(rows, { onConflict: 'vacancy_id,week_start' })

          if (upsertError) {
            errors.push(`${vacancy.title} (${vacancy.id}): ${upsertError.message}`)
            vacanciesFailed += 1
          } else {
            rowsUpserted += rows.length
            vacanciesSynced += 1
          }
        } else {
          // No candidates — clear any stale rows for this vacancy
          const { error: deleteError } = await weeklyDeleteClient
            .from('vacancy_cv_weekly_kpi')
            .delete()
            .eq('vacancy_id', vacancy.id)

          if (deleteError) {
            errors.push(`${vacancy.title} (${vacancy.id}): ${deleteError.message}`)
            vacanciesFailed += 1
          } else {
            vacanciesSynced += 1
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${vacancy.title} (${vacancy.id}): ${message}`)
        vacanciesFailed += 1
      }

      // Rate-limit between vacancies (500ms), but not after the last one in the batch
      const isLastInBatch = i === batch.length - 1
      const isLastOverall = batchIdx === totalBatches - 1 && isLastInBatch

      if (!isLastOverall) {
        await sleep(isLastInBatch ? 200 : 500)
      }
    }
  }

  const invalidVacancies = vacancyList.length - validVacancies.length

  return NextResponse.json(
    {
      success: errors.length === 0,
      vacancies_total: vacancyList.length,
      vacancies_synced: vacanciesSynced,
      vacancies_failed: vacanciesFailed,
      vacancies_skipped_invalid_id: Math.max(invalidVacancies, 0),
      rows_upserted: rowsUpserted,
      synced_at: syncedAtIso,
      errors,
      duration_ms: Date.now() - startedAt,
    },
    { status: errors.length > 0 ? 207 : 200 },
  )
}
