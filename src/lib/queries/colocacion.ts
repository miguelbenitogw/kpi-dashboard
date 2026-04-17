import { supabase } from '@/lib/supabase/client'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface GPStatusCount {
  status: string
  count: number
  percentage: number
}

export interface GPCandidateSummary {
  id: string
  full_name: string | null
  gp_training_status: string | null
  gp_open_to: string | null
  gp_availability: string | null
  assigned_agency: string | null
  gp_assignment: string | null
}

export interface PromoGPSummary {
  name: string
  count: number
  linked_job_opening_id: string | null
  linked_job_opening_title: string | null
}

export interface JobOpeningOption {
  id: string
  title: string
}

// ── Promotions with GP data ───────────────────────────────────────────────────

export async function getGPPromotions(): Promise<PromoGPSummary[]> {
  const [candidatesRes, linksRes] = await Promise.all([
    (supabase as any)
      .from('candidates')
      .select('promocion_nombre')
      .not('promocion_nombre', 'is', null)
      .neq('current_status', 'Offer Withdrawn')
      .neq('current_status', 'Offer Declined'),
    (supabase as any)
      .from('promo_job_link')
      .select('promocion_nombre, job_opening_id, job_openings(id, title)'),
  ])

  const counts = new Map<string, number>()
  for (const row of candidatesRes.data ?? []) {
    const name = row.promocion_nombre as string
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const links = new Map<string, { id: string; title: string }>()
  for (const l of linksRes.data ?? []) {
    if (l.job_opening_id && l.job_openings) {
      links.set(l.promocion_nombre, {
        id: l.job_opening_id,
        title: l.job_openings.title,
      })
    }
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({
      name,
      count,
      linked_job_opening_id: links.get(name)?.id ?? null,
      linked_job_opening_title: links.get(name)?.title ?? null,
    }))
}

// ── Job opening search (for the linker UI) ────────────────────────────────────

export async function searchJobOpenings(query: string): Promise<JobOpeningOption[]> {
  if (!query || query.trim().length < 2) return []

  const { data, error } = await supabase
    .from('job_openings')
    .select('id, title')
    .ilike('title', `%${query.trim()}%`)
    .order('title', { ascending: true })
    .limit(15)

  if (error) return []
  return (data ?? []) as JobOpeningOption[]
}

// ── GP counts (filterable by promotion) ───────────────────────────────────────

export async function getGPTrainingStatusCounts(
  promocionNombre?: string | null,
): Promise<GPStatusCount[]> {
  let query = (supabase as any)
    .from('candidates')
    .select('current_status')
    .not('current_status', 'is', null)
    .not('promocion_nombre', 'is', null)
    .neq('current_status', 'Offer Withdrawn')
    .neq('current_status', 'Offer Declined')

  if (promocionNombre) query = query.eq('promocion_nombre', promocionNombre)

  const { data, error } = await query
  if (error) return []
  if (!data || data.length === 0) return []

  const total = data.length
  const countMap = new Map<string, number>()
  for (const row of data) {
    const val = (row.current_status as string) || 'Sin dato'
    countMap.set(val, (countMap.get(val) ?? 0) + 1)
  }

  return Array.from(countMap.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getGPOpenToCounts(
  promocionNombre?: string | null,
): Promise<GPStatusCount[]> {
  let query = (supabase as any)
    .from('candidates')
    .select('gp_open_to')
    .not('gp_open_to', 'is', null)
    .neq('current_status', 'Offer Withdrawn')
    .neq('current_status', 'Offer Declined')

  if (promocionNombre) query = query.eq('promocion_nombre', promocionNombre)

  const { data, error } = await query
  if (error) return []
  if (!data || data.length === 0) return []

  const total = data.length
  const countMap = new Map<string, number>()
  for (const row of data) {
    const val = (row.gp_open_to as string) || 'Sin dato'
    countMap.set(val, (countMap.get(val) ?? 0) + 1)
  }

  return Array.from(countMap.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── GP candidate detail (filterable by promotion) ────────────────────────────

export async function getGPCandidatesByStatus(
  status: string,
  promocionNombre?: string | null,
): Promise<GPCandidateSummary[]> {
  let query = (supabase as any)
    .from('candidates')
    .select(
      'id, full_name, gp_training_status, gp_open_to, gp_availability, assigned_agency, gp_assignment',
    )
    .eq('current_status', status)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (promocionNombre) query = query.eq('promocion_nombre', promocionNombre)

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as GPCandidateSummary[]
}

export async function getGPCandidatesByOpenTo(
  openTo: string,
  promocionNombre?: string | null,
): Promise<GPCandidateSummary[]> {
  let query = (supabase as any)
    .from('candidates')
    .select(
      'id, full_name, gp_training_status, gp_open_to, gp_availability, assigned_agency, gp_assignment',
    )
    .eq('gp_open_to', openTo)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (promocionNombre) query = query.eq('promocion_nombre', promocionNombre)

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as GPCandidateSummary[]
}

// ── Legacy (kept for backward compat with other components) ──────────────────

export interface PlacementPreferenceCount {
  preference: string
  count: number
  percentage: number
}

export interface PlacementStatusCount {
  status: string
  count: number
  percentage: number
}

export interface PlacementClient {
  client: string
  candidateCount: number
}
