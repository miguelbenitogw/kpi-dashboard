import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllYouTubeStats } from '@/lib/social-media/youtube'

export const maxDuration = 60

/**
 * GET /api/cron/sync-social
 *
 * Daily cron — syncs YouTube channel stats into social_media_snapshots_kpi.
 * Scheduled: 0 4 * * * (every day at 04:00 UTC)
 *
 * Requires YOUTUBE_API_KEY env var. Safe to run without it — will log a skip.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const capturedAt = new Date().toISOString()
  const startTime = Date.now()
  const errors: string[] = []
  let synced = 0
  let skipped = 0

  // ── YouTube ──────────────────────────────────────────────────────────────

  if (!process.env.YOUTUBE_API_KEY) {
    skipped = 3
    errors.push('YOUTUBE_API_KEY not configured — skipped YouTube sync')
  } else {
    const youtubeStats = await fetchAllYouTubeStats()

    for (const stats of youtubeStats) {
      const accountId = `youtube_${stats.handle.toLowerCase()}`

      const { error } = await supabaseAdmin
        .from('social_media_snapshots_kpi')
        .insert({
          account_id: accountId,
          platform: 'youtube',
          handle: stats.handle,
          metric_name: 'snapshot',
          subscribers_count: stats.subscriberCount,
          posts_count: stats.videoCount,
          total_views: stats.viewCount,
          raw_data: { channelId: stats.channelId, topVideos: stats.topVideos },
          captured_at: capturedAt,
        })

      if (error) {
        errors.push(`YouTube ${stats.handle}: ${error.message}`)
      } else {
        synced++
      }
    }
  }

  const success = errors.length === 0

  return NextResponse.json(
    {
      success,
      duration_ms: Date.now() - startTime,
      captured_at: capturedAt,
      synced,
      skipped,
      errors,
    },
    { status: success ? 200 : 207 },
  )
}
