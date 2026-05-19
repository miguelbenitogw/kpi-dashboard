import { supabaseAdmin } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlacementMember {
  id: number
  name: string
  is_active: boolean
}

export interface PlacementScheduleEntry {
  date: string
  members: Array<{
    id: number
    name: string
    time_start: string | null
    time_end: string | null
    time_start_2: string | null
    time_end_2: string | null
    modality: string
    status: string
    notes: string | null
  }>
}

export interface PlacementMemberSummary {
  member_id: number
  member_name: string
  total_days: number
  online_days: number
  presencial_days: number
  holiday_days: number
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPlacementMembers(): Promise<PlacementMember[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('placement_team_members')
    .select('id, name, is_active')
    .order('name', { ascending: true })

  if (error) {
    console.error('[getPlacementMembers] error:', error)
    return []
  }

  return (data ?? []) as PlacementMember[]
}

export async function getPlacementCalendar(
  year: number,
  month: number,
): Promise<PlacementScheduleEntry[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth  = month === 12 ? 1  : month + 1
  const endYear   = month === 12 ? year + 1 : year
  const endDate   = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data, error } = await (supabaseAdmin as any)
    .from('placement_schedules')
    .select(
      `schedule_date, time_start, time_end, time_start_2, time_end_2, modality, status, notes,
       placement_team_members!inner ( id, name, is_active )`,
    )
    .gte('schedule_date', startDate)
    .lt('schedule_date', endDate)
    .eq('placement_team_members.is_active', true)
    .order('schedule_date', { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[getPlacementCalendar] error:', error)
    return []
  }

  const byDate = new Map<string, PlacementScheduleEntry>()

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const date   = row.schedule_date as string
    const member = row.placement_team_members as { id: number; name: string } | null
    if (!member) continue

    if (!byDate.has(date)) {
      byDate.set(date, { date, members: [] })
    }

    byDate.get(date)!.members.push({
      id:          member.id,
      name:        member.name,
      time_start:  row.time_start  as string | null,
      time_end:    row.time_end    as string | null,
      time_start_2: row.time_start_2 as string | null,
      time_end_2:  row.time_end_2  as string | null,
      modality:    (row.modality   as string) ?? '',
      status:      (row.status     as string) ?? '',
      notes:       row.notes       as string | null,
    })
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getPlacementSummary(
  year: number,
  month: number,
): Promise<PlacementMemberSummary[]> {
  const entries = await getPlacementCalendar(year, month)

  const byMember = new Map<number, PlacementMemberSummary>()

  for (const entry of entries) {
    for (const m of entry.members) {
      if (!byMember.has(m.id)) {
        byMember.set(m.id, {
          member_id:      m.id,
          member_name:    m.name,
          total_days:     0,
          online_days:    0,
          presencial_days: 0,
          holiday_days:   0,
        })
      }

      const s = byMember.get(m.id)!
      s.total_days++

      const mod     = m.modality?.toLowerCase() ?? ''
      const status  = m.status?.toLowerCase()   ?? ''

      if (status === 'holiday') {
        s.holiday_days++
      } else if (mod === 'presencial') {
        s.presencial_days++
      } else if (mod === 'online') {
        s.online_days++
      }
    }
  }

  return Array.from(byMember.values()).sort((a, b) =>
    a.member_name.localeCompare(b.member_name),
  )
}
