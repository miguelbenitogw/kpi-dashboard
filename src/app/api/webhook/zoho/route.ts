import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { transformZohoCandidate, extractStatusChange } from '@/lib/zoho/transform'

export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook secret
    const token = request.nextUrl.searchParams.get('token')
    if (!token || token !== process.env.ZOHO_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse payload
    const body = await request.json()
    const { module: zohoModule, event, data, previous_data } = body

    if (!data?.id) {
      return NextResponse.json({ error: 'Missing candidate id' }, { status: 400 })
    }

    // 3. Log webhook event
    const eventId = `${zohoModule}_${event}_${data.id}_${Date.now()}`
    await supabaseAdmin.from('webhook_events').insert({
      event_id: eventId,
      event_type: `${zohoModule}.${event}`,
      payload: body,
      processed_at: new Date().toISOString(),
    })

    // 4. Transform and update candidate
    const candidateData = transformZohoCandidate(data)
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .upsert(
        {
          ...candidateData,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

    if (updateError) {
      console.error('Failed to update candidate:', updateError)
      return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 })
    }

    // 5. Handle status change
    const statusChange = extractStatusChange(data, previous_data)
    if (statusChange.from_status !== statusChange.to_status && statusChange.to_status) {
      // Calculate days_in_stage from previous stage_history entry
      let daysInStage: number | null = null

      const { data: lastEntry } = await supabaseAdmin
        .from('stage_history')
        .select('changed_at')
        .eq('candidate_id', data.id)
        .order('changed_at', { ascending: false })
        .limit(1)
        .single()

      if (lastEntry?.changed_at && statusChange.changed_at) {
        const prev = new Date(lastEntry.changed_at).getTime()
        const curr = new Date(statusChange.changed_at).getTime()
        daysInStage = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
      }

      // Insert stage_history record
      await supabaseAdmin.from('stage_history').insert({
        candidate_id: data.id,
        job_opening_id: data.Job_Opening?.id || null,
        from_status: statusChange.from_status,
        to_status: statusChange.to_status,
        changed_at: statusChange.changed_at,
        days_in_stage: daysInStage,
      })

      // 6. Check SLA thresholds
      await checkSlaThresholds(data, candidateData)
    }

    return NextResponse.json({ success: true, candidate_id: data.id })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function checkSlaThresholds(
  zohoData: Record<string, any>,
  candidateData: ReturnType<typeof transformZohoCandidate>,
) {
  // Fetch SLA config
  const { data: config } = await supabaseAdmin
    .from('dashboard_config')
    .select('config_value')
    .eq('config_key', 'sla_thresholds')
    .single()

  if (!config?.config_value) return

  const thresholds = config.config_value as Record<string, any>
  const status = candidateData.current_status
  if (!status) return

  // Get the threshold for the current status
  const threshold = thresholds[status]
  if (!threshold) return

  // Get the last stage_history entry to calculate how long the candidate has been in this stage
  const { data: lastEntry } = await supabaseAdmin
    .from('stage_history')
    .select('changed_at')
    .eq('candidate_id', zohoData.id)
    .order('changed_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastEntry?.changed_at) return

  const daysInCurrentStage = Math.round(
    (Date.now() - new Date(lastEntry.changed_at).getTime()) / (1000 * 60 * 60 * 24),
  )

  // Determine alert level
  let alertLevel: string | null = null
  if (typeof threshold === 'object' && threshold !== null) {
    if (threshold.critical && daysInCurrentStage >= threshold.critical) {
      alertLevel = 'critical'
    } else if (threshold.warning && daysInCurrentStage >= threshold.warning) {
      alertLevel = 'warning'
    }
  } else if (typeof threshold === 'number' && daysInCurrentStage >= threshold) {
    alertLevel = 'warning'
  }

  if (!alertLevel) return

  // Upsert SLA alert — resolve existing or create new
  const { data: existingAlert } = await supabaseAdmin
    .from('sla_alerts')
    .select('id')
    .eq('candidate_id', zohoData.id)
    .is('resolved_at', null)
    .limit(1)
    .single()

  if (existingAlert) {
    await supabaseAdmin
      .from('sla_alerts')
      .update({
        current_status: status,
        days_stuck: daysInCurrentStage,
        alert_level: alertLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingAlert.id)
  } else {
    await supabaseAdmin.from('sla_alerts').insert({
      candidate_id: zohoData.id,
      candidate_name: candidateData.full_name,
      job_opening_id: candidateData.job_opening_id,
      job_opening_title: candidateData.job_opening_title,
      current_status: status,
      days_stuck: daysInCurrentStage,
      alert_level: alertLevel,
      owner: candidateData.owner,
    })
  }
}
