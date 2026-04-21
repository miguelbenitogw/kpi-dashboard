import { supabase } from '@/lib/supabase/client'

const FORMATION_STATES = [
  'Hired',
  'In Training',
  'Offer-Withdrawn',
  'Expelled',
  'Transferred',
  'To Place',
  'Assigned',
  'Stand-by',
  'Training Finished',
] as const

const RETAINED_STATES = ['Hired', 'Training Finished', 'Assigned', 'To Place']

export interface FormacionStateRow {
  status: string
  count: number
  percentage: number
}

export interface RetentionMetrics {
  objetivo: number
  actual: number
  percentage: number
  trafficLight: 'good' | 'warning' | 'danger'
}

export interface DropoutByWeek {
  week: number
  count: number
}

export interface DropoutByMonth {
  month: string
  count: number
}

export interface DropoutByLevel {
  level: string
  count: number
}

export interface DropoutByReason {
  reason: string
  count: number
}

export interface DropoutByInterest {
  interest: string
  count: number
}

export interface DropoutAnalysisData {
  byWeek: DropoutByWeek[]
  byMonth: DropoutByMonth[]
  byLanguageLevel: DropoutByLevel[]
  byReason: DropoutByReason[]
  byInterest: DropoutByInterest[]
  totalDropouts: number
  dropoutRate: number
  avgWeeksOfTraining: number | null
  avgAttendancePct: number | null
}

export interface PromotionFormacionOverview {
  id: string
  nombre: string
  season: string | null
  objetivo: number
  actual: number
  dropouts: number
  trafficLight: 'good' | 'warning' | 'danger'
}

function computeTrafficLight(ratio: number): 'good' | 'warning' | 'danger' {
  if (ratio >= 1.0) return 'good'
  if (ratio >= 0.9) return 'warning'
  return 'danger'
}

export async function getFormacionStates(
  promoNombres?: string[],
): Promise<FormacionStateRow[]> {
  let query = supabase
    .from('candidates_kpi')
    .select('current_status')
    .in('current_status', [...FORMATION_STATES])

  if (promoNombres && promoNombres.length > 0) {
    query = query.in('promocion_nombre', promoNombres)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching formacion states:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const total = data.length
  const counts = new Map<string, number>()

  for (const row of data) {
    const status = row.current_status ?? 'Unknown'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  return FORMATION_STATES.filter((s) => counts.has(s)).map((status) => {
    const count = counts.get(status) ?? 0
    return {
      status,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }
  })
}

export async function getRetentionMetrics(
  promotionId: string,
): Promise<RetentionMetrics> {
  const [promoRes, retainedRes] = await Promise.all([
    supabase
      .from('promotions_kpi')
      .select('expectativa_finalizan')
      .eq('id', promotionId)
      .single(),

    supabase
      .from('candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('promocion_nombre', promotionId)
      .in('current_status', RETAINED_STATES),
  ])

  const objetivo = promoRes.data?.expectativa_finalizan ?? 0
  const actual = retainedRes.count ?? 0
  const ratio = objetivo > 0 ? actual / objetivo : 0

  return {
    objetivo,
    actual,
    percentage: Math.round(ratio * 10000) / 100,
    trafficLight: computeTrafficLight(ratio),
  }
}

export async function getDropoutAnalysis(
  promoNombres?: string[],
): Promise<DropoutAnalysisData> {
  const dropoutStatuses = ['Offer-Withdrawn', 'Expelled', 'Transferred']

  let query = supabase
    .from('candidates_kpi')
    .select(
      'dropout_reason, dropout_date, dropout_language_level, dropout_attendance_pct, dropout_weeks_of_training, dropout_months_of_training, dropout_interest_future, current_status',
    )
    .in('current_status', dropoutStatuses)

  if (promoNombres && promoNombres.length > 0) {
    query = query.in('promocion_nombre', promoNombres)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching dropout analysis:', error)
    return {
      byWeek: [],
      byMonth: [],
      byLanguageLevel: [],
      byReason: [],
      byInterest: [],
      totalDropouts: 0,
      dropoutRate: 0,
      avgWeeksOfTraining: null,
      avgAttendancePct: null,
    }
  }

  const dropouts = data ?? []

  let totalProgramQuery = supabase
    .from('candidates_kpi')
    .select('id', { count: 'exact', head: true })
    .in('current_status', [...FORMATION_STATES])

  if (promoNombres && promoNombres.length > 0) {
    totalProgramQuery = totalProgramQuery.in('promocion_nombre', promoNombres)
  }

  const { count: totalPrograma } = await totalProgramQuery
  const total = totalPrograma ?? 0

  const weekCounts = new Map<number, number>()
  const monthCounts = new Map<string, number>()
  const levelCounts = new Map<string, number>()
  const reasonCounts = new Map<string, number>()
  const interestCounts = new Map<string, number>()
  let weeksSum = 0
  let weeksCount = 0
  let attSum = 0
  let attCount = 0

  for (const d of dropouts) {
    if (d.dropout_date) {
      const date = new Date(d.dropout_date)
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const diff = date.getTime() - startOfYear.getTime()
      const weekNum = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
      weekCounts.set(weekNum, (weekCounts.get(weekNum) ?? 0) + 1)

      const monthKey = date.toLocaleDateString('es-AR', {
        month: 'short',
        year: '2-digit',
      })
      monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1)
    }

    const level = d.dropout_language_level ?? 'Sin dato'
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1)

    const reason = d.dropout_reason ?? d.current_status ?? 'Sin motivo'
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)

    const interest = d.dropout_interest_future ?? 'Sin dato'
    interestCounts.set(interest, (interestCounts.get(interest) ?? 0) + 1)

    if (d.dropout_weeks_of_training != null) {
      weeksSum += Number(d.dropout_weeks_of_training)
      weeksCount++
    }
    if (d.dropout_attendance_pct != null) {
      attSum += Number(d.dropout_attendance_pct)
      attCount++
    }
  }

  return {
    byWeek: Array.from(weekCounts.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, count]) => ({ week, count })),
    byMonth: Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count })),
    byLanguageLevel: Array.from(levelCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([level, count]) => ({ level, count })),
    byReason: Array.from(reasonCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([reason, count]) => ({ reason, count })),
    byInterest: Array.from(interestCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([interest, count]) => ({ interest, count })),
    totalDropouts: dropouts.length,
    dropoutRate:
      total > 0
        ? Math.round((dropouts.length / total) * 10000) / 100
        : 0,
    avgWeeksOfTraining: weeksCount > 0
      ? Math.round((weeksSum / weeksCount) * 10) / 10
      : null,
    avgAttendancePct: attCount > 0
      ? Math.round((attSum / attCount) * 10) / 10
      : null,
  }
}

