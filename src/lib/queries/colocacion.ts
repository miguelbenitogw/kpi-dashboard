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
    .neq('current_status', 'Expelled')
    .neq('current_status', 'No Show')

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
    .neq('current_status', 'Expelled')
    .neq('current_status', 'No Show')

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
    .not('gp_training_status', 'in', '("Offer Withdrawn","Offer Declined","Expelled","No Show")')
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

// ── Preferencia breakdown (gp_open_to split) ─────────────────────────────────

export interface GPPreferenciaCount {
  preference: string
  count: number
  percentage: number
}

export async function getGPPreferenciaBreakdown(
  promoNombre?: string | null,
): Promise<GPPreferenciaCount[]> {
  let query = (supabase as any)
    .from('candidates_kpi')
    .select('gp_open_to, gp_training_status')
    .not('gp_open_to', 'is', null)
    .not('gp_training_status', 'is', null)

  if (promoNombre) query = query.eq('promocion_nombre', promoNombre)

  const { data } = await query
  const rows: { gp_open_to: string; gp_training_status: string }[] = ((data ?? []) as any[]).filter(
    (r: any) => !['Offer Withdrawn', 'Offer Declined', 'Expelled', 'No Show'].includes(r.gp_training_status ?? '')
  )

  const countMap = new Map<string, number>()
  for (const row of rows) {
    const parts = row.gp_open_to
      .split(',')
      .map((p: string) => p.trim().replace(/Komunner/gi, 'Kommuner'))
      .filter(Boolean)
    for (const pref of parts) {
      countMap.set(pref, (countMap.get(pref) ?? 0) + 1)
    }
  }

  const total = rows.length
  return Array.from(countMap.entries())
    .map(([preference, count]) => ({
      preference,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── Status breakdown (placement_status) ──────────────────────────────────────

export interface GPStatusBreakdownItem {
  status: string
  count: number
  percentage: number
  topClients: string[]
}

export interface GPKommunerCandidate {
  id: string
  full_name: string | null
  gp_training_status: string | null
  placement_status: string | null
  placement_client: string | null
  gp_interviews_ratio: string | null
  gp_total_applications: number | null
  promocion_nombre: string | null
}

export async function getGPStatusBreakdown(
  promoNombre?: string | null,
): Promise<{ items: GPStatusBreakdownItem[]; total: number }> {
  let query = (supabase as any)
    .from('candidates_kpi')
    .select('placement_status, placement_client, gp_training_status')
    .not('gp_training_status', 'is', null)

  if (promoNombre) query = query.eq('promocion_nombre', promoNombre)

  const { data } = await query
  const rows = ((data ?? []) as any[]).filter(
    (r) => !['Offer Withdrawn', 'Offer Declined', 'Expelled', 'No Show'].includes(r.gp_training_status ?? '')
  )

  const withStatus = rows.filter((r) => r.placement_status)
  const total = withStatus.length

  const map = new Map<string, { count: number; clients: Map<string, number> }>()
  for (const row of withStatus) {
    const s = row.placement_status as string
    if (!map.has(s)) map.set(s, { count: 0, clients: new Map() })
    const entry = map.get(s)!
    entry.count++
    if (row.placement_client) {
      const c = String(row.placement_client).trim()
      entry.clients.set(c, (entry.clients.get(c) ?? 0) + 1)
    }
  }

  const items = Array.from(map.entries())
    .map(([status, { count, clients }]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      topClients: Array.from(clients.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c),
    }))
    .sort((a, b) => b.count - a.count)

  return { items, total }
}

export async function getGPKommunerCandidates(
  promoNombre?: string | null,
): Promise<GPKommunerCandidate[]> {
  let query = (supabase as any)
    .from('candidates_kpi')
    .select('id, full_name, gp_training_status, placement_status, placement_client, gp_interviews_ratio, gp_total_applications, promocion_nombre')
    .ilike('gp_open_to', '%kommuner%')
    .not('gp_training_status', 'is', null)
    .order('full_name', { ascending: true })

  if (promoNombre) query = query.eq('promocion_nombre', promoNombre)

  const { data } = await query
  return ((data ?? []) as any[]).filter(
    (r) => !['Offer Withdrawn', 'Offer Declined', 'Expelled', 'No Show'].includes(r.gp_training_status ?? '')
  ) as GPKommunerCandidate[]
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
