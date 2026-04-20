import { supabase } from '@/lib/supabase/client'
import type { JobOpening, Candidate, StageHistory } from '@/lib/supabase/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { TERMINAL_STATUSES } from '@/lib/constants'

export interface PromoStatusCount {
  status: string
  count: number
  percentage: number
}

export interface PromoBreakdownResult {
  breakdown: PromoStatusCount[]
  total: number
  activeCount: number
  terminalCount: number
}

export interface PromoSummaryItem {
  promo: JobOpening
  breakdown: PromoBreakdownResult
  lastActivity: Date | null
  lastSyncedAt: string | null
}

export interface CandidateWithHistory extends Candidate {
  stage_history?: StageHistory[]
}

export async function getActivePromos(): Promise<JobOpening[]> {
  const { data, error } = await supabase
    .from('job_openings_kpi')
    .select('*')
    .ilike('title', '%promo%')
    .eq('is_active', true)
    .order('title', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getPromoCandidates(
  jobOpeningId: string
): Promise<Candidate[]> {
  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('modified_time', { ascending: false })

  if (error) throw error
  return data ?? []
}

function buildBreakdown(rows: { current_status: string | null }[]): PromoBreakdownResult {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const status = row.current_status ?? 'Unknown'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  const total = rows.length
  let terminalCount = 0

  const breakdown = Array.from(counts.entries())
    .map(([status, count]) => {
      if (TERMINAL_STATUSES.includes(status)) {
        terminalCount += count
      }
      return {
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }
    })
    .sort((a, b) => b.count - a.count)

  return {
    breakdown,
    total,
    activeCount: total - terminalCount,
    terminalCount,
  }
}

export async function getPromoStatusBreakdown(
  jobOpeningId: string
): Promise<PromoStatusCount[]> {
  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('current_status')
    .eq('job_opening_id', jobOpeningId)

  if (error) throw error

  const result = buildBreakdown(data ?? [])
  return result.breakdown
}

export async function getPromoBreakdownFull(
  jobOpeningId: string
): Promise<PromoBreakdownResult> {
  const { data, error } = await supabase
    .from('candidates_kpi')
    .select('current_status')
    .eq('job_opening_id', jobOpeningId)

  if (error) throw error
  return buildBreakdown(data ?? [])
}

export async function getPromoTimeline(
  jobOpeningId: string
): Promise<CandidateWithHistory[]> {
  // Get candidates
  const { data: candidates, error: candError } = await supabase
    .from('candidates_kpi')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('modified_time', { ascending: false })

  if (candError) throw candError
  if (!candidates || candidates.length === 0) return []

  // Get stage history for this job opening
  const { data: history, error: histError } = await supabase
    .from('stage_history_kpi')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('changed_at', { ascending: false })

  if (histError) throw histError

  // Group history by candidate
  const historyMap = new Map<string, StageHistory[]>()
  for (const h of history ?? []) {
    if (!h.candidate_id) continue
    const list = historyMap.get(h.candidate_id) ?? []
    list.push(h)
    historyMap.set(h.candidate_id, list)
  }

  return candidates.map((c) => ({
    ...c,
    stage_history: historyMap.get(c.id) ?? [],
  }))
}

export async function getPromoSummary(): Promise<PromoSummaryItem[]> {
  // Get all active promos
  const promos = await getActivePromos()
  if (promos.length === 0) return []

  const promoIds = promos.map((p) => p.id)

  // Get all candidates for all promos in one query
  const { data: allCandidates, error } = await supabase
    .from('candidates_kpi')
    .select('job_opening_id, current_status, modified_time, last_synced_at')
    .in('job_opening_id', promoIds)

  if (error) throw error

  // Group candidates by job_opening_id
  const grouped = new Map<string, { current_status: string | null; modified_time: string | null; last_synced_at: string | null }[]>()
  for (const c of allCandidates ?? []) {
    const id = c.job_opening_id!
    const list = grouped.get(id) ?? []
    list.push(c)
    grouped.set(id, list)
  }

  return promos.map((promo) => {
    const candidates = grouped.get(promo.id) ?? []
    const breakdown = buildBreakdown(candidates)

    // Find last activity
    let lastActivity: Date | null = null
    let lastSyncedAt: string | null = null
    for (const c of candidates) {
      if (c.modified_time) {
        const d = new Date(c.modified_time)
        if (!lastActivity || d > lastActivity) lastActivity = d
      }
      if (c.last_synced_at) {
        if (!lastSyncedAt || c.last_synced_at > lastSyncedAt) {
          lastSyncedAt = c.last_synced_at
        }
      }
    }

    return { promo, breakdown, lastActivity, lastSyncedAt }
  })
}

export function subscribeToPromoChanges(
  jobOpeningId: string,
  callback: (payload: { eventType: string; new: Candidate | null; old: Partial<Candidate> | null }) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`promo-candidates-${jobOpeningId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'candidates_kpi',
        filter: `job_opening_id=eq.${jobOpeningId}`,
      },
      (payload) => {
        callback({
          eventType: payload.eventType,
          new: (payload.new as Candidate) ?? null,
          old: (payload.old as Partial<Candidate>) ?? null,
        })
      }
    )
    .subscribe()

  return channel
}

export function subscribeToAllPromoChanges(
  promoIds: string[],
  callback: (payload: { eventType: string; new: Candidate | null; old: Partial<Candidate> | null }) => void
): RealtimeChannel {
  const channel = supabase
    .channel('all-promo-candidates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'candidates_kpi',
      },
      (payload) => {
        const candidate = payload.new as Candidate | null
        if (candidate?.job_opening_id && promoIds.includes(candidate.job_opening_id)) {
          callback({
            eventType: payload.eventType,
            new: candidate,
            old: (payload.old as Partial<Candidate>) ?? null,
          })
        }
      }
    )
    .subscribe()

  return channel
}
