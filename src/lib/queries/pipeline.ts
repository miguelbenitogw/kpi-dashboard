import { supabase } from '@/lib/supabase/client'
import type { JobOpening, Candidate } from '@/lib/supabase/types'

export async function getJobOpenings(): Promise<JobOpening[]> {
  const { data, error } = await supabase
    .from('job_openings')
    .select('*')
    .eq('is_active', true)
    .order('date_opened', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function getCandidatesByVacancy(jobOpeningId: string): Promise<
  (Candidate & { alert_level: string | null; days_stuck: number | null })[]
> {
  const { data: candidates, error: candError } = await supabase
    .from('candidates')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('modified_time', { ascending: false, nullsFirst: false })

  if (candError) throw candError

  const { data: alerts, error: alertError } = await supabase
    .from('sla_alerts')
    .select('candidate_id, alert_level, days_stuck')
    .eq('job_opening_id', jobOpeningId)
    .is('resolved_at', null)

  if (alertError) throw alertError

  const alertMap = new Map(
    (alerts ?? []).map((a) => [a.candidate_id, a])
  )

  return (candidates ?? []).map((c) => {
    const alert = alertMap.get(c.id)
    return {
      ...c,
      alert_level: alert?.alert_level ?? null,
      days_stuck: alert?.days_stuck ?? null,
    }
  })
}

export interface PipelineStatusCount {
  status: string
  count: number
}

export async function getPipelineStats(
  jobOpeningId: string
): Promise<PipelineStatusCount[]> {
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

  return Array.from(counts.entries()).map(([status, count]) => ({
    status,
    count,
  }))
}

