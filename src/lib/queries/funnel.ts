import { supabase } from '@/lib/supabase/client';

// Funnel stages in order, mapping display names to the raw status values
export const FUNNEL_STAGES = [
  { key: 'associated', label: 'Associated', statuses: ['Associated'] },
  {
    key: 'first_contact',
    label: 'First Contact',
    statuses: ['First Call', 'Second Call'],
  },
  {
    key: 'interview',
    label: 'Interview',
    statuses: [
      'Interview to be Scheduled',
      'Interview-Scheduled',
      'Interview in Progress',
    ],
  },
  {
    key: 'evaluation',
    label: 'Evaluation',
    statuses: ['Waiting for Evaluation', 'Waiting for Consensus'],
  },
  {
    key: 'approved',
    label: 'Approved',
    statuses: ['Approved by client'],
  },
  { key: 'hired', label: 'Hired', statuses: ['Hired'] },
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]['key'];

export interface FunnelStageData {
  key: FunnelStageKey;
  label: string;
  count: number;
  percentage: number; // relative to first stage
  conversionFromPrevious: number | null; // null for first stage
}

export interface ConversionRow {
  from: string;
  to: string;
  candidatesIn: number;
  candidatesOut: number;
  conversionRate: number;
  avgDays: number | null;
}

export interface SourceStat {
  source: string;
  total: number;
  hired: number;
  conversionRate: number;
}

export interface RecruiterStat {
  owner: string;
  totalCandidates: number;
  reachedInterview: number;
  interviewRate: number;
  hired: number;
  hiredRate: number;
  avgDaysToHire: number | null;
}

/** All statuses that belong to a funnel stage or later */
function statusesAtOrAfter(stageIndex: number): string[] {
  return FUNNEL_STAGES.slice(stageIndex).flatMap((s) => [...s.statuses]);
}

/**
 * Get funnel data: count of candidates that reached each stage.
 * A candidate "reached" a stage if their stage_history has a to_status matching
 * any of that stage's statuses, OR if their current_status matches.
 */
export async function getFunnelData(
  jobOpeningId?: string
): Promise<FunnelStageData[]> {
  // Get all candidate IDs and their current status
  let candidatesQuery = supabase
    .from('candidates_kpi')
    .select('id, current_status');
  if (jobOpeningId) {
    candidatesQuery = candidatesQuery.eq('job_opening_id', jobOpeningId);
  }
  const { data: candidates, error: candError } = await candidatesQuery;
  if (candError) throw candError;
  if (!candidates || candidates.length === 0) {
    return FUNNEL_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      count: 0,
      percentage: 0,
      conversionFromPrevious: null,
    }));
  }

  const candidateIds = candidates.map((c) => c.id);

  // Get stage history for these candidates
  let historyQuery = supabase
    .from('stage_history_kpi')
    .select('candidate_id, to_status');
  if (jobOpeningId) {
    historyQuery = historyQuery.eq('job_opening_id', jobOpeningId);
  } else {
    historyQuery = historyQuery.in('candidate_id', candidateIds);
  }
  const { data: history, error: histError } = await historyQuery;
  if (histError) throw histError;

  // Build a set of statuses each candidate has reached
  const candidateStatuses = new Map<string, Set<string>>();
  for (const c of candidates) {
    const set = new Set<string>();
    if (c.current_status) set.add(c.current_status);
    candidateStatuses.set(c.id, set);
  }
  for (const h of history ?? []) {
    if (!h.candidate_id || !h.to_status) continue;
    const set = candidateStatuses.get(h.candidate_id);
    if (set) set.add(h.to_status);
  }

  // Count candidates that reached each funnel stage
  const stageCounts: number[] = FUNNEL_STAGES.map((stage) => {
    let count = 0;
    for (const [, statuses] of candidateStatuses) {
      if (stage.statuses.some((s) => statuses.has(s))) {
        count++;
      }
    }
    return count;
  });

  const firstCount = stageCounts[0] || 1;

  return FUNNEL_STAGES.map((stage, i) => ({
    key: stage.key,
    label: stage.label,
    count: stageCounts[i],
    percentage: Math.round((stageCounts[i] / firstCount) * 100),
    conversionFromPrevious:
      i === 0
        ? null
        : stageCounts[i - 1] > 0
          ? Math.round((stageCounts[i] / stageCounts[i - 1]) * 100)
          : 0,
  }));
}

/**
 * Get conversion rates between consecutive stages with avg days.
 */
export async function getConversionRates(
  jobOpeningId?: string
): Promise<ConversionRow[]> {
  const funnelData = await getFunnelData(jobOpeningId);

  // Get avg days in stage from stage_history
  let daysQuery = supabase
    .from('stage_history_kpi')
    .select('from_status, days_in_stage');
  if (jobOpeningId) {
    daysQuery = daysQuery.eq('job_opening_id', jobOpeningId);
  }
  const { data: daysData } = await daysQuery;

  // Compute avg days per "from" status group
  const daysByStatus = new Map<string, number[]>();
  for (const d of daysData ?? []) {
    if (!d.from_status || d.days_in_stage == null) continue;
    const arr = daysByStatus.get(d.from_status) ?? [];
    arr.push(d.days_in_stage);
    daysByStatus.set(d.from_status, arr);
  }

  const rows: ConversionRow[] = [];
  for (let i = 0; i < funnelData.length - 1; i++) {
    const from = funnelData[i];
    const to = funnelData[i + 1];
    const stage = FUNNEL_STAGES[i];

    // Average days across all statuses in this stage
    let totalDays = 0;
    let dayCount = 0;
    for (const status of stage.statuses) {
      const arr = daysByStatus.get(status);
      if (arr) {
        totalDays += arr.reduce((s, v) => s + v, 0);
        dayCount += arr.length;
      }
    }

    rows.push({
      from: from.label,
      to: to.label,
      candidatesIn: from.count,
      candidatesOut: to.count,
      conversionRate:
        from.count > 0 ? Math.round((to.count / from.count) * 100) : 0,
      avgDays: dayCount > 0 ? Math.round(totalDays / dayCount) : null,
    });
  }

  return rows;
}

