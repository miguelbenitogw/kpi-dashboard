import { supabase } from '@/lib/supabase/client'

export interface DashboardStats {
  activeCandidates: number
  activeJobOpenings: number
  hiredThisMonth: number
  activeSlaAlerts: number
  conversionRate: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    candidatesRes,
    jobOpeningsRes,
    hiredRes,
    alertsRedRes,
    alertsYellowRes,
    totalCandidatesRes,
  ] = await Promise.all([
    // Active candidates (not hired, not rejected)
    supabase
      .from('candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .not('current_status', 'in', '("Hired","Rejected","Withdrawn")'),

    // Active job openings = those tagged "Proceso atracción actual"
    supabase
      .from('job_openings_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('es_proceso_atraccion_actual', true),

    // Hired this month
    supabase
      .from('candidates_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('current_status', 'Hired')
      .gte('modified_time', firstOfMonth),

    // SLA alerts - red
    supabase
      .from('sla_alerts_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'red')
      .is('resolved_at', null),

    // SLA alerts - yellow
    supabase
      .from('sla_alerts_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'yellow')
      .is('resolved_at', null),

    // Total candidates for conversion rate
    supabase
      .from('candidates_kpi')
      .select('id', { count: 'exact', head: true }),
  ])

  const activeCandidates = candidatesRes.count ?? 0
  const activeJobOpenings = jobOpeningsRes.count ?? 0
  const hiredThisMonth = hiredRes.count ?? 0
  const activeSlaAlerts = (alertsRedRes.count ?? 0) + (alertsYellowRes.count ?? 0)
  const totalCandidates = totalCandidatesRes.count ?? 0
  const conversionRate = totalCandidates > 0
    ? Math.round((hiredThisMonth / totalCandidates) * 10000) / 100
    : 0

  return {
    activeCandidates,
    activeJobOpenings,
    hiredThisMonth,
    activeSlaAlerts,
    conversionRate,
  }
}

export async function getActiveSlaAlerts(limit = 5) {
  const { data, error } = await supabase
    .from('sla_alerts_kpi')
    .select('*')
    .is('resolved_at', null)
    .order('days_stuck', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching SLA alerts:', error)
    return []
  }

  return data ?? []
}

export async function getAlertCountsByLevel() {
  const [redRes, yellowRes] = await Promise.all([
    supabase
      .from('sla_alerts_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'red')
      .is('resolved_at', null),
    supabase
      .from('sla_alerts_kpi')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'yellow')
      .is('resolved_at', null),
  ])

  return {
    red: redRes.count ?? 0,
    yellow: yellowRes.count ?? 0,
  }
}

export async function getTopVacancies(limit = 5) {
  const { data, error } = await supabase
    .from('job_openings_kpi')
    .select('id, title, total_candidates, hired_count, client_name, status')
    .eq('es_proceso_atraccion_actual', true)
    .order('total_candidates', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching top vacancies:', error)
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
