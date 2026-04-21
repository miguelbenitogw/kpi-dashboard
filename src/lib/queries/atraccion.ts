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
  total_candidates: number
  hired_count: number
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