/**
 * Source effectiveness: candidates and hires by source.
 */
export async function getSourceStats(): Promise<SourceStat[]> {
  const { data: candidates, error } = await supabase
    .from('candidates_kpi')
    .select('source, current_status');
  if (error) throw error;

  const bySource = new Map<string, { total: number; hired: number }>();
  for (const c of candidates ?? []) {
    const src = c.source || 'Unknown';
    const entry = bySource.get(src) ?? { total: 0, hired: 0 };
    entry.total++;
    if (c.current_status === 'Hired') entry.hired++;
    bySource.set(src, entry);
  }

  return Array.from(bySource.entries())
    .map(([source, { total, hired }]) => ({
      source,
      total,
      hired,
      conversionRate: total > 0 ? Math.round((hired / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Recruiter stats: conversion metrics grouped by owner.
 */
export async function getRecruiterStats(): Promise<RecruiterStat[]> {
  const { data: candidates, error: candError } = await supabase
    .from('candidates_kpi')
    .select('id, owner, current_status, created_time');
  if (candError) throw candError;

  const { data: history, error: histError } = await supabase
    .from('stage_history_kpi')
    .select('candidate_id, to_status, changed_at');
  if (histError) throw histError;

  // Build candidate -> set of reached statuses
  const candidateStatuses = new Map<string, Set<string>>();
  const candidateCreated = new Map<string, string | null>();
  const candidateHiredAt = new Map<string, string | null>();

  for (const c of candidates ?? []) {
    const set = new Set<string>();
    if (c.current_status) set.add(c.current_status);
    candidateStatuses.set(c.id, set);
    candidateCreated.set(c.id, c.created_time);
  }

  for (const h of history ?? []) {
    if (!h.candidate_id || !h.to_status) continue;
    const set = candidateStatuses.get(h.candidate_id);
    if (set) set.add(h.to_status);
    if (h.to_status === 'Hired' && h.changed_at) {
      candidateHiredAt.set(h.candidate_id, h.changed_at);
    }
  }

  const interviewStatuses = new Set(
    FUNNEL_STAGES.find((s) => s.key === 'interview')?.statuses ?? []
  );

  const byOwner = new Map<
    string,
    {
      total: number;
      interview: number;
      hired: number;
      hireDays: number[];
    }
  >();

  for (const c of candidates ?? []) {
    const owner = c.owner || 'Unassigned';
    const entry = byOwner.get(owner) ?? {
      total: 0,
      interview: 0,
      hired: 0,
      hireDays: [],
    };
    entry.total++;

    const statuses = candidateStatuses.get(c.id);
    if (statuses) {
      if ([...interviewStatuses].some((s) => statuses.has(s))) {
        entry.interview++;
      }
      if (statuses.has('Hired')) {
        entry.hired++;
        const created = candidateCreated.get(c.id);
        const hiredAt = candidateHiredAt.get(c.id);
        if (created && hiredAt) {
          const days = Math.round(
            (new Date(hiredAt).getTime() - new Date(created).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (days >= 0) entry.hireDays.push(days);
        }
      }
    }

    byOwner.set(owner, entry);
  }

  return Array.from(byOwner.entries())
    .map(([owner, data]) => ({
      owner,
      totalCandidates: data.total,
      reachedInterview: data.interview,
      interviewRate:
        data.total > 0
          ? Math.round((data.interview / data.total) * 100)
          : 0,
      hired: data.hired,
      hiredRate:
        data.total > 0 ? Math.round((data.hired / data.total) * 100) : 0,
      avgDaysToHire:
        data.hireDays.length > 0
          ? Math.round(
              data.hireDays.reduce((s, v) => s + v, 0) / data.hireDays.length
            )
          : null,
    }))
    .sort((a, b) => b.totalCandidates - a.totalCandidates);
}

/**
 * Compare funnel data across multiple job openings.
 */
export async function getFunnelComparison(
  jobOpeningIds: string[]
): Promise<{ jobOpeningId: string; title: string; stages: FunnelStageData[] }[]> {
  // Get titles
  const { data: jobs } = await supabase
    .from('job_openings_kpi')
    .select('id, title')
    .in('id', jobOpeningIds);

  const titleMap = new Map(
    (jobs ?? []).map((j) => [j.id, j.title])
  );

  const results = await Promise.all(
    jobOpeningIds.map(async (id) => ({
      jobOpeningId: id,
      title: titleMap.get(id) ?? id,
      stages: await getFunnelData(id),
    }))
  );

  return results;
}

/**
 * Get all active job openings for the vacancy selector.
 */
export async function getJobOpenings() {
  const { data, error } = await supabase
    .from('job_openings_kpi')
    .select('id, title, client_name, status, total_candidates')
    .order('title');
  if (error) throw error;
  return data ?? [];
}
