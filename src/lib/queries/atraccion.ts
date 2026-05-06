import { supabase } from '@/lib/supabase/client'
import { type TipoProfesional, deriveProfesionTipo } from '@/lib/utils/vacancy-profession'

// Statuses NOT considered as "contacted" — candidates that never progressed beyond intake
const NOT_CONTACTED_STATUSES = ['Associated', 'New', 'Not Valid']

export interface StatusCount {
  status: string
  count: number
}

export interface WeeklyCVData {
  week: string
  count: number
}

export interface VacancyWeeklyCvPoint {
  weekStart: string
  weekLabel: string
  count: number
}

export interface VacancyWeeklyCvSummary {
  vacancyId: string
  title: string
  clientName: string | null
  owner: string | null
  weeklyTarget: number | null
  newThisWeek: number
  history: VacancyWeeklyCvPoint[]
  tipoProfesional: TipoProfesional
}

export interface ReceivedCvsByVacancyResult {
  summaries: VacancyWeeklyCvSummary[]
  latestSyncedAt: string | null
}

export interface ConversionRates {
  cvToApproved: number
  contactedToApproved: number
  totalCVs: number
  approved: number
  contacted: number
}

export interface TrafficLight {
  status: 'good' | 'warning' | 'danger'
  weeksLeft: number
  requiredPerWeek: number
  current: number
  target: number
}

export interface ActivePromotion {
  id: string
  nombre: string
  coordinador: string | null
  cliente: string | null
  fecha_fin: string | null
  objetivo_atraccion: number | null
  total_aceptados: number | null
}

