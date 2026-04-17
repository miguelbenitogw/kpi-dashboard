import { supabase } from '@/lib/supabase/client'

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
