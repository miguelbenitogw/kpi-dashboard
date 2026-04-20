import { supabase } from '@/lib/supabase/client';
import type { SlaAlert, DashboardConfig } from '@/lib/supabase/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SlaThresholds {
  [status: string]: { yellow: number; red: number };
}

export interface HeatmapCell {
  vacancy_id: string;
  vacancy_title: string;
  status: string;
  avg_days: number;
  candidate_count: number;
}

export interface TimeHistoryPoint {
  week_label: string;
  week_start: string;
  status: string;
  avg_days: number;
}

export interface AlertFilter {
  alert_level?: 'red' | 'yellow' | null;
  owner?: string | null;
  vacancy_id?: string | null;
}

// ── getSlaAlerts ─────────────────────────────────────────────────────────────

export async function getSlaAlerts(filter?: AlertFilter) {
  let query = supabase
    .from('sla_alerts_kpi')
    .select('*')
    .is('resolved_at', null)
    .order('days_stuck', { ascending: false });

  if (filter?.alert_level) {
    query = query.eq('alert_level', filter.alert_level);
  }
  if (filter?.owner) {
    query = query.eq('owner', filter.owner);
  }
  if (filter?.vacancy_id) {
    query = query.eq('job_opening_id', filter.vacancy_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SlaAlert[];
}

// ── getSlaThresholds ─────────────────────────────────────────────────────────

export async function getSlaThresholds(): Promise<SlaThresholds> {
  const { data, error } = await supabase
    .from('dashboard_config_kpi')
    .select('config_value')
    .eq('config_key', 'sla_thresholds')
    .single();

  if (error) throw error;
  return (data?.config_value ?? {}) as SlaThresholds;
}

export async function updateSlaThresholds(thresholds: SlaThresholds) {
  const { error } = await supabase
    .from('dashboard_config_kpi')
    .update({ config_value: thresholds as unknown as DashboardConfig['config_value'] })
    .eq('config_key', 'sla_thresholds');

  if (error) throw error;
}

// ── getHeatmapData ───────────────────────────────────────────────────────────

export async function getHeatmapData(): Promise<HeatmapCell[]> {
  // Get all active (unresolved) alerts grouped by vacancy + status
  const { data: alerts, error } = await supabase
    .from('sla_alerts_kpi')
    .select('job_opening_id, job_opening_title, current_status, days_stuck')
    .is('resolved_at', null);

  if (error) throw error;
  if (!alerts || alerts.length === 0) return [];

  // Aggregate: avg days per vacancy per status
  const map = new Map<string, {
    vacancy_id: string;
    vacancy_title: string;
    status: string;
    total_days: number;
    count: number;
  }>();

  for (const a of alerts) {
    const key = `${a.job_opening_id}::${a.current_status}`;
    const existing = map.get(key);
    if (existing) {
      existing.total_days += a.days_stuck ?? 0;
      existing.count += 1;
    } else {
      map.set(key, {
        vacancy_id: a.job_opening_id ?? '',
        vacancy_title: a.job_opening_title ?? 'Unknown',
        status: a.current_status ?? 'Unknown',
        total_days: a.days_stuck ?? 0,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).map((v) => ({
    vacancy_id: v.vacancy_id,
    vacancy_title: v.vacancy_title,
    status: v.status,
    avg_days: v.count > 0 ? Math.round((v.total_days / v.count) * 10) / 10 : 0,
    candidate_count: v.count,
  }));
}

// ── getTimeHistory ───────────────────────────────────────────────────────────

export async function getTimeHistory(weeks = 4): Promise<TimeHistoryPoint[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - weeks * 7);

  const { data, error } = await supabase
    .from('stage_history_kpi')
    .select('to_status, changed_at, days_in_stage')
    .gte('changed_at', sinceDate.toISOString())
    .not('days_in_stage', 'is', null);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Group by week + status
  const map = new Map<string, { total: number; count: number; week_start: string; status: string }>();

  for (const row of data) {
    if (!row.changed_at || row.days_in_stage == null) continue;
    const d = new Date(row.changed_at);
    // Get Monday of that week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const weekKey = monday.toISOString().slice(0, 10);
    const status = row.to_status ?? 'Unknown';
    const key = `${weekKey}::${status}`;

    const existing = map.get(key);
    if (existing) {
      existing.total += row.days_in_stage;
      existing.count += 1;
    } else {
      map.set(key, {
        total: row.days_in_stage,
        count: 1,
        week_start: weekKey,
        status,
      });
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      week_label: `Sem ${v.week_start.slice(5)}`,
      week_start: v.week_start,
      status: v.status,
      avg_days: Math.round((v.total / v.count) * 10) / 10,
    }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}