export async function getRecruitmentStatusCounts(
  jobOpeningId?: string,
): Promise<StatusCount[]> {
  // Fetch candidate IDs linked to atraccion vacantes
  const { data: historyRows, error: historyError } = await supabase
    .from('candidate_job_history_kpi')
    .select('candidate_id')
    .eq('association_type', 'atraccion')

  if (historyError) {
    console.error('Error fetching atraccion candidate ids:', historyError)
    return []
  }

  const candidateIds = [
    ...new Set((historyRows ?? []).map((r) => r.candidate_id)),
  ]

  if (candidateIds.length === 0) return []

  let query = supabase
    .from('candidates_kpi')
    .select('current_status')
    .in('id', candidateIds)

  if (jobOpeningId) {
    query = query.eq('job_opening_id', jobOpeningId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching recruitment status counts:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Aggregate counts by status
  const statusMap = new Map<string, number>()
  for (const row of data) {
    const status = row.current_status ?? 'Sin estado'
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
  }

  return Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getWeeklyCVCount(days = 84): Promise<WeeklyCVData[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('created_time')
    .gte('created_time', since.toISOString())
    .order('created_time', { ascending: true })

  if (error) {
    console.error('Error fetching weekly CV count:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Group by ISO week (Monday-based)
  const weekMap = new Map<string, number>()

  for (const row of data) {
    if (!row.created_time) continue
    const date = new Date(row.created_time)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    const weekKey = monday.toISOString().split('T')[0]

    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1)
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({
      week: formatWeekLabel(week),
      count,
    }))
}

function formatWeekLabel(mondayDate: string): string {
  const date = new Date(mondayDate)
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export function getCurrentIsoWeekMonday(referenceDate = new Date()): string {
  const utcDate = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  )

  const day = utcDate.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  utcDate.setUTCDate(utcDate.getUTCDate() + diff)

  return utcDate.toISOString().split('T')[0]
}

export function getLastCompletedIsoWeekMonday(referenceDate = new Date()): string {
  const currentMonday = new Date(getCurrentIsoWeekMonday(referenceDate))
  currentMonday.setUTCDate(currentMonday.getUTCDate() - 7)
  return currentMonday.toISOString().split('T')[0]
}

export function sortWeeks(weeks: string[]): string[] {
  return [...weeks].sort((a, b) => a.localeCompare(b))
}

function toIsoDate(input: unknown): string | null {
  if (!input) return null

  const parsed = new Date(String(input))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().split('T')[0]
}

function normalizeToIsoMonday(input: unknown): string | null {
  const iso = toIsoDate(input)
  if (!iso) return null

  const date = new Date(iso)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)

  return date.toISOString().split('T')[0]
}

function getRecentIsoMondays(weeks: number): string[] {
  const currentMonday = getLastCompletedIsoWeekMonday()
  const dates: string[] = []

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const date = new Date(currentMonday)
    date.setUTCDate(date.getUTCDate() - offset * 7)
    dates.push(date.toISOString().split('T')[0])
  }

  return sortWeeks(dates)
}

function toNumberCount(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return 0
  return num
}

/**
 * Aggregate total CVs received per week from vacancy_cv_weekly_kpi.
 * This is the correct source — candidates_kpi.created_time is NULL for all rows
 * because the Zoho sync never mapped that field.
 */
export async function getWeeklyCVCountFromWeeklyTable(
  weeks = 12,
): Promise<WeeklyCVData[]> {
  const safeWeeks = Math.min(52, Math.max(1, Math.trunc(weeks)))
  const weekStarts = getRecentIsoMondays(safeWeeks)
  const oldestWeek = weekStarts[0]
  const newestWeek = weekStarts[weekStarts.length - 1]

  // Use a typed cast because vacancy_cv_weekly_kpi may not be in the generated types yet
  type WeeklyQueryClient = {
    from: (table: string) => {
      select: (columns: string) => {
        gte: (column: string, value: string) => {
          lte: (
            col: string,
            val: string,
          ) => Promise<{
            data: Array<{
              week_start: string | null
              candidate_count: number | null
              cv_count: number | null
              new_cvs: number | null
              total: number | null
            }> | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const client = supabase as unknown as WeeklyQueryClient
  const { data, error } = await client
    .from('vacancy_cv_weekly_kpi')
    .select('week_start, candidate_count, cv_count, new_cvs, total')
    .gte('week_start', oldestWeek)
    .lte('week_start', newestWeek)

  if (error) {
    console.error('[atraccion] getWeeklyCVCountFromWeeklyTable error:', error)
    return []
  }

  // Initialize all weeks with 0 so we always return a full series
  const weekMap = new Map<string, number>()
  for (const w of weekStarts) weekMap.set(w, 0)

  for (const row of data ?? []) {
    const weekStart = normalizeToIsoMonday(row.week_start)
    if (!weekStart || !weekMap.has(weekStart)) continue
    const count = toNumberCount(
      row.candidate_count ?? row.cv_count ?? row.new_cvs ?? row.total,
    )
    weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + count)
  }

  return weekStarts.map((weekStart) => ({
    week: formatWeekLabel(weekStart),
    count: weekMap.get(weekStart) ?? 0,
  }))
}

type VacancyCvWeeklyRow = {
  vacancy_id?: string | null
  job_opening_id?: string | null
  week_start?: string | null
  week?: string | null
  candidate_count?: number | string | null
  count?: number | string | null
  cv_count?: number | string | null
  total?: number | string | null
  new_cvs?: number | string | null
  synced_at?: string | null
}

type VacancyMetaRow = {
  id: string
  title: string | null
  client_name: string | null
  owner: string | null
  weekly_cv_target: number | null
  tipo_profesional: string | null
}

export async function getReceivedCvsByVacancy(
  weeks = 12,
): Promise<ReceivedCvsByVacancyResult> {
  const safeWeeks = Math.min(52, Math.max(1, Math.trunc(weeks)))
  const weekStarts = getRecentIsoMondays(safeWeeks)
  const oldestWeek = weekStarts[0]

  // The actual current (in-progress) ISO week
  const thisWeek = getCurrentIsoWeekMonday()

  // Append current week to the list if it isn't already the last entry
  const allWeekStarts =
    thisWeek > (weekStarts[weekStarts.length - 1] ?? '')
      ? [...weekStarts, thisWeek]
      : weekStarts

  type VacancyCvWeeklyQueryClient = {
    from: (table: string) => {
      select: (columns: string) => {
        gte: (column: string, value: string) => {
          lte: (
            finalColumn: string,
            finalValue: string,
          ) => Promise<{ data: VacancyCvWeeklyRow[] | null; error: { message: string } | null }>
        }
      }
    }
  }

  const weeklyQueryClient = supabase as unknown as VacancyCvWeeklyQueryClient
  const { data: rawRows, error: weeklyError } = await weeklyQueryClient
    .from('vacancy_cv_weekly_kpi')
    .select('*')
    .gte('week_start', oldestWeek)
    .lte('week_start', thisWeek)

  if (weeklyError) {
    console.error('Error fetching received CVs by vacancy:', weeklyError)
    return { summaries: [], latestSyncedAt: null }
  }

  const weeklyRows = (rawRows ?? []) as VacancyCvWeeklyRow[]
  if (weeklyRows.length === 0) return { summaries: [], latestSyncedAt: null }

  const latestSyncedAt = weeklyRows.reduce<string | null>((latest, row) => {
    const value = row.synced_at ?? null
    if (!value) return latest
    if (!latest || value > latest) return value
    return latest
  }, null)

  const byVacancy = new Map<string, Map<string, number>>()

  for (const row of weeklyRows) {
    const vacancyId = row.vacancy_id ?? row.job_opening_id
    if (!vacancyId) continue

    const weekStart = normalizeToIsoMonday(row.week_start ?? row.week)
    if (!weekStart) continue
    if (weekStart < oldestWeek || weekStart > thisWeek) continue

    const count = toNumberCount(
      row.candidate_count ?? row.count ?? row.cv_count ?? row.new_cvs ?? row.total,
    )

    if (!byVacancy.has(vacancyId)) byVacancy.set(vacancyId, new Map())
    const weekMap = byVacancy.get(vacancyId)!
    weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + count)
  }

  const vacancyIds = Array.from(byVacancy.keys())
  if (vacancyIds.length === 0) return { summaries: [], latestSyncedAt }

  type VacancyMetaQueryClient = {
    from: (table: string) => {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<{ data: VacancyMetaRow[] | null; error: { message: string } | null }>
      }
    }
  }

  const vacancyMetaClient = supabase as unknown as VacancyMetaQueryClient
  const { data: vacanciesMeta, error: vacError } = await vacancyMetaClient
    .from('job_openings_kpi')
    .select('id, title, client_name, owner, weekly_cv_target, tipo_profesional')
    .in('id', vacancyIds)

  if (vacError) {
    console.error('Error fetching vacancy metadata for CV weekly KPI:', vacError)
  }

  const metaMap = new Map(
    (vacanciesMeta ?? []).map((v) => {
      const dbTipo = (v.tipo_profesional ?? '') as string
      const tipoProfesional: TipoProfesional =
        dbTipo && dbTipo !== 'otro'
          ? (dbTipo as TipoProfesional)
          : deriveProfesionTipo(v.title)
      return [
        v.id,
        {
          title: v.title,
          clientName: v.client_name ?? null,
          owner: v.owner ?? null,
          weeklyTarget: v.weekly_cv_target ?? null,
          tipoProfesional,
        },
      ]
    }),
  )

  const summaries: VacancyWeeklyCvSummary[] = vacancyIds.map((vacancyId) => {
    const weekMap = byVacancy.get(vacancyId) ?? new Map<string, number>()
    const history: VacancyWeeklyCvPoint[] = allWeekStarts.map((weekStart) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      count: weekMap.get(weekStart) ?? 0,
    }))

    const meta = metaMap.get(vacancyId)
    const newThisWeek = weekMap.get(thisWeek) ?? 0
    const weeklyTarget =
      typeof meta?.weeklyTarget === 'number' && Number.isFinite(meta.weeklyTarget)
        ? Math.max(0, Math.trunc(meta.weeklyTarget))
        : null

    return {
      vacancyId,
      title: meta?.title ?? 'Vacante sin título',
      clientName: meta?.clientName ?? null,
      owner: meta?.owner ?? null,
      weeklyTarget,
      newThisWeek,
      history,
      tipoProfesional: meta?.tipoProfesional ?? deriveProfesionTipo(meta?.title),
    }
  })

  return {
    summaries: summaries.sort(
      (a, b) =>
        b.newThisWeek - a.newThisWeek || a.title.localeCompare(b.title, 'es'),
    ),
    latestSyncedAt,
  }
}

export function getCurrentIsoWeekLabel(): string {
  return formatWeekLabel(getCurrentIsoWeekMonday())
}


export interface VacancyRankingRow {
  vacancyId: string
  vacancyTitle: string
  weeklyTarget: number | null
  newThisWeek: number
  previousWeek: number
  tipoProfesional: TipoProfesional
}

export interface VacancyWeeklySeries {
  vacancyId: string
  vacancyTitle: string
  points: VacancyWeeklyCvPoint[]
}

export interface ReceivedCvsByVacancyStats {
  ranking: VacancyRankingRow[]
  weeklySeries: VacancyWeeklySeries[]
  generatedAt: string | null
}

export async function getReceivedCvsByVacancyStats(
  weeks = 12,
): Promise<ReceivedCvsByVacancyStats> {
  const { summaries, latestSyncedAt } = await getReceivedCvsByVacancy(weeks)

  if (summaries.length === 0) {
    return {
      ranking: [],
      weeklySeries: [],
      generatedAt: null,
    }
  }

  const ranking: VacancyRankingRow[] = summaries.map((summary) => {
    const previousWeek = summary.history.length > 1
      ? summary.history[summary.history.length - 2]?.count ?? 0
      : 0

    return {
      vacancyId: summary.vacancyId,
      vacancyTitle: summary.title,
      weeklyTarget: summary.weeklyTarget,
      newThisWeek: summary.newThisWeek,
      tipoProfesional: summary.tipoProfesional,
      previousWeek,
    }
  })

  const weeklySeries: VacancyWeeklySeries[] = summaries.map((summary) => ({
    vacancyId: summary.vacancyId,
    vacancyTitle: summary.title,
    points: summary.history,
  }))

  return {
    ranking,
    weeklySeries,
    generatedAt: latestSyncedAt,
  }
}

/**
 * Computes conversion rates for active (or inactive) attraction vacancies.
 *
 * Source of truth: vacancy_status_counts_kpi joined with job_openings_kpi.
 *
 * - Total CVs  = SUM(job_openings_kpi.total_candidates)
 * - Approved   = SUM(vacancy_status_counts_kpi.count) WHERE status = 'Approved by client'
 * - Contacted  = SUM counts WHERE status NOT IN ('Associated', 'New', 'Not Valid')
 *
 * By default, vacancies with pais_destino = 'Interno' are excluded (internal
 * promotional campaigns, not real recruitment openings). Pass pais = 'Interno'
 * explicitly to include them.
 */
export async function getConversionRates(
  active = true,
  tipoProfesional?: string,
  pais?: string,
): Promise<ConversionRates> {
  const EMPTY: ConversionRates = {
    cvToApproved: 0, contactedToApproved: 0,
    totalCVs: 0, approved: 0, contacted: 0,
  }

  // 1. Fetch vacancies with optional filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('job_openings_kpi')
    .select('id, total_candidates, hired_count')
    .eq('es_proceso_atraccion_actual', active)

  if (tipoProfesional) {
    query = query.eq('tipo_profesional', tipoProfesional)
  }
  if (pais) {
    // Explicit country requested — show it even if it's Interno
    query = query.eq('pais_destino', pais)
  } else {
    // Default: exclude internal promotions (campaigns, not real job openings)
    query = query.neq('pais_destino', 'Interno')
  }

  const { data: vacancies, error: vacError } = await query

  if (vacError) {
    console.error('[atraccion] getConversionRates vacancies error:', vacError)
    return EMPTY
  }

  const vacList = (vacancies ?? []) as { id: string; total_candidates: number; hired_count: number }[]
  if (vacList.length === 0) return EMPTY

  const totalCVs = vacList.reduce((sum, row) => sum + (row.total_candidates ?? 0), 0)
  if (totalCVs === 0) return EMPTY

  // hired_count from job_openings_kpi is always accurate (synced from Zoho)
  const totalHired = vacList.reduce((sum, row) => sum + (row.hired_count ?? 0), 0)

  const ids = vacList.map((v) => v.id)

  // 2. Fetch per-status counts for those vacancies
  const { data: statusRows, error: statusError } = await supabase
    .from('vacancy_status_counts_kpi')
    .select('status, count')
    .in('vacancy_id', ids)

  if (statusError) {
    console.error('[atraccion] getConversionRates statusCounts error:', statusError)
    return EMPTY
  }

  let approvedByClient = 0
  let contacted = 0

  for (const row of (statusRows ?? []) as { status: string; count: number }[]) {
    const cnt = row.count ?? 0
    if (row.status === 'Approved by client') approvedByClient += cnt
    if (!NOT_CONTACTED_STATUSES.includes(row.status)) contacted += cnt
  }

  // Success = approved by client + hired (consistent with % Éxito in tables)
  const approved = approvedByClient + totalHired

  const cvToApproved =
    totalCVs > 0 ? Math.round((approved / totalCVs) * 10000) / 100 : 0
  const contactedToApproved =
    contacted > 0 ? Math.round((approved / contacted) * 10000) / 100 : 0

  return { cvToApproved, contactedToApproved, totalCVs, approved, contacted }
}

export async function getAttractionTrafficLight(
  promotionId: string,
): Promise<TrafficLight> {
  const { data, error } = await supabase
    .from('promotions_kpi')
    .select(
      'objetivo_atraccion, total_aceptados, fecha_inicio, fecha_fin',
    )
    .eq('id', promotionId)
    .single()

  if (error || !data) {
    console.error('Error fetching traffic light:', error)
    return {
      status: 'danger',
      weeksLeft: 0,
      requiredPerWeek: 0,
      current: 0,
      target: 0,
    }
  }

  const target = data.objetivo_atraccion ?? 0
  const current = data.total_aceptados ?? 0
  const pct = target > 0 ? current / target : 0

  // Semanas hasta INICIO del proyecto (AJ3 del Cuadro de Mando).
  // Fallback a fecha_fin si fecha_inicio no estÃ¡ cargada.
  const now = new Date()
  const startRaw = data.fecha_inicio ?? data.fecha_fin
  const start = startRaw ? new Date(startRaw) : now
  const msLeft = Math.max(0, start.getTime() - now.getTime())
  const weeksLeft = Math.max(1, Math.ceil(msLeft / (7 * 24 * 60 * 60 * 1000)))

  const remaining = Math.max(0, target - current)
  const requiredPerWeek =
    weeksLeft > 0 ? Math.ceil(remaining / weeksLeft) : remaining

  let status: 'good' | 'warning' | 'danger'
  if (pct >= 1.0) {
    status = 'good'
  } else if (pct >= 0.9) {
    status = 'warning'
  } else {
    status = 'danger'
  }

  return { status, weeksLeft, requiredPerWeek, current, target }
}

export async function getActivePromotions(): Promise<ActivePromotion[]> {
  const { data, error } = await supabase
    .from('promotions_kpi')
    .select(
      'id, nombre, coordinador, cliente, fecha_fin, objetivo_atraccion, total_aceptados',
    )
    .eq('is_active', true)
    .order('fecha_fin', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching active promotions:', error)
    return []
  }

  return data ?? []
}

export interface AtraccionVacancy {
  id: string
  title: string
  status: string | null
  client_name: string | null
  owner: string | null
  tipo_profesional: string
  total_candidates: number | null
  hired_count: number | null
  approved_count: number
  es_proceso_atraccion_actual: boolean
  date_opened: string | null
}

// ---------------------------------------------------------------------------
// Vacancy Ã— Status recruitment table (es_proceso_atraccion_actual)
// ---------------------------------------------------------------------------

export interface VacancyStatusRow {
  id: string
  title: string
  client_name: string | null
  owner: string | null
  status: string | null
  date_opened: string | null
  total_candidates: number
  tipoProfesional: TipoProfesional
  hired_count: number
  zohoJobNumber: number | null
  byStatus: Record<string, number>   // candidate_status_in_jo â†’ count
  total: number
}

export interface VacancyRecruitmentStats {
  rows: VacancyStatusRow[]
  statuses: string[]
  lastSynced: string | null
}

export async function getVacancyRecruitmentStats(): Promise<VacancyRecruitmentStats> {
  // 1. Fetch active vacancies
  const { data: vacancies, error: vacError } = await supabase
    .from('job_openings_kpi')
    .select('id, title, client_name, owner, status, date_opened, total_candidates, hired_count, tipo_profesional, zoho_job_number')
    .eq('es_proceso_atraccion_actual', true)
    .order('total_candidates', { ascending: false })

  if (vacError) console.error('Error fetching vacancies:', vacError)

  const vacList = vacancies ?? []
  if (vacList.length === 0) return { rows: [], statuses: [], lastSynced: null }

  const vacIds = vacList.map((v) => v.id)

  // 2. Fetch aggregated status counts from the sync table
  const { data: counts, error: countsError } = await supabase
    .from('vacancy_status_counts_kpi')
    .select('vacancy_id, status, count, synced_at')
    .in('vacancy_id', vacIds)

  if (countsError) console.error('Error fetching vacancy status counts:', countsError)

  // Build a lookup: vacancyId â†’ { status â†’ count }
  const countMap = new Map<string, Record<string, number>>()
  let latestSyncedAt: string | null = null

  for (const c of counts ?? []) {
    if (!countMap.has(c.vacancy_id)) countMap.set(c.vacancy_id, {})
    countMap.get(c.vacancy_id)![c.status] = c.count

    // Track the most recent synced_at across all rows
    if (!latestSyncedAt || c.synced_at > latestSyncedAt) {
      latestSyncedAt = c.synced_at
    }
  }

  // Collect all distinct statuses that appear in the sync data
  const allStatuses = new Set<string>()
  for (const statusMap of countMap.values()) {
    for (const s of Object.keys(statusMap)) allStatuses.add(s)
  }
  const statuses = Array.from(allStatuses).sort()

  const rows: VacancyStatusRow[] = vacList.map((v) => {
    const dbTipo = ((v as any).tipo_profesional ?? '') as string
    const tipoProfesional: TipoProfesional =
      dbTipo && dbTipo !== 'otro'
        ? (dbTipo as TipoProfesional)
        : deriveProfesionTipo(v.title)
    return {
      id: v.id,
      title: v.title,
      client_name: v.client_name ?? null,
      owner: v.owner ?? null,
      status: v.status ?? null,
      date_opened: v.date_opened ?? null,
      total_candidates: v.total_candidates ?? 0,
      hired_count: v.hired_count ?? 0,
      zohoJobNumber: (v as any).zoho_job_number ?? null,
      byStatus: countMap.get(v.id) ?? {},
      total: v.total_candidates ?? 0,
      tipoProfesional,
    }
  })

  return { rows, statuses, lastSynced: latestSyncedAt }
}

// ---------------------------------------------------------------------------
// Promo Ã— Status recruitment table
// ---------------------------------------------------------------------------

export interface PromoStatusRow {
  /** Promotion name, e.g. "PromociÃ³n 113" */
  nombre: string
  /** Recruitment target (objetivo_atraccion from promotions_kpi) */
  objetivo: number | null
  /** Currently accepted (total_aceptados) */
  aceptados: number | null
  /** End date */
  fecha_fin: string | null
  /** Coordinator */
  coordinador: string | null
  /** Map status â†’ count for this promo */
  byStatus: Record<string, number>
  /** Total candidates in this promo */
  total: number
}

export interface PromoRecruitmentStats {
  rows: PromoStatusRow[]
  /** All distinct statuses that appear in the data (for column headers) */
  statuses: string[]
}

export async function getPromoRecruitmentStats(): Promise<PromoRecruitmentStats> {
  // Fetch active promos
  const { data: promos, error: promosError } = await supabase
    .from('promotions_kpi')
    .select('nombre, objetivo_atraccion, total_aceptados, fecha_fin, coordinador')
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  if (promosError) {
    console.error('Error fetching promos:', promosError)
  }

  const activePromos = promos ?? []
  const activePromoNames = new Set(activePromos.map((p) => p.nombre))

  // Fetch all candidates that belong to any active promo
  const { data: candidates, error: candError } = await supabase
    .from('candidates_kpi')
    .select('promocion_nombre, current_status')
    .not('promocion_nombre', 'is', null)

  if (candError) {
    console.error('Error fetching candidates for promo stats:', candError)
  }

  // Aggregate candidates by promo + status
  const promoMap = new Map<string, Record<string, number>>()

  for (const c of candidates ?? []) {
    const promo = c.promocion_nombre as string
    const status = (c.current_status as string) ?? 'Sin estado'
    if (!promoMap.has(promo)) promoMap.set(promo, {})
    const statusMap = promoMap.get(promo)!
    statusMap[status] = (statusMap[status] ?? 0) + 1
  }

  // Collect all distinct statuses across all promos (sorted)
  const allStatuses = new Set<string>()
  for (const statusMap of promoMap.values()) {
    for (const s of Object.keys(statusMap)) allStatuses.add(s)
  }
  const statuses = Array.from(allStatuses).sort()

  // Build rows â€” include all active promos even if they have 0 candidates
  const rows: PromoStatusRow[] = activePromos.map((p) => {
    const byStatus = promoMap.get(p.nombre) ?? {}
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0)
    return {
      nombre: p.nombre,
      objetivo: p.objetivo_atraccion ?? null,
      aceptados: p.total_aceptados ?? null,
      fecha_fin: p.fecha_fin ?? null,
      coordinador: p.coordinador ?? null,
      byStatus,
      total,
    }
  })

  // Also include promos that appear in candidates but aren't in promotions_kpi
  for (const [nombre, byStatus] of promoMap.entries()) {
    if (!activePromoNames.has(nombre)) {
      const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0)
      rows.push({ nombre, objetivo: null, aceptados: null, fecha_fin: null, coordinador: null, byStatus, total })
    }
  }

  // Sort by nombre
  rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return { rows, statuses }
}

