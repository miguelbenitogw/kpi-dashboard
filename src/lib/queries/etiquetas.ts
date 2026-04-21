import { supabase } from '@/lib/supabase/client'

export interface TagCount {
  tag: string
  count: number
}

export interface StatusCount {
  status: string
  count: number
  percentage: number
}

/**
 * Get all unique tags with their candidate count.
 * unnest is not available via the query builder, so we fetch all tags and
 * aggregate in JS — this is the recommended fallback per the task spec.
 */
export async function getAllTags(): Promise<TagCount[]> {
  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('tags')
    .not('tags', 'is', null)

  if (error) {
    console.error('[etiquetas] getAllTags error:', error)
    return []
  }

  const tagMap = new Map<string, number>()
  for (const row of data ?? []) {
    for (const tag of (row.tags ?? [])) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    }
  }

  return [...tagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get candidate counts by current_status for a set of tags.
 * If tags is empty/undefined, returns counts for ALL candidates.
 * Uses overlaps operator (&&) — candidate must have AT LEAST ONE of the given tags.
 */
export async function getStatusCountsByTags(tags?: string[]): Promise<StatusCount[]> {
  let query = supabase
    .from('candidates_kpi')
    .select('current_status')

  if (tags && tags.length > 0) {
    query = query.filter('tags', 'ov', `{${tags.join(',')}}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[etiquetas] getStatusCountsByTags error:', error)
    return []
  }

  const statusMap = new Map<string, number>()
  for (const row of data ?? []) {
    const s = row.current_status ?? 'Sin estado'
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
  }

  const total = [...statusMap.values()].reduce((acc, n) => acc + n, 0)

  return [...statusMap.entries()]
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get candidate counts by candidate_stage for a set of tags.
 * If tags is empty/undefined, returns counts for ALL candidates.
 */
export async function getStageCounts(tags?: string[]): Promise<StatusCount[]> {
  let query = supabase
    .from('candidates_kpi')
    .select('candidate_stage')

  if (tags && tags.length > 0) {
    query = query.filter('tags', 'ov', `{${tags.join(',')}}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[etiquetas] getStageCounts error:', error)
    return []
  }

  const stageMap = new Map<string, number>()
  for (const row of data ?? []) {
    const s = row.candidate_stage ?? 'Sin etapa'
    stageMap.set(s, (stageMap.get(s) ?? 0) + 1)
  }

  const total = [...stageMap.values()].reduce((acc, n) => acc + n, 0)

  return [...stageMap.entries()]
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}
