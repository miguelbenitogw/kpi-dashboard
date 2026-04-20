export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'youtube'

export interface SocialAccount {
  id: string
  platform: SocialPlatform
  handle: string
  url: string
  type: string
  active: boolean
  channelId?: string
}

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  // Instagram
  {
    id: 'instagram_global_working',
    platform: 'instagram',
    handle: 'global_working',
    url: 'https://www.instagram.com/global_working/',
    type: 'creator',
    active: true,
  },
  {
    id: 'instagram_globalworkingfrance',
    platform: 'instagram',
    handle: 'globalworkingfrance',
    url: 'https://www.instagram.com/globalworkingfrance/',
    type: 'creator',
    active: true,
  },
  {
    id: 'instagram_spanskialicante',
    platform: 'instagram',
    handle: 'spanskialicante',
    url: 'https://www.instagram.com/spanskialicante/',
    type: 'business',
    active: true,
  },

  // Facebook
  {
    id: 'facebook_globalworking_spain',
    platform: 'facebook',
    handle: 'globalworking.spain',
    url: 'https://www.facebook.com/globalworking.spain/',
    type: 'page',
    active: true,
  },
  {
    id: 'facebook_globalworkingfrance',
    platform: 'facebook',
    handle: 'globalworkingfrance',
    url: 'https://www.facebook.com/globalworkingfrance/',
    type: 'page',
    active: true,
  },

  // TikTok
  {
    id: 'tiktok_globalworking',
    platform: 'tiktok',
    handle: 'globalworking',
    url: 'https://www.tiktok.com/@globalworking',
    type: 'creator',
    active: true,
  },
  {
    id: 'tiktok_globalworkingitalia',
    platform: 'tiktok',
    handle: 'globalworkingitalia',
    url: 'https://www.tiktok.com/@globalworkingitalia',
    type: 'creator',
    active: false,
  },
  {
    id: 'tiktok_spanskialicante',
    platform: 'tiktok',
    handle: 'spanskialicante',
    url: 'https://www.tiktok.com/@spanskialicante',
    type: 'creator',
    active: true,
  },

  // LinkedIn
  {
    id: 'linkedin_global_working_recruitment',
    platform: 'linkedin',
    handle: 'global-working-recruitment',
    url: 'https://www.linkedin.com/company/global-working-recruitment/',
    type: 'company',
    active: true,
  },
  {
    id: 'linkedin_global_working_france',
    platform: 'linkedin',
    handle: 'global-working-france',
    url: 'https://www.linkedin.com/company/global-working-france/',
    type: 'company',
    active: true,
  },
  {
    id: 'linkedin_global_working_italia',
    platform: 'linkedin',
    handle: 'global-working-italia',
    url: 'https://www.linkedin.com/company/global-working-italia/',
    type: 'company',
    active: true,
  },
  {
    id: 'linkedin_global_working_europe',
    platform: 'linkedin',
    handle: 'global-working-europe',
    url: 'https://www.linkedin.com/company/global-working-europe/',
    type: 'company',
    active: false,
  },

  // YouTube
  {
    id: 'youtube_globalworking',
    platform: 'youtube',
    handle: 'GlobalWorking',
    url: 'https://www.youtube.com/@GlobalWorking/',
    type: 'channel',
    active: true,
  },
  {
    id: 'youtube_globalworkingitalia',
    platform: 'youtube',
    handle: 'globalworkingitalia',
    url: 'https://www.youtube.com/@globalworkingitalia',
    type: 'channel',
    active: false,
  },
  {
    id: 'youtube_globalworkingfrance',
    platform: 'youtube',
    handle: 'globalworkingfrance',
    url: 'https://www.youtube.com/@globalworkingfrance',
    type: 'channel',
    active: true,
  },
  {
    id: 'youtube_globalworkingnorge',
    platform: 'youtube',
    handle: 'GlobalWorkingNorge',
    url: 'https://www.youtube.com/@GlobalWorkingNorge',
    type: 'channel',
    active: true,
  },
]

export const ACTIVE_ACCOUNTS = SOCIAL_ACCOUNTS.filter((a) => a.active)

export const ACCOUNTS_BY_PLATFORM = (platform: SocialPlatform): SocialAccount[] =>
  ACTIVE_ACCOUNTS.filter((a) => a.platform === platform)

/** Platforms that have a real API integration implemented */
export const PLATFORMS_WITH_API: SocialPlatform[] = ['youtube']

/** Human-readable platform labels */
export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

/** Platform display order in the UI */
export const PLATFORM_ORDER: SocialPlatform[] = [
  'instagram',
  'linkedin',
  'youtube',
  'facebook',
  'tiktok',
]
