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

export interface StageAvgTime {
  stage: string
  avgDays: number
}

export async function getStageAvgTimes(
  jobOpeningId: string
): Promise<{ vacancy: StageAvgTime[]; global: StageAvgTime[] }> {
  // Vacancy-specific avg times
  const { data: vacancyData, error: vacError } = await supabase
    .from('stage_history')
    .select('to_status, days_in_stage')
    .eq('job_opening_id', jobOpeningId)
    .not('days_in_stage', 'is', null)

  if (vacError) throw vacError

  // Global avg times
  const { data: globalData, error: globError } = await supabase
    .from('stage_history')
    .select('to_status, days_in_stage')
    .not('days_in_stage', 'is', null)

  if (globError) throw globError

  const calcAvg = (
    rows: { to_status: string | null; days_in_stage: number | null }[]
  ): StageAvgTime[] => {
    const map = new Map<string, { sum: number; count: number }>()
    for (const r of rows) {
      const stage = r.to_status ?? 'Unknown'
      const entry = map.get(stage) ?? { sum: 0, count: 0 }
      entry.sum += r.days_in_stage ?? 0
      entry.count += 1
      map.set(stage, entry)
    }
    return Array.from(map.entries())
      .map(([stage, { sum, count }]) => ({
        stage,
        avgDays: Math.round((sum / count) * 10) / 10,
      }))
      .sort((a, b) => a.stage.localeCompare(b.stage))
  }

  return {
    vacancy: calcAvg(vacancyData ?? []),
    global: calcAvg(globalData ?? []),
  }
}
