import { supabaseAdmin } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: number
  name: string
  sheet_tab_name: string
  tarde_larga_dia: string | null
  tarde_larga_cambios: string | null
  is_active: boolean
}

export interface VacationDay {
  id: number
  member_id: number
  year: number
  day_number: number
  vacation_date: string | null
  status: 'Aprobado' | 'Pendiente'
  member_name?: string
}

export interface VacationMemberSummary {
  member_id: number
  member_name: string
  total_days: number
  approved: number
  pending: number
}

export interface CalendarDayEntry {
  date: string
  members: Array<{ id: number; name: string; status: string }>
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('team_members_kpi')
    .select('id, name, sheet_tab_name, tarde_larga_dia, tarde_larga_cambios, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as TeamMember[]
}

export async function getVacationsByYear(year: number): Promise<VacationDay[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('team_vacations_kpi')
    .select(
      `id, member_id, year, day_number, vacation_date, status,
       team_members_kpi ( name )`,
    )
    .eq('year', year)
    .order('vacation_date', { ascending: true, nullsFirst: false })
    .order('day_number', { ascending: true })

  if (error) throw error

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as number,
    member_id: row.member_id as number,
    year: row.year as number,
    day_number: row.day_number as number,
    vacation_date: row.vacation_date as string | null,
    status: row.status as 'Aprobado' | 'Pendiente',
    member_name: (row.team_members_kpi as { name: string } | null)?.name,
  }))
}

export async function getVacationSummary(year: number): Promise<VacationMemberSummary[]> {
  const rows = await getVacationsByYear(year)

  const byMember = new Map<number, VacationMemberSummary>()

  for (const row of rows) {
    if (!byMember.has(row.member_id)) {
      byMember.set(row.member_id, {
        member_id: row.member_id,
        member_name: row.member_name ?? String(row.member_id),
        total_days: 0,
        approved: 0,
        pending: 0,
      })
    }

    const entry = byMember.get(row.member_id)!
    entry.total_days++
    if (row.status === 'Aprobado') {
      entry.approved++
    } else {
      entry.pending++
    }
  }

  return Array.from(byMember.values()).sort((a, b) =>
    a.member_name.localeCompare(b.member_name),
  )
}

export async function getCalendarData(
  year: number,
  month: number,
): Promise<CalendarDayEntry[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data, error } = await (supabaseAdmin as any)
    .from('team_vacations_kpi')
    .select(
      `vacation_date, status, member_id,
       team_members_kpi ( id, name )`,
    )
    .gte('vacation_date', startDate)
    .lt('vacation_date', endDate)
    .not('vacation_date', 'is', null)
    .order('vacation_date', { ascending: true })

  if (error) throw error

  const byDate = new Map<string, CalendarDayEntry>()

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const date = row.vacation_date as string
    const member = row.team_members_kpi as { id: number; name: string } | null
    if (!member) continue

    if (!byDate.has(date)) {
      byDate.set(date, { date, members: [] })
    }

    byDate.get(date)!.members.push({
      id: member.id,
      name: member.name,
      status: row.status as string,
    })
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}