// ---------------------------------------------------------------------------
// Pre-computed vacancy tag counts
// ---------------------------------------------------------------------------

/**
 * Get tag counts for a set of vacancy IDs from the pre-computed table.
 * Returns a map: vacancy_id â†’ { tag â†’ count }
 */
export async function getVacancyTagCountsMap(
  vacancyIds: string[]
): Promise<Map<string, Record<string, number>>> {
  if (vacancyIds.length === 0) return new Map()

  const result = new Map<string, Record<string, number>>()
  const PAGE_SIZE = 1000
  let from = 0

  // Paginate â€” Supabase default row limit is 1000, table has 13k+ rows
  while (true) {
    const { data, error } = await supabase
      .from('vacancy_tag_counts_kpi')
      .select('vacancy_id, tag, count')
      .in('vacancy_id', vacancyIds)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[atraccion] getVacancyTagCountsMap error:', error)
      break
    }

    for (const row of data ?? []) {
      if (!result.has(row.vacancy_id)) result.set(row.vacancy_id, {})
      result.get(row.vacancy_id)![row.tag] = row.count
    }

    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return result
}

// ---------------------------------------------------------------------------
// Single-vacancy tag counts (lazy load for expandable rows)
// ---------------------------------------------------------------------------

export interface VacancyTagCount {
  tag: string
  count: number
}

