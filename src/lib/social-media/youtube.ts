export interface YouTubeStats {
  channelId: string
  handle: string
  subscriberCount: number
  videoCount: number
  viewCount: number
  topVideos: YouTubeVideo[]
}

export interface YouTubeVideo {
  videoId: string
  title: string
  viewCount: number
  likeCount: number
  publishedAt: string
  thumbnail: string
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * Fetch statistics + top-5 most viewed videos for a single YouTube channel.
 * Returns null when YOUTUBE_API_KEY is not set or the API call fails.
 */
export async function fetchYouTubeStats(handle: string): Promise<YouTubeStats | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  // 1. Get channel metadata + stats
  const channelRes = await fetch(
    `${YT_BASE}/channels?part=statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
    { next: { revalidate: 3600 } },
  ).catch(() => null)

  if (!channelRes?.ok) return null

  const channelData = await channelRes.json()
  const item = channelData?.items?.[0]
  if (!item) return null

  const channelId = item.id as string
  const subscriberCount = parseInt(item.statistics?.subscriberCount ?? '0', 10)
  const videoCount = parseInt(item.statistics?.videoCount ?? '0', 10)
  const viewCount = parseInt(item.statistics?.viewCount ?? '0', 10)

  // 2. Get top-5 most viewed videos via search (100 quota units — fine for daily sync)
  const topVideos = await fetchTopVideos(channelId, apiKey)

  return { channelId, handle, subscriberCount, videoCount, viewCount, topVideos }
}

/**
 * Fetch top-5 most viewed videos for a channel.
 * Uses search.list (order=viewCount) + videos.list for full stats.
 */
async function fetchTopVideos(channelId: string, apiKey: string): Promise<YouTubeVideo[]> {
  try {
    // search.list — order by viewCount, grab 5
    const searchRes = await fetch(
      `${YT_BASE}/search?part=snippet&channelId=${channelId}&order=viewCount&type=video&maxResults=5&key=${apiKey}`,
    ).catch(() => null)

    if (!searchRes?.ok) return []

    const searchData = await searchRes.json()
    const items = (searchData?.items ?? []) as Array<{
      id: { videoId: string }
      snippet: { title: string; publishedAt: string; thumbnails: { default?: { url: string }; medium?: { url: string } } }
    }>

    if (items.length === 0) return []

    const videoIds = items.map((i) => i.id.videoId).join(',')

    // videos.list — get view + like counts
    const statsRes = await fetch(
      `${YT_BASE}/videos?part=statistics&id=${videoIds}&key=${apiKey}`,
    ).catch(() => null)

    const statsData = statsRes?.ok ? await statsRes.json() : null
    const statsMap = new Map<string, { viewCount: number; likeCount: number }>()

    for (const v of statsData?.items ?? []) {
      statsMap.set(v.id as string, {
        viewCount: parseInt(v.statistics?.viewCount ?? '0', 10),
        likeCount: parseInt(v.statistics?.likeCount ?? '0', 10),
      })
    }

    return items.map((item) => {
      const stats = statsMap.get(item.id.videoId)
      return {
        videoId: item.id.videoId,
        title: item.snippet.title,
        viewCount: stats?.viewCount ?? 0,
        likeCount: stats?.likeCount ?? 0,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
      }
    })
  } catch {
    return []
  }
}

/** Active YouTube handles (matches SOCIAL_ACCOUNTS active: true) */
const YOUTUBE_ACTIVE_HANDLES = ['GlobalWorking', 'globalworkingfrance', 'GlobalWorkingNorge']

/**
 * Fetch stats for all active YouTube channels concurrently.
 * Settled — individual failures don't abort the whole batch.
 */
export async function fetchAllYouTubeStats(): Promise<YouTubeStats[]> {
  const results = await Promise.allSettled(
    YOUTUBE_ACTIVE_HANDLES.map((h) => fetchYouTubeStats(h)),
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<YouTubeStats> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => r.value)
}
