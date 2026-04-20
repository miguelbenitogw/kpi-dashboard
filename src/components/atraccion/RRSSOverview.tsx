'use client'

import { useEffect, useState } from 'react'
import {
  PLATFORM_ORDER,
  PLATFORM_LABELS,
  PLATFORMS_WITH_API,
  ACCOUNTS_BY_PLATFORM,
  type SocialPlatform,
} from '@/lib/social-media/accounts'
import { getLatestRRSSSnapshots, type RRSSSnapshot, type YouTubeVideoSnapshot } from '@/lib/queries/rrss'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<SocialPlatform, { tab: string; accent: string; badge: string }> = {
  instagram: {
    tab: 'data-[active=true]:border-pink-500 data-[active=true]:text-pink-400',
    accent: 'text-pink-400',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
  youtube: {
    tab: 'data-[active=true]:border-red-500 data-[active=true]:text-red-400',
    accent: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  facebook: {
    tab: 'data-[active=true]:border-blue-500 data-[active=true]:text-blue-400',
    accent: 'text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  tiktok: {
    tab: 'data-[active=true]:border-gray-200 data-[active=true]:text-gray-200',
    accent: 'text-gray-200',
    badge: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  },
  linkedin: {
    tab: 'data-[active=true]:border-sky-500 data-[active=true]:text-sky-400',
    accent: 'text-sky-400',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
}

const PLATFORM_ICON: Record<SocialPlatform, string> = {
  instagram: '📸',
  youtube: '▶️',
  facebook: '📘',
  tiktok: '🎵',
  linkedin: '💼',
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── YouTube tab — rich metrics per channel ────────────────────────────────

function TopVideoRow({ video }: { video: YouTubeVideoSnapshot }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-700/40 transition-colors group"
    >
      {video.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnail}
          alt=""
          className="h-10 w-[72px] shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-10 w-[72px] shrink-0 rounded bg-gray-700/60" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-300 group-hover:text-white transition-colors leading-snug">
          {video.title}
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
          {formatCount(video.viewCount)} vistas · {formatCount(video.likeCount)} likes
        </p>
      </div>
    </a>
  )
}

function YouTubeChannelCard({
  account,
  snapshot,
}: {
  account: ReturnType<typeof ACCOUNTS_BY_PLATFORM>[number]
  snapshot: RRSSSnapshot | undefined
}) {
  const hasData = !!snapshot && snapshot.metric_name === 'snapshot'
  const topVideos: YouTubeVideoSnapshot[] = (snapshot?.raw_data?.topVideos ?? [])

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/60 p-5 flex flex-col gap-4">
      {/* Channel header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <a
            href={account.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-200 hover:text-red-400 transition-colors"
          >
            @{account.handle}
          </a>
          <p className="text-xs text-gray-500 mt-0.5">Canal de YouTube</p>
        </div>
        <span className="shrink-0 text-xl">▶️</span>
      </div>

      {hasData ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-700/40 p-3 text-center">
              <p className="text-base font-bold text-red-400 tabular-nums">
                {formatCount(snapshot.subscribers_count)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Suscriptores</p>
            </div>
            <div className="rounded-lg bg-gray-700/40 p-3 text-center">
              <p className="text-base font-bold text-orange-400 tabular-nums">
                {formatCount(snapshot.posts_count)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Videos</p>
            </div>
            <div className="rounded-lg bg-gray-700/40 p-3 text-center">
              <p className="text-base font-bold text-yellow-400 tabular-nums">
                {formatCount(snapshot.total_views)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Vistas</p>
            </div>
          </div>

          {/* Top videos */}
          {topVideos.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Top videos
              </p>
              <div className="divide-y divide-gray-700/40">
                {topVideos.map((v) => (
                  <TopVideoRow key={v.videoId} video={v} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-700 p-4 text-center">
          <p className="text-xs text-gray-500">Sin datos — ejecutá el sync de YouTube</p>
        </div>
      )}

      {snapshot && (
        <p className="text-right text-[10px] text-gray-600">
          Actualizado: {new Date(snapshot.captured_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
        </p>
      )}
    </div>
  )
}

function YouTubeTab({ snapshots }: { snapshots: Map<string, RRSSSnapshot> }) {
  const accounts = ACCOUNTS_BY_PLATFORM('youtube')

  // Aggregate totals across channels
  const totals = accounts.reduce(
    (acc, a) => {
      const snap = snapshots.get(a.id)
      if (snap && snap.metric_name === 'snapshot') {
        acc.subscribers += snap.subscribers_count ?? 0
        acc.videos += snap.posts_count ?? 0
        acc.views += snap.total_views ?? 0
        acc.synced++
      }
      return acc
    },
    { subscribers: 0, videos: 0, views: 0, synced: 0 },
  )

  return (
    <div className="space-y-4">
      {/* Combined totals banner */}
      {totals.synced > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Total combinado · {totals.synced} canal{totals.synced !== 1 ? 'es' : ''}</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-red-400">{formatCount(totals.subscribers)}</p>
              <p className="text-xs text-gray-500">Suscriptores</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-400">{formatCount(totals.videos)}</p>
              <p className="text-xs text-gray-500">Videos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{formatCount(totals.views)}</p>
              <p className="text-xs text-gray-500">Vistas totales</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-channel cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <YouTubeChannelCard
            key={account.id}
            account={account}
            snapshot={snapshots.get(account.id)}
          />
        ))}
      </div>

      {totals.synced === 0 && (
        <div className="rounded-xl border border-dashed border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-2xl mb-2">▶️</p>
          <p className="text-sm font-medium text-gray-300">Sin datos de YouTube</p>
          <p className="text-xs text-gray-500 mt-1">
            Configurá <code className="text-red-400">YOUTUBE_API_KEY</code> en Vercel y ejecutá el sync
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Generic platform tab (Instagram, Facebook, TikTok, LinkedIn) ──────────

function GenericPlatformTab({
  platform,
  snapshots,
}: {
  platform: SocialPlatform
  snapshots: Map<string, RRSSSnapshot>
}) {
  const accounts = ACCOUNTS_BY_PLATFORM(platform)
  const colors = PLATFORM_COLORS[platform]
  const hasApi = PLATFORMS_WITH_API.includes(platform)

  const totalFollowers = accounts.reduce((sum, a) => {
    const snap = snapshots.get(a.id)
    return sum + (snap?.followers_count ?? 0)
  }, 0)

  const withData = accounts.filter((a) => snapshots.get(a.id)?.followers_count != null)

  return (
    <div className="space-y-4">
      {/* Total banner */}
      {withData.length > 0 && (
        <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-4">
          <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Seguidores totales</p>
          <p className={`text-3xl font-bold ${colors.accent}`}>{formatCount(totalFollowers)}</p>
          <p className="text-xs text-gray-600 mt-1">{withData.length} de {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} con datos</p>
        </div>
      )}

      {/* Account cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {accounts.map((account) => {
          const snap = snapshots.get(account.id)
          const followers = snap?.followers_count ?? null
          const hasData = followers !== null

          return (
            <div key={account.id} className="rounded-xl border border-gray-700/60 bg-gray-800/60 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <a
                  href={account.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm font-semibold text-gray-200 hover:${colors.accent} transition-colors`}
                >
                  @{account.handle}
                </a>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors.badge}`}>
                  Manual
                </span>
              </div>

              {hasData ? (
                <div className="rounded-lg bg-gray-700/40 p-3 text-center">
                  <p className={`text-2xl font-bold tabular-nums ${colors.accent}`}>
                    {formatCount(followers)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Seguidores</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-700 p-3 text-center">
                  <p className="text-xs text-gray-500">Sin datos aún</p>
                </div>
              )}

              {snap && (
                <p className="mt-2 text-right text-[10px] text-gray-600">
                  {new Date(snap.captured_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {!hasApi && (
        <p className="text-xs text-gray-600 text-center pt-1">
          {PLATFORM_LABELS[platform]} no tiene API pública — los datos se actualizan manualmente
        </p>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonTab() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 rounded-xl bg-gray-700/40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-gray-700/40" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RRSSOverview() {
  const [activeTab, setActiveTab] = useState<SocialPlatform>('youtube')
  const [snapshots, setSnapshots] = useState<Map<string, RRSSSnapshot>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLatestRRSSSnapshots()
      .then(setSnapshots)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error cargando datos'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-700/50 px-4 gap-1 scrollbar-none">
        {PLATFORM_ORDER.map((platform) => {
          const colors = PLATFORM_COLORS[platform]
          const isActive = activeTab === platform
          const hasApi = PLATFORMS_WITH_API.includes(platform)

          return (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              data-active={isActive}
              className={[
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap',
                isActive
                  ? `${colors.tab} border-current`
                  : 'border-transparent text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              <span>{PLATFORM_ICON[platform]}</span>
              <span>{PLATFORM_LABELS[platform]}</span>
              {hasApi && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                  API
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonTab />
        ) : activeTab === 'youtube' ? (
          <YouTubeTab snapshots={snapshots} />
        ) : (
          <GenericPlatformTab platform={activeTab} snapshots={snapshots} />
        )}
      </div>
    </div>
  )
}