export async function getVacancyTagCounts(
  vacancyId: string
): Promise<VacancyTagCount[]> {
  const { data, error } = await supabase
    .from('vacancy_tag_counts_kpi')
    .select('tag, count')
    .eq('vacancy_id', vacancyId)
    .order('count', { ascending: false })

  if (error) {
    console.error('[atraccion] getVacancyTagCounts error:', error)
    return []
  }

  return (data ?? []).map((r) => ({ tag: r.tag, count: r.count }))
}

// ---------------------------------------------------------------------------
// Closed / Inactive vacancies with aggregated candidate tags
// ---------------------------------------------------------------------------

export interface ClosedVacancy {
  id: string
  title: string
  status: string | null
  date_opened: string | null
  year: number | null
  total_candidates: number
  hired_count: number
  tags: Record<string, number>
  /** Candidate counts by status from vacancy_status_counts_kpi (empty if not synced yet) */
  byStatus: Record<string, number>
}

export interface ClosedVacanciesData {
  byYear: Record<number, ClosedVacancy[]>
  allYears: number[]
  allTags: Record<string, number>
  /** All distinct candidate statuses that appear across closed vacancies */
  allStatuses: string[]
}

export async function getClosedVacanciesData(): Promise<ClosedVacanciesData> {
  // 1. Fetch all closed vacancies
  const { data: vacancies, error } = await supabase
    .from('job_openings_kpi')
    .select('id, title, status, date_opened, total_candidates, hired_count')
    .eq('is_active', false)
    .order('date_opened', { ascending: false, nullsFirst: false })

  if (error || !vacancies) {
    console.error('[atraccion] getClosedVacanciesData error:', error)
    return { byYear: {}, allYears: [], allTags: {}, allStatuses: [] }
  }

  const vacancyIds = vacancies.map(v => v.id)

  // 2. Get pre-computed tag counts from vacancy_tag_counts_kpi
  const tagCountsMap = await getVacancyTagCountsMap(vacancyIds)

  // 3. Get candidate status counts from vacancy_status_counts_kpi (paginated)
  const statusCountsMap = new Map<string, Record<string, number>>()
  const allStatusesSet = new Set<string>()
  const PAGE_SIZE = 1000
  let from = 0

  while (true) {
    const { data: statusRows, error: statusErr } = await supabase
      .from('vacancy_status_counts_kpi')
      .select('vacancy_id, status, count')
      .in('vacancy_id', vacancyIds)
      .range(from, from + PAGE_SIZE - 1)

    if (statusErr) {
      console.error('[atraccion] getClosedVacanciesData status counts error:', statusErr)
      break
    }

    for (const row of statusRows ?? []) {
      if (!statusCountsMap.has(row.vacancy_id)) statusCountsMap.set(row.vacancy_id, {})
      statusCountsMap.get(row.vacancy_id)![row.status] = row.count
      allStatusesSet.add(row.status)
    }

    if (!statusRows || statusRows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const allStatuses = Array.from(allStatusesSet).sort()

  // 4. Build result
  const byYear: Record<number, ClosedVacancy[]> = {}
  const allTags: Record<string, number> = {}

  for (const v of vacancies) {
    const year = v.date_opened ? new Date(v.date_opened).getFullYear() : 0
    const tags = tagCountsMap.get(v.id) ?? {}
    const byStatus = statusCountsMap.get(v.id) ?? {}

    // Aggregate allTags
    for (const [tag, count] of Object.entries(tags)) {
      allTags[tag] = (allTags[tag] ?? 0) + count
    }

    const vacancy: ClosedVacancy = {
      id: v.id,
      title: v.title,
      status: v.status ?? null,
      date_opened: v.date_opened ?? null,
      year: year || null,
      total_candidates: v.total_candidates ?? 0,
      hired_count: v.hired_count ?? 0,
      tags,
      byStatus,
    }

    if (year > 0) {
      if (!byYear[year]) byYear[year] = []
      byYear[year].push(vacancy)
    }
  }

  const allYears = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return { byYear, allYears, allTags, allStatuses }
}

// ---------------------------------------------------------------------------
// Closed vacancies — weekly CV history + promo aggregation
// ---------------------------------------------------------------------------

export interface ClosedVacancyCvsEntry {
  vacancyId: string
  title: string
  promoName: string | null
  hiredCount: number
  totalCandidates: number
  history: VacancyWeeklyCvPoint[]
}

export interface ClosedVacancyPromoSummary {
  promoName: string
  totalCandidates: number
  hiredCount: number
  history: VacancyWeeklyCvPoint[]
}

type PromoLinkRow = {
  job_opening_id: string | null
  promocion_nombre: string | null
}

type ClosedVacancyMetaRow = {
  id: string
  title: string | null
  hired_count: number | null
  total_candidates: number | null
}

export async function getClosedVacancyCvsHistory(
  weeks = 52,
): Promise<ClosedVacancyCvsEntry[]> {
  const safeWeeks = Math.min(52, Math.max(1, Math.trunc(weeks)))
  const weekStarts = getRecentIsoMondays(safeWeeks)
  const oldestWeek = weekStarts[0]
  const newestWeek = weekStarts[weekStarts.length - 1]

  // 1. Fetch closed vacancies
  type ClosedVacancyQueryClient = {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: boolean,
        ) => Promise<{ data: ClosedVacancyMetaRow[] | null; error: { message: string } | null }>
      }
    }
  }

  const closedVacClient = supabase as unknown as ClosedVacancyQueryClient
  const { data: vacancies, error: vacError } = await closedVacClient
    .from('job_openings_kpi')
    .select('id, title, hired_count, total_candidates')
    .eq('es_proceso_atraccion_actual', false)

  if (vacError) {
    console.error('[atraccion] getClosedVacancyCvsHistory vacancies error:', vacError)
    return []
  }

  const vacList = vacancies ?? []
  if (vacList.length === 0) return []

  const vacancyIds = vacList.map((v) => v.id)

  // 2. Fetch weekly CV data
  type WeeklyRangeQueryClient = {
    from: (table: string) => {
      select: (columns: string) => {
        gte: (column: string, value: string) => {
          lte: (
            col: string,
            val: string,
          ) => Promise<{
            data: VacancyCvWeeklyRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const weeklyClient = supabase as unknown as WeeklyRangeQueryClient
  const { data: rawRows, error: weeklyError } = await weeklyClient
    .from('vacancy_cv_weekly_kpi')
    .select('*')
    .gte('week_start', oldestWeek)
    .lte('week_start', newestWeek)

  if (weeklyError) {
    console.error('[atraccion] getClosedVacancyCvsHistory weekly error:', weeklyError)
  }

  // 3. Fetch promo links
  type PromoLinkQueryClient = {
    from: (table: string) => {
      select: (columns: string) => Promise<{
        data: PromoLinkRow[] | null
        error: { message: string } | null
      }>
    }
  }

  const promoClient = supabase as unknown as PromoLinkQueryClient
  const { data: promoLinks, error: promoError } = await promoClient
    .from('promo_job_link_kpi')
    .select('job_opening_id, promocion_nombre')

  if (promoError) {
    console.error('[atraccion] getClosedVacancyCvsHistory promo links error:', promoError)
  }

  // Build promo map: vacancyId → promoName
  const promoMap = new Map<string, string>()
  for (const link of promoLinks ?? []) {
    if (link.job_opening_id && link.promocion_nombre) {
      promoMap.set(link.job_opening_id, link.promocion_nombre)
    }
  }

  // Build weekly data by vacancy
  const byVacancy = new Map<string, Map<string, number>>()
  for (const row of rawRows ?? []) {
    const vacancyId = row.vacancy_id ?? row.job_opening_id
    if (!vacancyId) continue
    if (!vacancyIds.includes(vacancyId)) continue

    const weekStart = normalizeToIsoMonday(row.week_start ?? row.week)
    if (!weekStart) continue
    if (weekStart < oldestWeek || weekStart > newestWeek) continue

    const count = toNumberCount(
      row.candidate_count ?? row.count ?? row.cv_count ?? row.new_cvs ?? row.total,
    )

    if (!byVacancy.has(vacancyId)) byVacancy.set(vacancyId, new Map())
    const weekMap = byVacancy.get(vacancyId)!
    weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + count)
  }

  // Build result — only include vacancies that have at least some weekly data
  const result: ClosedVacancyCvsEntry[] = []

  for (const v of vacList) {
    const weekMap = byVacancy.get(v.id)
    if (!weekMap || weekMap.size === 0) continue

    const history: VacancyWeeklyCvPoint[] = weekStarts.map((weekStart) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      count: weekMap.get(weekStart) ?? 0,
    }))

    const totalInHistory = history.reduce((s, p) => s + p.count, 0)
    if (totalInHistory === 0) continue

    result.push({
      vacancyId: v.id,
      title: v.title ?? 'Vacante sin título',
      promoName: promoMap.get(v.id) ?? null,
      hiredCount: v.hired_count ?? 0,
      totalCandidates: v.total_candidates ?? 0,
      history,
    })
  }

  return result.sort((a, b) => b.totalCandidates - a.totalCandidates)
}

export async function getClosedVacancyCvsByPromo(
  weeks = 52,
): Promise<ClosedVacancyPromoSummary[]> {
  const entries = await getClosedVacancyCvsHistory(weeks)

  const promoMap = new Map<
    string,
    { totalCandidates: number; hiredCount: number; weekTotals: Map<string, number> }
  >()

  for (const entry of entries) {
    const key = entry.promoName ?? '(Sin promo)'
    if (!promoMap.has(key)) {
      promoMap.set(key, { totalCandidates: 0, hiredCount: 0, weekTotals: new Map() })
    }
    const bucket = promoMap.get(key)!
    bucket.totalCandidates += entry.totalCandidates
    bucket.hiredCount += entry.hiredCount

    for (const point of entry.history) {
      bucket.weekTotals.set(
        point.weekStart,
        (bucket.weekTotals.get(point.weekStart) ?? 0) + point.count,
      )
    }
  }

  const allWeekStarts =
    entries.length > 0 ? entries[0].history.map((p) => p.weekStart) : []

  const result: ClosedVacancyPromoSummary[] = []

  for (const [promoName, bucket] of promoMap.entries()) {
    const history: VacancyWeeklyCvPoint[] = allWeekStarts.map((weekStart) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      count: bucket.weekTotals.get(weekStart) ?? 0,
    }))

    result.push({
      promoName,
      totalCandidates: bucket.totalCandidates,
      hiredCount: bucket.hiredCount,
      history,
    })
  }

  // Sort by total candidates desc, top 15
  result.sort((a, b) => b.totalCandidates - a.totalCandidates)
  return result.slice(0, 15)
}

