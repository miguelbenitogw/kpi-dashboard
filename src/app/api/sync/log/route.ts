import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '../middleware'

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { sync_type, status, records_processed, api_calls_used, error_message } = body

    if (!sync_type || !status) {
      return NextResponse.json(
        { error: 'Invalid payload: sync_type and status are required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // If status is "started", create a new log entry
    if (status === 'started') {
      const { data, error } = await supabaseAdmin
        .from('sync_log')
        .insert({
          sync_type,
          status,
          started_at: now,
          records_processed: records_processed ?? 0,
          api_calls_used: api_calls_used ?? 0,
          error_message: error_message ?? null,
        })
        .select('id')
        .single()

      if (error) {
        return NextResponse.json(
          { error: `Supabase error: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        sync_log_id: data.id,
        message: `Sync log created with status: ${status}`,
      })
    }

    // If status is "completed" or "failed", update the most recent matching log
    const { data: existingLog } = await supabaseAdmin
      .from('sync_log')
      .select('id')
      .eq('sync_type', sync_type)
      .eq('status', 'started')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (existingLog) {
      const { error } = await supabaseAdmin
        .from('sync_log')
        .update({
          status,
          finished_at: now,
          records_processed: records_processed ?? 0,
          api_calls_used: api_calls_used ?? 0,
          error_message: error_message ?? null,
        })
        .eq('id', existingLog.id)

      if (error) {
        return NextResponse.json(
          { error: `Supabase error: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        sync_log_id: existingLog.id,
        message: `Sync log updated with status: ${status}`,
      })
    }

    // No matching "started" log found, create a new completed/failed entry
    const { data, error } = await supabaseAdmin
      .from('sync_log')
      .insert({
        sync_type,
        status,
        started_at: now,
        finished_at: now,
        records_processed: records_processed ?? 0,
        api_calls_used: api_calls_used ?? 0,
        error_message: error_message ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sync_log_id: data.id,
      message: `Sync log created with status: ${status}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
