import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { fetchAllYouTubeStats } from '@/lib/social-media/youtube'
import { fetchAllInstagramStats } from '@/lib/social-media/instagram'
import type { Json } from '@/lib/supabase/types'

export const maxDuration = 300

/**
 * GET /api/cron/sync-social
 *
 * Daily cron — syncs YouTube and Instagram stats into social_media_snapshots_kpi.
 * Scheduled: 0 3 * * * (every day at 03:00 UTC)
 *
 * Requires YOUTUBE_API_KEY for YouTube. Requires META_ACCESS_TOKEN for Instagram.
 * Safe to run without either — will log a skip.
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
    skipped += 3
    errors.push('YOUTUBE_API_KEY not configured — skipped YouTube sync')
  } else {
    try {
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
            raw_data: { channelId: stats.channelId, topVideos: stats.topVideos } as unknown as Json,
            captured_at: capturedAt,
          })

        if (error) {
          errors.push(`YouTube ${stats.handle}: ${error.message}`)
        } else {
          synced++
        }
      }
    } catch (err) {
      errors.push(`YouTube fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Instagram ─────────────────────────────────────────────────────────────

  if (!process.env.META_ACCESS_TOKEN) {
    skipped += 3
    errors.push('META_ACCESS_TOKEN not configured — skipped Instagram sync')
  } else {
    try {
      const igStats = await fetchAllInstagramStats()

      if (igStats.length === 0) {
        errors.push('Instagram: no accounts returned — token may be expired or missing permissions')
        console.error('[cron/sync-social] Instagram fetch returned 0 accounts. Check META_ACCESS_TOKEN validity.')
      }

      for (const stats of igStats) {
        const { error } = await supabaseAdmin
          .from('social_media_snapshots_kpi')
          .insert({
            account_id: stats.accountId,
            platform: 'instagram',
            handle: stats.handle,
            metric_name: 'snapshot',
            followers_count: stats.followersCount,
            following_count: stats.followsCount,
            posts_count: stats.mediaCount,
            raw_data: {
              igBusinessId: stats.igBusinessId,
              username: stats.username,
              name: stats.name,
              profilePictureUrl: stats.profilePictureUrl,
              topMedia: stats.topMedia,
            } as unknown as Json,
            captured_at: capturedAt,
          })

        if (error) {
          errors.push(`Instagram ${stats.handle}: ${error.message}`)
        } else {
          synced++
        }
      }
    } catch (err) {
      errors.push(`Instagram fetch failed: ${err instanceof Error ? err.message : String(err)}`)
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
