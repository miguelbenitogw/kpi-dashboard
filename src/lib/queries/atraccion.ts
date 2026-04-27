import { supabase } from '@/lib/supabase/client'

// Statuses considered as "contacted" (candidate was reached out to)
const CONTACTED_STATUSES = [
  'First Call',
  'Second Call',
  'Check Interest',
  'No Answer',
  'Interview in Progress',
  'Approved by client',
]

// Terminal positive statuses
const TERMINAL_POSITIVE = ['Approved by client', 'Hired']

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
  newThisWeek: number
  history: VacancyWeeklyCvPoint[]
}

export interface ReceivedCvsByVacancyResult {
  summaries: VacancyWeeklyCvSummary[]
  latestSyncedAt: string | null
}

export interface ConversionRates {
  cvToApproved: number
  contactedToApproved: number
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
  const currentMonday = getCurrentIsoWeekMonday()
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

export async function getReceivedCvsByVacancy(
  weeks = 12,
): Promise<ReceivedCvsByVacancyResult> {
  const safeWeeks = Math.min(52, Math.max(1, Math.trunc(weeks)))
  const weekStarts = getRecentIsoMondays(safeWeeks)
  const oldestWeek = weekStarts[0]
  const currentWeek = weekStarts[weekStarts.length - 1]

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
    .lte('week_start', currentWeek)

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
    if (weekStart < oldestWeek || weekStart > currentWeek) continue

    const count = toNumberCount(
      row.candidate_count ?? row.count ?? row.cv_count ?? row.new_cvs ?? row.total,
    )

    if (!byVacancy.has(vacancyId)) byVacancy.set(vacancyId, new Map())
    const weekMap = byVacancy.get(vacancyId)!
    weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + count)
  }

  const vacancyIds = Array.from(byVacancy.keys())
  if (vacancyIds.length === 0) return { summaries: [], latestSyncedAt }

  const { data: vacanciesMeta, error: vacError } = await supabase
    .from('job_openings_kpi')
    .select('id, title, client_name, owner')
    .in('id', vacancyIds)

  if (vacError) {
    console.error('Error fetching vacancy metadata for CV weekly KPI:', vacError)
  }

  const metaMap = new Map(
    (vacanciesMeta ?? []).map((v) => [
      v.id,
      {
        title: v.title,
        clientName: v.client_name ?? null,
        owner: v.owner ?? null,
      },
    ]),
  )

  const summaries: VacancyWeeklyCvSummary[] = vacancyIds.map((vacancyId) => {
    const weekMap = byVacancy.get(vacancyId) ?? new Map<string, number>()
    const history: VacancyWeeklyCvPoint[] = weekStarts.map((weekStart) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      count: weekMap.get(weekStart) ?? 0,
    }))

    const meta = metaMap.get(vacancyId)
    const newThisWeek = weekMap.get(currentWeek) ?? 0

    return {
      vacancyId,
      title: meta?.title ?? 'Vacante sin título',
      clientName: meta?.clientName ?? null,
      owner: meta?.owner ?? null,
      newThisWeek,
      history,
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


export interface VacancyRankingRow {
  vacancyId: string
  vacancyTitle: string
  newThisWeek: number
  previousWeek: number
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
      newThisWeek: summary.newThisWeek,
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

export async function getConversionRates(
  jobOpeningId?: string,
): Promise<ConversionRates> {
  // Fetch candidate IDs linked to atraccion vacantes
  const { data: historyRows, error: historyError } = await supabase
    .from('candidate_job_history_kpi')
    .select('candidate_id')
    .eq('association_type', 'atraccion')

  if (historyError) {
    console.error('Error fetching atraccion candidate ids for conversion:', historyError)
    return { cvToApproved: 0, contactedToApproved: 0 }
  }

  const candidateIds = [
    ...new Set((historyRows ?? []).map((r) => r.candidate_id)),
  ]

  if (candidateIds.length === 0) {
    return { cvToApproved: 0, contactedToApproved: 0 }
  }

  let query = supabase
    .from('candidates_kpi')
    .select('current_status')
    .in('id', candidateIds)

  if (jobOpeningId) {
    query = query.eq('job_opening_id', jobOpeningId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching conversion rates:', error)
    return { cvToApproved: 0, contactedToApproved: 0 }
  }

  if (!data || data.length === 0) {
    return { cvToApproved: 0, contactedToApproved: 0 }
  }

  const totalCVs = data.length
  const contacted = data.filter((r) =>
    CONTACTED_STATUSES.includes(r.current_status ?? ''),
  ).length
  const approved = data.filter((r) =>
    TERMINAL_POSITIVE.includes(r.current_status ?? ''),
  ).length

  const cvToApproved =
    totalCVs > 0 ? Math.round((approved / totalCVs) * 10000) / 100 : 0
  const contactedToApproved =
    contacted > 0 ? Math.round((approved / contacted) * 10000) / 100 : 0

  return { cvToApproved, contactedToApproved }
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
  // Fallback a fecha_fin si fecha_inicio no está cargada.
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
  es_proceso_atraccion_actual: boolean
  date_opened: string | null
}

// ---------------------------------------------------------------------------
// Vacancy × Status recruitment table (es_proceso_atraccion_actual)
// ---------------------------------------------------------------------------

export interface VacancyStatusRow {
  id: string
  title: string
  client_name: string | null
  owner: string | null
  status: string | null
  date_opened: string | null
  total_candidates: number
  hired_count: number
  byStatus: Record<string, number>   // candidate_status_in_jo → count
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
    .select('id, title, client_name, owner, status, date_opened, total_candidates, hired_count')
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

  // Build a lookup: vacancyId → { status → count }
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

  const rows: VacancyStatusRow[] = vacList.map((v) => ({
    id: v.id,
    title: v.title,
    client_name: v.client_name ?? null,
    owner: v.owner ?? null,
    status: v.status ?? null,
    date_opened: v.date_opened ?? null,
    total_candidates: v.total_candidates ?? 0,
    hired_count: v.hired_count ?? 0,
    byStatus: countMap.get(v.id) ?? {},
    total: v.total_candidates ?? 0,
  }))

  return { rows, statuses, lastSynced: latestSyncedAt }
}

// ---------------------------------------------------------------------------
// Promo × Status recruitment table
// ---------------------------------------------------------------------------

export interface PromoStatusRow {
  /** Promotion name, e.g. "Promoción 113" */
  nombre: string
  /** Recruitment target (objetivo_atraccion from promotions_kpi) */
  objetivo: number | null
  /** Currently accepted (total_aceptados) */
  aceptados: number | null
  /** End date */
  fecha_fin: string | null
  /** Coordinator */
  coordinador: string | null
  /** Map status → count for this promo */
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

  // Build rows — include all active promos even if they have 0 candidates
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

export interface VacancyTagCount {
  vacancy_id: string
  tag: string
  count: number
}

/**
 * Get tag counts for a set of vacancy IDs from the pre-computed table.
 * Returns a map: vacancy_id → { tag → count }
 */
export async function getVacancyTagCountsMap(
  vacancyIds: string[]
): Promise<Map<string, Record<string, number>>> {
  if (vacancyIds.length === 0) return new Map()

  const result = new Map<string, Record<string, number>>()
  const PAGE_SIZE = 1000
  let from = 0

  // Paginate — Supabase default row limit is 1000, table has 13k+ rows
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

export async function getAtraccionVacancies(): Promise<AtraccionVacancy[]> {
  // Only show vacancies tagged "Proceso atracción actual" — the ~20 active
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

  return data ?? []
}
