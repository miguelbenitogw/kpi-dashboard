import { supabase } from '@/lib/supabase/client'
import type { JobOpening, Candidate } from '@/lib/supabase/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface PromoStatusCount {
  status: string
  count: number
}

export async function getActivePromos(): Promise<JobOpening[]> {
  const { data, error } = await supabase
    .from('job_openings')
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
    .from('candidates')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('modified_time', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getPromoStatusBreakdown(
  jobOpeningId: string
): Promise<PromoStatusCount[]> {
  const { data, error } = await supabase
    .from('candidates')
    .select('current_status')
    .eq('job_opening_id', jobOpeningId)

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const status = row.current_status ?? 'Unknown'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
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
        table: 'candidates',
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
        table: 'candidates',
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
