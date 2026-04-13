import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '../middleware'
import type { StageHistoryInsert } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    if (!validateApiKey(request)) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { activities } = body

    if (!Array.isArray(activities) || activities.length === 0) {
      return NextResponse.json(
        { error: 'Invalid payload: activities array is required' },
        { status: 400 }
      )
    }

    let insertedCount = 0

    for (const activity of activities) {
      const changedAt = activity.changed_at
        ? new Date(activity.changed_at)
        : new Date()

      // Find the previous stage change for this candidate to calculate days_in_stage
      let daysInStage: number | null = null
      const { data: previousChange } = await supabaseAdmin
        .from('stage_history')
        .select('changed_at')
        .eq('candidate_id', activity.candidate_id)
        .order('changed_at', { ascending: false })
        .limit(1)
        .single()

      if (previousChange?.changed_at) {
        const previousDate = new Date(previousChange.changed_at)
        daysInStage = Math.floor(
          (changedAt.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      }

      const record: StageHistoryInsert = {
        candidate_id: activity.candidate_id ?? null,
        job_opening_id: activity.job_opening_id ?? null,
        from_status: activity.from_status ?? null,
        to_status: activity.to_status ?? null,
        changed_at: changedAt.toISOString(),
        days_in_stage: daysInStage,
        changed_by: activity.changed_by ?? null,
      }

      const { error: insertError } = await supabaseAdmin
        .from('stage_history')
        .insert(record)

      if (insertError) {
        console.error(`Failed to insert activity for candidate ${activity.candidate_id}:`, insertError.message)
        continue
      }

      insertedCount++

      // Update candidate's current_status and last_activity_time
      if (activity.candidate_id) {
        await supabaseAdmin
          .from('candidates')
          .update({
            current_status: activity.to_status ?? null,
            last_activity_time: changedAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', activity.candidate_id)
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedCount,
      message: `Inserted ${insertedCount} stage history records`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