// ---------------------------------------------------------------------------
// Closed vacancies — weekly CV history grouped by VACANCY (top 12)
// ---------------------------------------------------------------------------

export interface ClosedVacancyHistoryPoint {
  weekStart: string
  weekLabel: string
  count: number
}

export interface ClosedVacancyBySeries {
  vacancyId: string
  title: string
  totalCandidates: number
  peakWeekLabel: string | null
  points: ClosedVacancyHistoryPoint[]
}

/**
 * Returns top-12 closed vacancies (by total CVs in the last N weeks),
 * each with their weekly CV history.
 *
 * Data source: vacancy_cv_weekly_kpi joined with job_openings_kpi
 * where es_proceso_atraccion_actual = false.
 *
 * Reuses getClosedVacancyCvsHistory to avoid duplicating query logic.
 */
export async function getClosedVacancyCvsHistoryByVacancy(
  weeks = 52,
): Promise<ClosedVacancyBySeries[]> {
  const safeWeeks = Math.min(52, Math.max(1, Math.trunc(weeks)))
  const entries = await getClosedVacancyCvsHistory(safeWeeks)

  // entries is already sorted by totalCandidates desc — take top 12
  const top12 = entries.slice(0, 12)

  return top12.map((entry) => {
    // Find the week with the most CVs (peak week)
    let peakCount = 0
    let peakWeekLabel: string | null = null

    for (const point of entry.history) {
      if (point.count > peakCount) {
        peakCount = point.count
        peakWeekLabel = point.weekLabel
      }
    }

    return {
      vacancyId: entry.vacancyId,
      title: entry.title,
      totalCandidates: entry.totalCandidates,
      peakWeekLabel: peakCount > 0 ? peakWeekLabel : null,
      points: entry.history.map((p) => ({
        weekStart: p.weekStart,
        weekLabel: p.weekLabel,
        count: p.count,
      })),
    }
  })
}

