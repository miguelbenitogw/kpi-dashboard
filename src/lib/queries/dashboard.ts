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
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .not('current_status', 'in', '("Hired","Rejected","Withdrawn")'),

    // Active job openings
    supabase
      .from('job_openings')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Hired this month
    supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('current_status', 'Hired')
      .gte('modified_time', firstOfMonth),

    // SLA alerts - red
    supabase
      .from('sla_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'red')
      .is('resolved_at', null),

    // SLA alerts - yellow
    supabase
      .from('sla_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'yellow')
      .is('resolved_at', null),

    // Total candidates for conversion rate
    supabase
      .from('candidates')
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
    .from('sla_alerts')
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
      .from('sla_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'red')
      .is('resolved_at', null),
    supabase
      .from('sla_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('alert_level', 'yellow')
      .is('resolved_at', null),
  ])

  return {
    red: redRes.count ?? 0,
    yellow: yellowRes.count ?? 0,
  }
}

export interface WeeklyDataPoint {
  week: string
  count: number
}

export async function getWeeklyTrend(): Promise<WeeklyDataPoint[]> {
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84) // 12 weeks

  const { data, error } = await supabase
    .from('daily_snapshot')
    .select('snapshot_date, count')
    .gte('snapshot_date', twelveWeeksAgo.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true })

  if (error) {
    console.error('Error fetching weekly trend:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Aggregate by ISO week
  const weekMap = new Map<string, number>()

  for (const row of data) {
    const date = new Date(row.snapshot_date)
    // Get Monday of that week
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    const weekKey = monday.toISOString().split('T')[0]

    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + (row.count ?? 0))
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

export async function getTopVacancies(limit = 5) {
  const { data, error } = await supabase
    .from('job_openings')
    .select('id, title, total_candidates, hired_count, client_name, status')
    .eq('is_active', true)
    .order('total_candidates', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching top vacancies:', error)
    return []
  }

  return data ?? []
}
