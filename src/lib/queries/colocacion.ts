import { supabase } from '@/lib/supabase/client'

// ── GP-based queries (Global Placement tab) ──────────────────────────────────

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
  gp_priority: string | null
  gp_availability: string | null
  assigned_agency: string | null
}

export async function getGPTrainingStatusCounts(): Promise<GPStatusCount[]> {
  const { data, error } = await (supabase as any)
    .from('candidates')
    .select('gp_training_status')
    .not('gp_training_status', 'is', null)

  if (error) {
    console.error('Error fetching GP training status counts:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const total = data.length
  const countMap = new Map<string, number>()
  for (const row of data) {
    const val = (row.gp_training_status as string) || 'Sin dato'
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

export async function getGPOpenToCounts(): Promise<GPStatusCount[]> {
  const { data, error } = await (supabase as any)
    .from('candidates')
    .select('gp_open_to')
    .not('gp_open_to', 'is', null)

  if (error) {
    console.error('Error fetching GP open to counts:', error)
    return []
  }

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

export async function getGPCandidatesByStatus(
  status: string,
): Promise<GPCandidateSummary[]> {
  const { data, error } = await (supabase as any)
    .from('candidates')
    .select('id, full_name, gp_training_status, gp_open_to, gp_priority, gp_availability, assigned_agency')
    .eq('gp_training_status', status)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching GP candidates by status:', error)
    return []
  }

  return (data ?? []) as GPCandidateSummary[]
}

export async function getGPCandidatesByOpenTo(
  openTo: string,
): Promise<GPCandidateSummary[]> {
  const { data, error } = await (supabase as any)
    .from('candidates')
    .select('id, full_name, gp_training_status, gp_open_to, gp_priority, gp_availability, assigned_agency')
    .eq('gp_open_to', openTo)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching GP candidates by open to:', error)
    return []
  }

  return (data ?? []) as GPCandidateSummary[]
}

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

const PLACEMENT_PREFERENCES = [
  'Kommuner',
  'Vikar',
  'Vikar_Kommuner',
  'No_feedback',
  'Training_Vikar',
  'Training_Kommuner_Fast',
] as const

const PLACEMENT_STATUSES = [
  'Not ready to present',
  'Working on it',
  'Interview in process',
  'Out/on boarding job',
  'Hired by Kommuner Fast',
  'Hired by Kommuner temporary',
  'Hired by agency',
  'Resign',
  'Registration ready',
  'Presented to an Agency',
] as const

export async function getPlacementPreferenceCounts(
  promotionId?: string
): Promise<PlacementPreferenceCount[]> {
  let query = (supabase
    .from('candidates') as any)
    .select('placement_preference')
    .not('placement_preference', 'is', null)

  if (promotionId) {
    query = query.eq('promotion_id', promotionId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching placement preferences:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const total = data.length
  const countMap = new Map<string, number>()

  for (const pref of PLACEMENT_PREFERENCES) {
    countMap.set(pref, 0)
  }

  for (const row of data) {
    const pref = row.placement_preference as string
    countMap.set(pref, (countMap.get(pref) ?? 0) + 1)
  }

  return Array.from(countMap.entries())
    .filter(([, count]) => count > 0)
    .map(([preference, count]) => ({
      preference,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getPlacementStatusCounts(
  promotionId?: string
): Promise<PlacementStatusCount[]> {
  let query = supabase
    .from('candidates')
    .select('placement_status')
    .not('placement_status', 'is', null)

  if (promotionId) {
    query = query.eq('promotion_id', promotionId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching placement statuses:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const total = data.length
  const countMap = new Map<string, number>()

  for (const status of PLACEMENT_STATUSES) {
    countMap.set(status, 0)
  }

  for (const row of data) {
    const status = row.placement_status as string
    countMap.set(status, (countMap.get(status) ?? 0) + 1)
  }

  return Array.from(countMap.entries())
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function getPlacementClients(
  promotionId?: string
): Promise<PlacementClient[]> {
  let query = supabase
    .from('candidates')
    .select('placement_client')
    .not('placement_client', 'is', null)

  if (promotionId) {
    query = query.eq('promotion_id', promotionId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching placement clients:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const countMap = new Map<string, number>()

  for (const row of data) {
    const client = row.placement_client as string
    if (client) {
      countMap.set(client, (countMap.get(client) ?? 0) + 1)
    }
  }

  return Array.from(countMap.entries())
    .map(([client, candidateCount]) => ({ client, candidateCount }))
    .sort((a, b) => b.candidateCount - a.candidateCount)
}