// ---------------------------------------------------------------------------
// Promo ↔ Vacancy classification links
// ---------------------------------------------------------------------------

export interface PromoVacancyLink {
  id: string
  promo_nombre: string
  vacancy_id: string
  vacancy_title: string | null
  tipo: 'atraccion' | 'formacion'
  created_at: string
}

/** Get all links for a given promo, enriched with vacancy title from job_openings_kpi */
export async function getPromoVacancyLinks(promoNombre: string): Promise<PromoVacancyLink[]> {
  const { data: links, error } = await (supabase as any)
    .from('promo_vacancy_links')
    .select('id, promo_nombre, vacancy_id, tipo, created_at')
    .eq('promo_nombre', promoNombre)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[atraccion] getPromoVacancyLinks error:', error)
    return []
  }

  const rows = (links ?? []) as { id: string; promo_nombre: string; vacancy_id: string; tipo: string; created_at: string }[]
  if (rows.length === 0) return []

  const vacancyIds = rows.map((r) => r.vacancy_id)
  const { data: vacancies, error: vacError } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, title')
    .in('id', vacancyIds)

  if (vacError) {
    console.error('[atraccion] getPromoVacancyLinks vacancy titles error:', vacError)
  }

  const titleMap = new Map<string, string>()
  for (const v of (vacancies ?? []) as { id: string; title: string | null }[]) {
    titleMap.set(v.id, v.title ?? '')
  }

  return rows.map((r) => ({
    id: r.id,
    promo_nombre: r.promo_nombre,
    vacancy_id: r.vacancy_id,
    vacancy_title: titleMap.get(r.vacancy_id) ?? null,
    tipo: r.tipo as 'atraccion' | 'formacion',
    created_at: r.created_at,
  }))
}

