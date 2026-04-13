import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { differenceInDays } from 'date-fns';

interface SlaThreshold {
  yellow: number;
  red: number;
}

type SlaThresholds = Record<string, SlaThreshold>;

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const terminalStatuses = [
      'Hired',
      'Rejected',
      'Offer Declined',
      'Offer Withdrawn',
      'Expelled',
      'Transferred',
      'In Training out of GW',
    ];

    // Fetch SLA thresholds from config
    const { data: configRow, error: configError } = await supabaseAdmin
      .from('dashboard_config')
      .select('config_value')
      .eq('config_key', 'sla_thresholds')
      .single();

    if (configError) throw configError;

    const thresholds = configRow.config_value as unknown as SlaThresholds;
    if (!thresholds) {
      return NextResponse.json(
        { error: 'SLA thresholds not configured' },
        { status: 500 }
      );
    }

    // Get all active candidates
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from('candidates')
      .select('id, full_name, job_opening_id, job_opening_title, current_status, last_activity_time, modified_time, owner')
      .not('current_status', 'in', `(${terminalStatuses.join(',')})`);

    if (fetchError) throw fetchError;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ alerts_created: 0, alerts_updated: 0, alerts_resolved: 0 });
    }

    // Get all unresolved alerts
    const { data: existingAlerts, error: alertsError } = await supabaseAdmin
      .from('sla_alerts')
      .select('id, candidate_id, alert_level')
      .is('resolved_at', null);

    if (alertsError) throw alertsError;

    const alertsByCandidate = new Map<string, { id: number; alert_level: string | null }>();
    for (const alert of existingAlerts ?? []) {
      if (alert.candidate_id) {
        alertsByCandidate.set(alert.candidate_id, { id: alert.id, alert_level: alert.alert_level });
      }
    }

    let alertsCreated = 0;
    let alertsUpdated = 0;
    let alertsResolved = 0;

    const activeCandidateIds = new Set<string>();

    for (const candidate of candidates) {
      activeCandidateIds.add(candidate.id);

      const activityDate = candidate.last_activity_time
        ? new Date(candidate.last_activity_time)
        : candidate.modified_time
          ? new Date(candidate.modified_time)
          : now;

      const daysStuck = differenceInDays(now, activityDate);
      const status = candidate.current_status ?? '';
      const threshold = thresholds[status];

      if (!threshold) {
        // No threshold defined for this status, ensure no stale alert
        const existing = alertsByCandidate.get(candidate.id);
        if (existing) {
          await supabaseAdmin
            .from('sla_alerts')
            .update({ resolved_at: now.toISOString() })
            .eq('id', existing.id);
          alertsResolved++;
        }
        // Update candidate sla_status to green
        await supabaseAdmin
          .from('candidates')
          .update({ sla_status: 'green' })
          .eq('id', candidate.id);
        continue;
      }

      let alertLevel: string | null = null;
      let slaStatus = 'green';

      if (daysStuck > threshold.red) {
        alertLevel = 'red';
        slaStatus = 'red';
      } else if (daysStuck > threshold.yellow) {
        alertLevel = 'yellow';
        slaStatus = 'yellow';
      }

      const existingAlert = alertsByCandidate.get(candidate.id);

      if (alertLevel) {
        if (existingAlert) {
          // Update existing alert if level changed
          if (existingAlert.alert_level !== alertLevel) {
            const { error } = await supabaseAdmin
              .from('sla_alerts')
              .update({
                alert_level: alertLevel,
                days_stuck: daysStuck,
                current_status: candidate.current_status,
                updated_at: now.toISOString(),
              })
              .eq('id', existingAlert.id);
            if (error) throw error;
            alertsUpdated++;
          } else {
            // Same level, just update days_stuck
            const { error } = await supabaseAdmin
              .from('sla_alerts')
              .update({
                days_stuck: daysStuck,
                updated_at: now.toISOString(),
              })
              .eq('id', existingAlert.id);
            if (error) throw error;
            alertsUpdated++;
          }
        } else {
          // Create new alert
          const { error } = await supabaseAdmin.from('sla_alerts').insert({
            candidate_id: candidate.id,
            candidate_name: candidate.full_name,
            job_opening_id: candidate.job_opening_id,
            job_opening_title: candidate.job_opening_title,
            current_status: candidate.current_status,
            days_stuck: daysStuck,
            alert_level: alertLevel,
            owner: candidate.owner,
          });
          if (error) throw error;
          alertsCreated++;
        }
      } else {
        // No alert needed - resolve if one exists
        if (existingAlert) {
          const { error } = await supabaseAdmin
            .from('sla_alerts')
            .update({ resolved_at: now.toISOString() })
            .eq('id', existingAlert.id);
          if (error) throw error;
          alertsResolved++;
        }
      }

      // Update candidate sla_status
      await supabaseAdmin
        .from('candidates')
        .update({ sla_status: slaStatus })
        .eq('id', candidate.id);
    }

    // Resolve alerts for candidates that are no longer active (moved to terminal status)
    for (const [candidateId, alert] of alertsByCandidate) {
      if (!activeCandidateIds.has(candidateId)) {
        const { error } = await supabaseAdmin
          .from('sla_alerts')
          .update({ resolved_at: now.toISOString() })
          .eq('id', alert.id);
        if (error) throw error;
        alertsResolved++;
      }
    }

    return NextResponse.json({
      alerts_created: alertsCreated,
      alerts_updated: alertsUpdated,
      alerts_resolved: alertsResolved,
    });
  } catch (error) {
    console.error('[process/sla] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
