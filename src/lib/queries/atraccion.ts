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

export async function getAtraccionVacancies(): Promise<AtraccionVacancy[]> {
  const { data, error } = await supabase
    .from('job_openings_kpi')
    .select(
      'id, title, status, client_name, owner, tipo_profesional, total_candidates, hired_count, es_proceso_atraccion_actual, date_opened',
    )
    .eq('category', 'atraccion')
    .eq('is_active', true)
    .order('total_candidates', { ascending: false })

  if (error) {
    console.error('Error fetching atraccion vacancies:', error)
    return []
  }

  return data ?? []
}
