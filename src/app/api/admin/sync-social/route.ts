/**
 * POST /api/admin/sync-social
 *
 * Syncs social media stats into social_media_snapshots_kpi.
 *   - YouTube: fetched via YouTube Data API v3 (requires YOUTUBE_API_KEY)
 *   - Other platforms: inserts placeholder rows (metric_name = 'manual')
 *
 * Requires x-api-key header matching SYNC_API_KEY env var.
 */
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllYouTubeStats } from '@/lib/social-media/youtube'
import { ACTIVE_ACCOUNTS, PLATFORMS_WITH_API } from '@/lib/social-media/accounts'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return unauthorizedResponse()
  }

  const capturedAt = new Date().toISOString()
  const summary: Record<string, { synced: number; skipped: number; errors: string[] }> = {}

  // ──────────────────────────────────────────────
  // 1. YouTube — real API
  // ──────────────────────────────────────────────
  summary.youtube = { synced: 0, skipped: 0, errors: [] }

  const youtubeStats = await fetchAllYouTubeStats()

  if (youtubeStats.length === 0 && !process.env.YOUTUBE_API_KEY) {
    summary.youtube.skipped = 3 // 3 active channels
    summary.youtube.errors.push('YOUTUBE_API_KEY not configured')
  } else {
    for (const stats of youtubeStats) {
      const accountId = `youtube_${stats.handle.toLowerCase()}`
      const { error } = await supabaseAdmin.from('social_media_snapshots_kpi').insert({
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
        summary.youtube.errors.push(`${stats.handle}: ${error.message}`)
      } else {
        summary.youtube.synced++
      }
    }
  }

  // ──────────────────────────────────────────────
  // 2. Platforms without API — insert manual placeholders
  //    (one placeholder per active account, so the UI knows they exist)
  // ──────────────────────────────────────────────
  const manualPlatforms = (['instagram', 'facebook', 'tiktok', 'linkedin'] as const).filter(
    (p) => !PLATFORMS_WITH_API.includes(p),
  )

  for (const platform of manualPlatforms) {
    summary[platform] = { synced: 0, skipped: 0, errors: [] }

    const accounts = ACTIVE_ACCOUNTS.filter((a) => a.platform === platform)

    for (const account of accounts) {
      const { error } = await supabaseAdmin.from('social_media_snapshots_kpi').insert({
        account_id: account.id,
        platform,
        handle: account.handle,
        metric_name: 'manual',
        raw_data: {
          note: `Manual entry required — ${platform} API not yet configured`,
          url: account.url,
        },
        captured_at: capturedAt,
      })

      if (error) {
        summary[platform].errors.push(`${account.handle}: ${error.message}`)
      } else {
        summary[platform].synced++
      }
    }
  }

  const totalErrors = Object.values(summary).flatMap((s) => s.errors)

  return Response.json({
    success: totalErrors.length === 0,
    captured_at: capturedAt,
    summary,
    total_errors: totalErrors.length,
    errors: totalErrors,
  })
}
