import { supabase } from '@/lib/supabase/client'

export interface RRSSSnapshot {
  account_id: string
  platform: string
  handle: string | null
  followers_count: number | null
  subscribers_count: number | null
  metric_name: string
  captured_at: string
}

/**
 * Returns the most recent snapshot per account_id.
 * Uses a DISTINCT ON equivalent by ordering and deduping in JS —
 * Supabase JS client doesn't expose DISTINCT ON directly.
 */
export async function getLatestRRSSSnapshots(): Promise<Map<string, RRSSSnapshot>> {
  const { data, error } = await supabase
    .from('social_media_snapshots_kpi')
    .select('account_id, platform, handle, followers_count, subscribers_count, metric_name, captured_at')
    .order('captured_at', { ascending: false })
    .limit(200) // generous upper bound; dedupe below

  if (error || !data) return new Map()

  const map = new Map<string, RRSSSnapshot>()
  for (const row of data) {
    if (row.account_id && !map.has(row.account_id)) {
      map.set(row.account_id, row as RRSSSnapshot)
    }
  }
  return map
}
