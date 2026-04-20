export interface YouTubeStats {
  channelId: string
  handle: string
  subscriberCount: number
  videoCount: number
  viewCount: number
}

/**
 * Fetch statistics for a single YouTube channel by handle.
 * Returns null when:
 *   - YOUTUBE_API_KEY env is not set (safe for local dev without a key)
 *   - The API call fails or returns no items
 */
export async function fetchYouTubeStats(handle: string): Promise<YouTubeStats | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  const url =
    `https://www.googleapis.com/youtube/v3/channels` +
    `?part=statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`

  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: 3600 } }) // cache 1 h
  } catch {
    return null
  }

  if (!res.ok) return null

  const data = await res.json()
  const item = data?.items?.[0]
  if (!item) return null

  return {
    channelId: item.id as string,
    handle,
    subscriberCount: parseInt(item.statistics?.subscriberCount ?? '0', 10),
    videoCount: parseInt(item.statistics?.videoCount ?? '0', 10),
    viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
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
