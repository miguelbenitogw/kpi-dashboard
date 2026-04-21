import { ACTIVE_ACCOUNTS } from './accounts'

export interface InstagramStats {
  igBusinessId: string
  accountId: string
  handle: string
  username: string
  name: string | null
  followersCount: number
  followsCount: number
  mediaCount: number
  profilePictureUrl: string | null
  topMedia: InstagramMedia[]
}

export interface InstagramMedia {
  mediaId: string
  caption: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REEL'
  mediaUrl: string | null
  thumbnailUrl: string | null
  permalink: string
  likeCount: number
  commentsCount: number
  timestamp: string
}

const IG_BASE = 'https://graph.facebook.com/v25.0'

export async function fetchInstagramStats(
  igBusinessId: string,
  handle: string,
  accountId: string,
): Promise<InstagramStats | null> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return null

  const fields = 'username,name,followers_count,follows_count,media_count,profile_picture_url'
  const accountRes = await fetch(
    `${IG_BASE}/${igBusinessId}?fields=${fields}&access_token=${token}`,
    { next: { revalidate: 3600 } },
  ).catch(() => null)

  if (!accountRes?.ok) {
    if (accountRes) {
      const body = await accountRes.text().catch(() => '')
      console.error(`[instagram] ${handle} account fetch failed: ${accountRes.status} ${body}`)
    }
    return null
  }

  const account = await accountRes.json()
  const topMedia = await fetchTopMedia(igBusinessId, token)

  return {
    igBusinessId,
    accountId,
    handle,
    username: account.username ?? handle,
    name: account.name ?? null,
    followersCount: account.followers_count ?? 0,
    followsCount: account.follows_count ?? 0,
    mediaCount: account.media_count ?? 0,
    profilePictureUrl: account.profile_picture_url ?? null,
    topMedia,
  }
}

async function fetchTopMedia(igBusinessId: string, token: string): Promise<InstagramMedia[]> {
  try {
    const mediaFields =
      'id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp'
    const res = await fetch(
      `${IG_BASE}/${igBusinessId}/media?fields=${mediaFields}&limit=5&access_token=${token}`,
    ).catch(() => null)

    if (!res?.ok) return []

    const data = await res.json()
    const items = (data?.data ?? []) as Array<{
      id: string
      caption?: string
      media_type: InstagramMedia['mediaType']
      media_url?: string
      thumbnail_url?: string
      permalink: string
      like_count?: number
      comments_count?: number
      timestamp: string
    }>

    return items.map((item) => ({
      mediaId: item.id,
      caption: (item.caption ?? '').slice(0, 300),
      mediaType: item.media_type,
      mediaUrl: item.media_url ?? null,
      thumbnailUrl: item.thumbnail_url ?? null,
      permalink: item.permalink,
      likeCount: item.like_count ?? 0,
      commentsCount: item.comments_count ?? 0,
      timestamp: item.timestamp,
    }))
  } catch {
    return []
  }
}

export async function fetchAllInstagramStats(): Promise<InstagramStats[]> {
  const accounts = ACTIVE_ACCOUNTS.filter((a) => a.platform === 'instagram' && a.igBusinessId)

  const results = await Promise.allSettled(
    accounts.map((a) => fetchInstagramStats(a.igBusinessId!, a.handle, a.id)),
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<InstagramStats> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => r.value)
}
