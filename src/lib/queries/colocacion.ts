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
      .from('candidates_kpi')
      .select('promocion_nombre')
      .not('promocion_nombre', 'is', null)
      .neq('current_status', 'Offer Withdrawn')
      .neq('current_status', 'Offer Declined'),
    (supabase as any)
      .from('promo_job_link_kpi')
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
    .from('job_openings_kpi')
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
    .from('candidates_kpi')
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
    .from('candidates_kpi')
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
    .from('candidates_kpi')
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
    .from('candidates_kpi')
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

// ── Full candidate GP record (for the candidate table) ───────────────────────

export interface GPCandidateFull {
  id: string
  full_name: string | null
  promocion_nombre: string | null
  gp_training_status: string | null
  gp_open_to: string | null
  gp_preferences: string | null
  gp_tipo_perfil: string | null
  gp_finish_date: string | null
  gp_assignment: string | null
  gp_hpr_nummer: string | null
  gp_webcruiter: boolean | null
  gp_application_sent: boolean | null
  gp_profile_talent_portal: boolean | null
  gp_cv_norsk: boolean | null
  gp_blind_cv_norsk: boolean | null
  gp_total_applications: number | null
  gp_interviews_ratio: string | null
  gp_applications_this_period: number | null
  gp_quincena: string | null
  gp_pk: string | null
  gp_priority: string | null
  gp_seminar: string | null
  gp_mes_anio_llegada: string | null
}

export async function getGPCandidatesFull(
  promoNombre?: string | null,
): Promise<GPCandidateFull[]> {
  let query = (supabase as any)
    .from('candidates_kpi')
    .select(
      'id, full_name, promocion_nombre,' +
      'gp_training_status, gp_open_to, gp_preferences, gp_tipo_perfil,' +
      'gp_finish_date, gp_assignment,' +
      'gp_hpr_nummer, gp_webcruiter, gp_application_sent, gp_profile_talent_portal,' +
      'gp_cv_norsk, gp_blind_cv_norsk,' +
      'gp_total_applications, gp_interviews_ratio, gp_applications_this_period,' +
      'gp_quincena, gp_pk, gp_priority, gp_seminar, gp_mes_anio_llegada',
    )
    .not('gp_training_status', 'is', null)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (promoNombre) query = query.eq('promocion_nombre', promoNombre)

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as GPCandidateFull[]
}

// ── KPI stats — placement funnel ─────────────────────────────────────────────

// Statuses that mean the candidate exited the pipeline (don't count in denominator)
const GP_EXCLUDED = new Set([
  'Offer Withdrawn', 'Offer Declined', 'Expelled', 'No Show',
])

// Successfully placed
const GP_PLACED = new Set([
  'Approved by client', 'Assigned', 'Hired', 'Transferred',
])

// Finished training but waiting for a placement
const GP_PENDING = new Set([
  'To Place', 'Rejected by client', 'Next Project', 'Waiting for consensus', 'Stand By',
])

// Still in training (not ready for placement yet)
const GP_IN_TRAINING = new Set(['In Training'])

export interface GPKPIStats {
  total_active:  number   // all GP candidates excluding exited ones
  placed:        number   // Approved + Assigned + Hired + Transferred
  in_training:   number   // In Training
  pending:       number   // finished but no placement yet
  pct_placed:    number   // placed / total_active * 100
  pct_pending:   number   // pending / total_active * 100
  pct_training:  number   // in_training / total_active * 100
}

export async function getGPKPIStats(promoNombre?: string | null): Promise<GPKPIStats> {
  let query = (supabase as any)
    .from('candidates_kpi')
    .select('gp_training_status')
    .not('gp_training_status', 'is', null)

  if (promoNombre) query = query.eq('promocion_nombre', promoNombre)

  const { data } = await query
  const rows: { gp_training_status: string }[] = data ?? []

  const active    = rows.filter((r) => !GP_EXCLUDED.has(r.gp_training_status))
  const placed    = active.filter((r) => GP_PLACED.has(r.gp_training_status)).length
  const training  = active.filter((r) => GP_IN_TRAINING.has(r.gp_training_status)).length
  const pending   = active.filter((r) => GP_PENDING.has(r.gp_training_status)).length
  const total     = active.length

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 10) / 10 : 0

  return {
    total_active:  total,
    placed,
    in_training:   training,
    pending,
    pct_placed:    pct(placed),
    pct_pending:   pct(pending),
    pct_training:  pct(training),
  }
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
