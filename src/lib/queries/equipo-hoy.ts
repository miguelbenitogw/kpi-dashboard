import { supabaseAdmin } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VacacionHoy {
  member_name: string
}

export interface PlacementHoy {
  member_name: string
  time_start: string | null
  time_end: string | null
  time_start_2: string | null
  time_end_2: string | null
  modality: string
  status: string
  notes: string | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getVacacionesHoy(): Promise<VacacionHoy[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await (supabaseAdmin as any)
    .from('team_vacations_kpi')
    .select(
      `vacation_date,
       team_members_kpi!inner ( name, is_active )`,
    )
    .eq('vacation_date', today)
    .eq('team_members_kpi.is_active', true)
    .order('vacation_date', { ascending: true })

  if (error) {
    console.error('[getVacacionesHoy] error:', error)
    return []
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    member_name: (row.team_members_kpi as { name: string } | null)?.name ?? '',
  })).filter((r) => r.member_name !== '')
}

export async function getPlacementHoy(): Promise<PlacementHoy[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await (supabaseAdmin as any)
    .from('placement_schedules')
    .select(
      `time_start, time_end, time_start_2, time_end_2, modality, status, notes,
       placement_team_members!inner ( name, is_active )`,
    )
    .eq('schedule_date', today)
    .eq('placement_team_members.is_active', true)
    .order('time_start', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[getPlacementHoy] error:', error)
    return []
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    member_name: (row.placement_team_members as { name: string } | null)?.name ?? '',
    time_start: row.time_start as string | null,
    time_end: row.time_end as string | null,
    time_start_2: row.time_start_2 as string | null,
    time_end_2: row.time_end_2 as string | null,
    modality: (row.modality as string) ?? '',
    status: (row.status as string) ?? '',
    notes: row.notes as string | null,
  })).filter((r) => r.member_name !== '')
}