/** Add a link between a promo and a vacancy */
export async function addPromoVacancyLink(
  promoNombre: string,
  vacancyId: string,
  tipo: 'atraccion' | 'formacion',
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from('promo_vacancy_links')
    .insert({ promo_nombre: promoNombre, vacancy_id: vacancyId, tipo })

  if (error) {
    console.error('[atraccion] addPromoVacancyLink error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Closed vacancies — unified view (CVs history + tags + success rate)
// ─────────────────────────────────────────────────────────────────────────────

export interface ClosedVacancyUnified {
  id: string
  title: string
  year: number | null
  status: string | null
  totalCandidates: number
  hiredCount: number
  approvedCount: number        // candidates with status containing 'approved' or 'client'
  successRate: number | null   // (hired + approved) / totalCandidates — null if totalCandidates === 0
  peakWeekLabel: string | null
  totalWeeklyCVs: number       // sum of all weekly counts in history
  series: ClosedVacancyHistoryPoint[]
  /** Alias for series — used by newer components */
  points: ClosedVacancyHistoryPoint[]
  tags: Record<string, number>
}

export interface ClosedVacanciesUnifiedData {
  vacancies: ClosedVacancyUnified[]   // sorted by totalCandidates desc
  /** year → { totalCVs, top 8 vacancies by CVs for stacked bar chart } */
  byYear: Record<number, { totalCVs: number; top: { title: string; cvs: number }[] }>
  kpis: {
    totalVacancies: number
    avgSuccessRate: number | null     // average of successRate across vacancies with totalCandidates > 0
    totalCVsHistorical: number        // sum of totalCandidates across all vacancies
  }
  channelSummary: {
    fr: number    // sum of counts for tags starting with 'FR'
    cp: number    // sum of counts for tags starting with 'CP'
    gw: number    // sum of counts for tags starting with 'GW'
    other: number // everything else
  }
}

export async function getClosedVacanciesUnified(
  weeks = 52,
): Promise<ClosedVacanciesUnifiedData> {
  // Step 1: get all weekly CV history (es_proceso_atraccion_actual = false)
  const entries = await getClosedVacancyCvsHistory(weeks)
  if (entries.length === 0) {
    return {
      vacancies: [],
      byYear: {},
      kpis: { totalVacancies: 0, avgSuccessRate: null, totalCVsHistorical: 0 },
      channelSummary: { fr: 0, cp: 0, gw: 0, other: 0 },
    }
  }

  const vacancyIds = entries.map(e => e.vacancyId)

  // Step 2: fetch date_opened and status for those vacancies
  const { data: metaRows } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, date_opened, status')
    .in('id', vacancyIds)

  const metaMap = new Map<string, { date_opened: string | null; status: string | null }>()
  for (const row of metaRows ?? []) {
    metaMap.set(row.id, { date_opened: row.date_opened ?? null, status: row.status ?? null })
  }

  // Step 3: fetch tag counts
  const tagCountsMap = await getVacancyTagCountsMap(vacancyIds)

  // Step 4: fetch approved-by-client counts from vacancy_status_counts_kpi
  const { data: statusRows } = await (supabase as any)
    .from('vacancy_status_counts_kpi')
    .select('vacancy_id, status, count')
    .in('vacancy_id', vacancyIds)

  const approvedMap = new Map<string, number>()
  for (const row of statusRows ?? []) {
    const s: string = (row.status ?? '').toLowerCase()
    const isApproved = s.includes('approved') || s.includes('client') || s.includes('aprobado')
    if (isApproved) {
      approvedMap.set(row.vacancy_id, (approvedMap.get(row.vacancy_id) ?? 0) + (row.count ?? 0))
    }
  }

  // Step 5: build ClosedVacancyUnified[]
  const vacancies: ClosedVacancyUnified[] = []
  const byYearRaw: Record<number, { totalCVs: number; vacancies: { title: string; cvs: number }[] }> = {}
  const channelSummary = { fr: 0, cp: 0, gw: 0, other: 0 }

  for (const entry of entries) {
    const meta = metaMap.get(entry.vacancyId)
    const year = meta?.date_opened ? new Date(meta.date_opened).getFullYear() : null
    const tags = tagCountsMap.get(entry.vacancyId) ?? {}
    const approvedCount = approvedMap.get(entry.vacancyId) ?? 0
    const successRate =
      entry.totalCandidates > 0
        ? (entry.hiredCount + approvedCount) / entry.totalCandidates
        : null

    // peak week from series
    let peakCount = 0
    let peakWeekLabel: string | null = null
    for (const pt of entry.history) {
      if (pt.count > peakCount) { peakCount = pt.count; peakWeekLabel = pt.weekLabel }
    }

    const totalWeeklyCVs = entry.history.reduce((s, p) => s + p.count, 0)

    // byYear accumulation — track per-vacancy CVs for stacked bar chart
    if (year) {
      if (!byYearRaw[year]) byYearRaw[year] = { totalCVs: 0, vacancies: [] }
      byYearRaw[year].totalCVs += totalWeeklyCVs
      byYearRaw[year].vacancies.push({ title: entry.title, cvs: totalWeeklyCVs })
    }

    // channel summary
    for (const [tag, count] of Object.entries(tags)) {
      const upper = tag.toUpperCase()
      if (upper.startsWith('FR')) channelSummary.fr += count
      else if (upper.startsWith('CP')) channelSummary.cp += count
      else if (upper.startsWith('GW')) channelSummary.gw += count
      else channelSummary.other += count
    }

    const historyPoints = entry.history.map((p) => ({
      weekStart: p.weekStart,
      weekLabel: p.weekLabel,
      count: p.count,
    }))

    vacancies.push({
      id: entry.vacancyId,
      title: entry.title,
      year,
      status: meta?.status ?? null,
      totalCandidates: entry.totalCandidates,
      hiredCount: entry.hiredCount,
      approvedCount,
      successRate,
      peakWeekLabel,
      totalWeeklyCVs,
      series: historyPoints,
      points: historyPoints,
      tags,
    })
  }

  // Build rich byYear — top 8 vacancies per year by CVs
  const byYear: Record<number, { totalCVs: number; top: { title: string; cvs: number }[] }> = {}
  for (const [yearStr, data] of Object.entries(byYearRaw)) {
    const yr = Number(yearStr)
    byYear[yr] = {
      totalCVs: data.totalCVs,
      top: data.vacancies.sort((a, b) => b.cvs - a.cvs).slice(0, 8),
    }
  }

  // KPIs
  const withCandidates = vacancies.filter(v => v.totalCandidates > 0)
  const avgSuccessRate =
    withCandidates.length > 0
      ? withCandidates.reduce((s, v) => s + (v.successRate ?? 0), 0) / withCandidates.length
      : null

  return {
    vacancies,
    byYear,
    kpis: {
      totalVacancies: vacancies.length,
      avgSuccessRate,
      totalCVsHistorical: vacancies.reduce((s, v) => s + v.totalCandidates, 0),
    },
    channelSummary,
  }
}

// ---------------------------------------------------------------------------
// Tipos de profesional desde la tabla dinámica
// ---------------------------------------------------------------------------

export interface TipoProfesionalRow {
  slug: string
  label: string
  color_bg: string
  color_text: string
  color_border: string
  orden: number
}

export async function getTiposProfesional(): Promise<TipoProfesionalRow[]> {
  const { data, error } = await (supabase as any)
    .from('tipos_profesional_kpi')
    .select('slug, label, color_bg, color_text, color_border, orden')
    .order('orden', { ascending: true })

  if (error) {
    console.error('[atraccion] getTiposProfesional error:', error)
    return []
  }
  return data ?? []
}

/** Remove a link by its id */
export async function removePromoVacancyLink(linkId: string): Promise<{ success: boolean }> {
  const { error } = await (supabase as any)
    .from('promo_vacancy_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    console.error('[atraccion] removePromoVacancyLink error:', error)
    return { success: false }
  }
  return { success: true }
}

/**
 * Get all active atracción vacancies not yet linked to the given promo.
 * Used to populate the vacancy picker when adding a new link.
 */
export async function getUnlinkedAtraccionVacancies(
  promoNombre: string,
): Promise<{ id: string; title: string }[]> {
  // Fetch all active atracción vacancies
  const { data: vacancies, error: vacError } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, title')
    .eq('es_proceso_atraccion_actual', true)
    .order('title', { ascending: true })

  if (vacError) {
    console.error('[atraccion] getUnlinkedAtraccionVacancies vacancies error:', vacError)
    return []
  }

  const allVacancies = (vacancies ?? []) as { id: string; title: string | null }[]
  if (allVacancies.length === 0) return []

  // Fetch already-linked vacancy ids for this promo
  const { data: linked, error: linkedError } = await (supabase as any)
    .from('promo_vacancy_links')
    .select('vacancy_id')
    .eq('promo_nombre', promoNombre)

  if (linkedError) {
    console.error('[atraccion] getUnlinkedAtraccionVacancies linked error:', linkedError)
  }

  const linkedIds = new Set(
    ((linked ?? []) as { vacancy_id: string }[]).map((r) => r.vacancy_id),
  )

  return allVacancies
    .filter((v) => !linkedIds.has(v.id))
    .map((v) => ({ id: v.id, title: v.title ?? 'Sin título' }))
}

export async function getAtraccionVacancies(): Promise<AtraccionVacancy[]> {
  // Only show vacancies tagged “Proceso atracciÃ³n actual” â€” the ~20 active
  // recruitment processes. This is the source of truth for what's actively
  // being recruited right now, regardless of job opening status field.
  const { data, error } = await supabase
    .from('job_openings_kpi')
    .select(
      'id, title, status, client_name, owner, tipo_profesional, total_candidates, hired_count, es_proceso_atraccion_actual, date_opened',
    )
    .eq('es_proceso_atraccion_actual', true)
    .order('total_candidates', { ascending: false })

  if (error) {
    console.error('Error fetching atraccion vacancies:', error)
    return []
  }

  const vacancies = data ?? []
  if (vacancies.length === 0) return []

  const vacIds = vacancies.map((v) => v.id)

  const { data: approvedRows } = await supabase
    .from('vacancy_status_counts_kpi')
    .select('vacancy_id, count')
    .in('vacancy_id', vacIds)
    .eq('status', 'Approved by client')

  const approvedMap = new Map<string, number>()
  for (const row of approvedRows ?? []) {
    approvedMap.set(row.vacancy_id, row.count)
  }

  return vacancies.map((v) => ({
    ...v,
    approved_count: approvedMap.get(v.id) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Vacancy profession config — read & write
// ---------------------------------------------------------------------------

export interface VacancyForConfig {
  id: string
  /** Last 6 chars of the Zoho internal ID — short visual identifier */
  shortId: string
  /** Zoho sequential job number (3-4 digits, e.g. 665) — null until backfill runs */
  jobNumber: number | null
  title: string
  tipoProfesionalDb: TipoProfesional
  tipoProfesionalRegex: TipoProfesional
  isActive: boolean
  isVacantePrincipal: boolean
}

export async function getVacanciesForProfessionConfig(): Promise<VacancyForConfig[]> {
  const { data, error } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, title, tipo_profesional, es_proceso_atraccion_actual, zoho_job_number, is_vacante_principal')
    .order('es_proceso_atraccion_actual', { ascending: false })
    .order('title', { ascending: true })

  if (error || !data) {
    console.error('[atraccion] getVacanciesForProfessionConfig error:', error)
    return []
  }

  return (data as any[]).map((r) => ({
    id: r.id,
    shortId: String(r.id).slice(-6),
    jobNumber: r.zoho_job_number ?? null,
    title: r.title ?? '',
    tipoProfesionalDb: ((r.tipo_profesional ?? 'otro') as TipoProfesional),
    tipoProfesionalRegex: deriveProfesionTipo(r.title ?? ''),
    isActive: r.es_proceso_atraccion_actual ?? false,
    isVacantePrincipal: r.is_vacante_principal ?? false,
  }))
}

export async function updateVacancyTipoProfesional(
  vacancyId: string,
  tipoProfesional: TipoProfesional,
): Promise<{ error: string | null }> {
  const { error } = await (supabase as any)
    .from('job_openings_kpi')
    .update({ tipo_profesional: tipoProfesional })
    .eq('id', vacancyId)

  if (error) {
    console.error('[atraccion] updateVacancyTipoProfesional error:', error)
    return { error: error.message }
  }
  return { error: null }
}

// ---------------------------------------------------------------------------
// Vacante principal por tipo de profesional
// ---------------------------------------------------------------------------

export interface VacantePrincipal {
  id: string
  title: string
  tipo_profesional: string
  zoho_job_number: number | null
  is_vacante_principal: boolean
}

export interface ResumenVacantePrincipal {
  id: string
  title: string
  tipo_profesional: string
  zoho_job_number: number | null
  total_candidates: number
  hired_count: number
  success_rate: number | null
}

/**
 * Marca una vacante como "principal" para su tipo_profesional.
 * Primero obtiene el tipo_profesional de esa vacante, luego
 * desmarca todas las del mismo tipo, y finalmente marca la indicada.
 *
 * IMPORTANTE: usa supabase (cliente público) porque se llama desde
 * componentes client-side en configuración. Para llamadas server-side
 * usar setVacantePrincipalAdmin (que usa supabaseAdmin).
 */
export async function setVacantePrincipal(
  vacancyId: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. Buscar el tipo_profesional de la vacante
  const { data: vacancy, error: fetchError } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, tipo_profesional')
    .eq('id', vacancyId)
    .single()

  if (fetchError || !vacancy) {
    const msg = fetchError?.message ?? 'Vacante no encontrada'
    console.error('[atraccion] setVacantePrincipal fetch error:', msg)
    return { ok: false, error: msg }
  }

  const tipoProfesional = vacancy.tipo_profesional as string

  // 2. Desmarcar todas las del mismo tipo
  const { error: unsetError } = await (supabase as any)
    .from('job_openings_kpi')
    .update({ is_vacante_principal: false })
    .eq('tipo_profesional', tipoProfesional)

  if (unsetError) {
    console.error('[atraccion] setVacantePrincipal unset error:', unsetError)
    return { ok: false, error: unsetError.message }
  }

  // 3. Marcar la vacante indicada
  const { error: setError } = await (supabase as any)
    .from('job_openings_kpi')
    .update({ is_vacante_principal: true })
    .eq('id', vacancyId)

  if (setError) {
    console.error('[atraccion] setVacantePrincipal set error:', setError)
    return { ok: false, error: setError.message }
  }

  return { ok: true }
}

/**
 * Obtiene todas las vacantes marcadas como principal.
 */
export async function getVacantesPrincipales(): Promise<VacantePrincipal[]> {
  const { data, error } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, title, tipo_profesional, zoho_job_number, is_vacante_principal')
    .eq('is_vacante_principal', true)
    .order('tipo_profesional', { ascending: true })

  if (error) {
    console.error('[atraccion] getVacantesPrincipales error:', error)
    return []
  }

  return (data ?? []) as VacantePrincipal[]
}

/**
 * Obtiene el resumen con KPIs de cada vacante principal.
 * Para el success_rate usa: (hired_count + approved_by_client) / total_candidates.
 */
export async function getResumenVacantesPrincipales(): Promise<ResumenVacantePrincipal[]> {
  // 1. Fetch vacantes principales
  const { data: vacancies, error: vacError } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, title, tipo_profesional, zoho_job_number, total_candidates, hired_count')
    .eq('is_vacante_principal', true)
    .order('tipo_profesional', { ascending: true })

  if (vacError || !vacancies || (vacancies as any[]).length === 0) {
    if (vacError) console.error('[atraccion] getResumenVacantesPrincipales error:', vacError)
    return []
  }

  const rows = vacancies as {
    id: string
    title: string | null
    tipo_profesional: string | null
    zoho_job_number: number | null
    total_candidates: number | null
    hired_count: number | null
  }[]

  const ids = rows.map((r) => r.id)

  // 2. Fetch approved_by_client counts
  const { data: statusRows } = await (supabase as any)
    .from('vacancy_status_counts_kpi')
    .select('vacancy_id, count')
    .in('vacancy_id', ids)
    .eq('status', 'Approved by client')

  const approvedMap = new Map<string, number>()
  for (const s of (statusRows ?? []) as { vacancy_id: string; count: number }[]) {
    approvedMap.set(s.vacancy_id, (approvedMap.get(s.vacancy_id) ?? 0) + s.count)
  }

  return rows.map((v) => {
    const total = v.total_candidates ?? 0
    const hired = v.hired_count ?? 0
    const approved = approvedMap.get(v.id) ?? 0
    const success_rate =
      total > 0 ? Math.round(((hired + approved) / total) * 10000) / 100 : null

    return {
      id: v.id,
      title: v.title ?? 'Vacante sin título',
      tipo_profesional: v.tipo_profesional ?? 'otro',
      zoho_job_number: v.zoho_job_number ?? null,
      total_candidates: total,
      hired_count: hired,
      success_rate,
    }
  })
}

// ---------------------------------------------------------------------------
// Resumen atracción — vacantes favoritas con CVs semanales + estado
// ---------------------------------------------------------------------------

function getCurrentIsoMonday(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return monday.toISOString().split('T')[0]
}

export interface ResumenVacanteItem {
  id: string
  title: string
  tipo_profesional: string
  cvsThisWeek: number
  cvsLastWeek: number
  /** CVs per day Mon–Sun of the current ISO week (may be 0 for future days) */
  dailyCvsThisWeek: { day: string; count: number }[]
  statusCounts: { status: string; count: number }[]
  totalCandidates: number
}

export async function getResumenAtraccionVacantes(): Promise<ResumenVacanteItem[]> {
  // 1. Starred vacancies
  const { data: vacancies, error: vacError } = await (supabase as any)
    .from('job_openings_kpi')
    .select('id, title, tipo_profesional, total_candidates')
    .eq('is_vacante_principal', true)
    .order('tipo_profesional', { ascending: true })

  if (vacError || !vacancies || (vacancies as any[]).length === 0) {
    if (vacError) console.error('[atraccion] getResumenAtraccionVacantes vacancies error:', vacError)
    return []
  }

  const rows = vacancies as { id: string; title: string | null; tipo_profesional: string | null; total_candidates: number | null }[]
  const ids = rows.map((r) => r.id)

  // 2. Weekly CVs — this week + last week
  const thisWeek = getCurrentIsoMonday()
  const lastWeekDate = new Date(thisWeek)
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7)
  const lastWeek = lastWeekDate.toISOString().split('T')[0]

  const { data: weeklyRows } = await (supabase as any)
    .from('vacancy_cv_weekly_kpi')
    .select('vacancy_id, week_start, candidate_count')
    .in('vacancy_id', ids)
    .in('week_start', [thisWeek, lastWeek])

  const weeklyMap = new Map<string, { thisWeek: number; lastWeek: number }>()
  for (const id of ids) weeklyMap.set(id, { thisWeek: 0, lastWeek: 0 })
  for (const wr of (weeklyRows ?? []) as { vacancy_id: string; week_start: string; candidate_count: number | null }[]) {
    const entry = weeklyMap.get(wr.vacancy_id)
    if (!entry) continue
    const count = wr.candidate_count ?? 0
    if (wr.week_start === thisWeek) entry.thisWeek += count
    else if (wr.week_start === lastWeek) entry.lastWeek += count
  }

  // 2b. Daily CVs — Mon to Sun of current week (from vacancy_cv_daily_kpi)
  const weekDays: string[] = []
  for (let d = 0; d < 7; d++) {
    const day = new Date(thisWeek)
    day.setUTCDate(day.getUTCDate() + d)
    weekDays.push(day.toISOString().split('T')[0])
  }

  const { data: dailyRows } = await (supabase as any)
    .from('vacancy_cv_daily_kpi')
    .select('vacancy_id, day, candidate_count')
    .in('vacancy_id', ids)
    .in('day', weekDays)

  const dailyMap = new Map<string, Map<string, number>>()
  for (const id of ids) dailyMap.set(id, new Map())
  for (const dr of (dailyRows ?? []) as { vacancy_id: string; day: string; candidate_count: number | null }[]) {
    dailyMap.get(dr.vacancy_id)?.set(dr.day, dr.candidate_count ?? 0)
  }

  // 3. Status counts
  const { data: statusRows } = await (supabase as any)
    .from('vacancy_status_counts_kpi')
    .select('vacancy_id, status, count')
    .in('vacancy_id', ids)

  const statusMap = new Map<string, { status: string; count: number }[]>()
  for (const id of ids) statusMap.set(id, [])
  for (const sr of (statusRows ?? []) as { vacancy_id: string; status: string; count: number }[]) {
    statusMap.get(sr.vacancy_id)?.push({ status: sr.status, count: sr.count })
  }
  // Sort each vacancy's statuses by count desc
  for (const [, arr] of statusMap) arr.sort((a, b) => b.count - a.count)

  return rows.map((v) => ({
    id: v.id,
    title: v.title ?? 'Sin título',
    tipo_profesional: v.tipo_profesional ?? 'otro',
    cvsThisWeek: weeklyMap.get(v.id)?.thisWeek ?? 0,
    cvsLastWeek: weeklyMap.get(v.id)?.lastWeek ?? 0,
    dailyCvsThisWeek: weekDays.map((day) => ({
      day,
      count: dailyMap.get(v.id)?.get(day) ?? 0,
    })),
    statusCounts: statusMap.get(v.id) ?? [],
    totalCandidates: v.total_candidates ?? 0,
  }))
}