export async function getPromotionsFormacionOverview(): Promise<
  PromotionFormacionOverview[]
> {
  const { data: promotions, error } = await supabase
    .from('promotions_kpi')
    .select('id, nombre, expectativa_finalizan, total_dropouts, is_active, fecha_fin')
    .eq('is_active', true)
    .order('fecha_fin', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching promotions overview:', error)
    return []
  }

  if (!promotions || promotions.length === 0) return []

  const results: PromotionFormacionOverview[] = []

  for (const promo of promotions) {
    const { count } = await supabase
      .from('candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('promocion_nombre', promo.nombre)
      .in('current_status', RETAINED_STATES)

    const objetivo = promo.expectativa_finalizan ?? 0
    const actual = count ?? 0
    const dropouts = promo.total_dropouts ?? 0
    const ratio = objetivo > 0 ? actual / objetivo : 0

    results.push({
      id: promo.id,
      nombre: promo.nombre,
      season: null,
      objetivo,
      actual,
      dropouts,
      trafficLight: computeTrafficLight(ratio),
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Formacion preferences (gp_open_to — comma-separated placement types)
// ---------------------------------------------------------------------------

export interface PreferenceRow {
  preference: string
  count: number
  percentage: number
}

export async function getFormacionPreferences(
  promoNombres?: string[],
): Promise<PreferenceRow[]> {
  // Cast to `any` because `gp_open_to` is not yet in the generated Supabase types (stale)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('candidates_kpi')
    .select('gp_open_to')
    .not('gp_open_to', 'is', null)
    .neq('gp_open_to', '')

  if (promoNombres && promoNombres.length > 0) {
    q = q.in('promocion_nombre', promoNombres)
  }

  const { data, error } = await q as { data: Array<{ gp_open_to: string }> | null; error: unknown }

  if (error) {
    console.error('Error fetching formacion preferences:', error)
    return []
  }

  const prefMap = new Map<string, number>()

  for (const row of data ?? []) {
    const raw = row.gp_open_to
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    for (const p of parts) {
      prefMap.set(p, (prefMap.get(p) ?? 0) + 1)
    }
  }

  const total = Array.from(prefMap.values()).reduce((s, v) => s + v, 0)

  return Array.from(prefMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([preference, count]) => ({
      preference,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
}

// ---------------------------------------------------------------------------
// Candidatos table (promo chip filters + expandable row history)
// ---------------------------------------------------------------------------

export interface FormacionCandidateRow {
  id: string
  full_name: string | null
  current_status: string | null
  promocion_nombre: string | null
  assigned_agency: string | null
  gp_open_to: string | null
  gp_availability: string | null
}

export interface FormacionCandidateHistory {
  job_opening_title: string | null
  candidate_status_in_jo: string | null
  association_type: string | null
  fetched_at: string | null
}

export interface FormacionPromoCount {
  name: string
  count: number
}

/** Returns all promos with candidate counts, sorted by name. */
export async function getFormacionPromos(): Promise<FormacionPromoCount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('candidates_kpi')
    .select('promocion_nombre')
    .not('promocion_nombre', 'is', null) as {
      data: Array<{ promocion_nombre: string }> | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching formacion promos:', error)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const name = row.promocion_nombre
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, count }))
}

/** Returns candidates for a given promo (null = all), ordered by full_name. */
export async function getFormacionCandidates(
  promoNombre: string | null,
): Promise<FormacionCandidateRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('candidates_kpi')
    .select('id, full_name, current_status, promocion_nombre, assigned_agency, gp_open_to, gp_availability')
    .order('full_name', { ascending: true })

  if (promoNombre !== null) {
    q = q.eq('promocion_nombre', promoNombre)
  }

  const { data, error } = await q as {
    data: FormacionCandidateRow[] | null
    error: unknown
  }

  if (error) {
    console.error('Error fetching formacion candidates:', error)
    return []
  }

  return data ?? []
}

/** Returns job history for a candidate (association_type = 'formacion'), ordered by fetched_at DESC. */
export async function getFormacionCandidateHistory(
  candidateId: string,
): Promise<FormacionCandidateHistory[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('candidate_job_history_kpi')
    .select('job_opening_title, candidate_status_in_jo, association_type, fetched_at')
    .eq('candidate_id', candidateId)
    .eq('association_type', 'formacion')
    .order('fetched_at', { ascending: false }) as {
      data: FormacionCandidateHistory[] | null
      error: unknown
    }

  if (error) {
    console.error('Error fetching candidate history:', error)
    return []
  }

  return data ?? []
}
