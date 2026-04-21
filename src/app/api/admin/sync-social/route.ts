/**
 * POST /api/admin/sync-social
 *
 * Syncs social media stats into social_media_snapshots_kpi.
 *   - YouTube:   fetched via YouTube Data API v3   (requires YOUTUBE_API_KEY)
 *   - Instagram: fetched via Meta Graph API v25    (requires META_ACCESS_TOKEN)
 *   - Other platforms: inserts placeholder rows    (metric_name = 'manual')
 *
 * Requires x-api-key header matching SYNC_API_KEY env var.
 */
import { validateApiKey, unauthorizedResponse } from '../../sync/middleware'
import { fetchAllYouTubeStats } from '@/lib/social-media/youtube'
import { fetchAllInstagramStats } from '@/lib/social-media/instagram'
import { ACTIVE_ACCOUNTS, PLATFORMS_WITH_API } from '@/lib/social-media/accounts'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

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
        raw_data: { channelId: stats.channelId, topVideos: stats.topVideos } as unknown as Json,
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
  // 2. Instagram — Meta Graph API
  // ──────────────────────────────────────────────
  summary.instagram = { synced: 0, skipped: 0, errors: [] }

  const igAccountsWithId = ACTIVE_ACCOUNTS.filter(
    (a) => a.platform === 'instagram' && a.igBusinessId,
  )

  if (!process.env.META_ACCESS_TOKEN) {
    summary.instagram.skipped = igAccountsWithId.length
    summary.instagram.errors.push('META_ACCESS_TOKEN not configured')
  } else {
    const instagramStats = await fetchAllInstagramStats()
    const syncedIds = new Set(instagramStats.map((s) => s.accountId))

    for (const stats of instagramStats) {
      const { error } = await supabaseAdmin.from('social_media_snapshots_kpi').insert({
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
        summary.instagram.errors.push(`${stats.handle}: ${error.message}`)
      } else {
        summary.instagram.synced++
      }
    }

    // Accounts with igBusinessId that fetch returned null for → mark as errored
    for (const a of igAccountsWithId) {
      if (!syncedIds.has(a.id)) {
        summary.instagram.errors.push(`${a.handle}: Graph API fetch failed (token expired? check server logs)`)
      }
    }
  }

  // ──────────────────────────────────────────────
  // 3. Platforms without API — insert manual placeholders
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
