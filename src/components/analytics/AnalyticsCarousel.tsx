'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, BarChart3, Globe, TrendingUp, FileText } from 'lucide-react'
import {
  PLATFORM_LABELS,
  PLATFORMS_WITH_API,
  ACCOUNTS_BY_PLATFORM,
  type SocialPlatform,
} from '@/lib/social-media/accounts'
import { getLatestRRSSSnapshots, type RRSSSnapshot, type YouTubeVideoSnapshot } from '@/lib/queries/rrss'
import AnalyticsKpiCards from '@/components/analytics/AnalyticsKpiCards'
import SessionsTimeChart from '@/components/analytics/SessionsTimeChart'
import TrafficSourcesChart from '@/components/analytics/TrafficSourcesChart'
import TopLandingPages from '@/components/analytics/TopLandingPages'
import GeoBreakdownTable from '@/components/analytics/GeoBreakdownTable'
import type {
  DailyMetrics,
  TrafficSource,
  LandingPage,
  GeoBreakdown,
  OverviewMetrics,
} from '@/lib/google-analytics/client'

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES = [
  { id: 'overview', label: 'Resumen Global', subtitle: 'Métricas combinadas de todos los canales', dotColor: 'bg-gray-400' },
  { id: 'web', label: 'Web', subtitle: 'Google Analytics 4 — tráfico y sesiones', dotColor: 'bg-green-400' },
  { id: 'youtube', label: 'YouTube', subtitle: 'Canales y métricas de video', dotColor: 'bg-red-400' },
  { id: 'instagram', label: 'Instagram', subtitle: 'Seguidores y alcance', dotColor: 'bg-pink-400' },
  { id: 'facebook', label: 'Facebook', subtitle: 'Página y comunidad', dotColor: 'bg-blue-400' },
  { id: 'tiktok', label: 'TikTok', subtitle: 'Contenido corto', dotColor: 'bg-gray-300' },
  { id: 'linkedin', label: 'LinkedIn', subtitle: 'Red profesional', dotColor: 'bg-sky-400' },
] as const

type SlideId = typeof SLIDES[number]['id']

// ─── Platform colors ──────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<SocialPlatform, { accent: string; badge: string; card: string }> = {
  instagram: {
    accent: 'text-pink-400',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    card: 'border-pink-500/20 bg-pink-500/5',
  },
  youtube: {
    accent: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    card: 'border-red-500/20 bg-red-500/5',
  },
  facebook: {
    accent: 'text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    card: 'border-blue-500/20 bg-blue-500/5',
  },
  tiktok: {
    accent: 'text-gray-200',
    badge: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
    card: 'border-gray-500/20 bg-gray-500/5',
  },
  linkedin: {
    accent: 'text-sky-400',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    card: 'border-sky-500/20 bg-sky-500/5',
  },
}

const PLATFORM_ICON: Record<SocialPlatform, string> = {
  instagram: '📸',
  youtube: '▶️',
  facebook: '📘',
  tiktok: '🎵',
  linkedin: '💼',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Overview slide ───────────────────────────────────────────────────────────

function OverviewSlide({
  overview,
  snapshots,
  rrssLoading,
}: {
  overview: OverviewMetrics | null
  snapshots: Map<string, RRSSSnapshot>
  rrssLoading: boolean
}) {
  // Web card
  const webSessions = overview?.sessions ?? null

  // Social platform summaries
  const socialCards: Array<{
    platform: SocialPlatform
    icon: string
    label: string
    value: number | null
    metricLabel: string
    colors: { accent: string; card: string }
  }> = (['youtube', 'instagram', 'facebook', 'tiktok', 'linkedin'] as SocialPlatform[]).map(
    (platform) => {
      const accounts = ACCOUNTS_BY_PLATFORM(platform)
      if (platform === 'youtube') {
        const total = accounts.reduce((sum, a) => {
          const snap = snapshots.get(a.id)
          return sum + (snap?.subscribers_count ?? 0)
        }, 0)
        const hasAny = accounts.some((a) => snapshots.get(a.id)?.subscribers_count != null)
        return {
          platform,
          icon: PLATFORM_ICON[platform],
          label: PLATFORM_LABELS[platform],
          value: hasAny ? total : null,
          metricLabel: 'Suscriptores',
          colors: PLATFORM_COLORS[platform],
        }
      } else {
        const total = accounts.reduce((sum, a) => {
          const snap = snapshots.get(a.id)
          return sum + (snap?.followers_count ?? 0)
        }, 0)
        const hasAny = accounts.some((a) => snapshots.get(a.id)?.followers_count != null)
        return {
          platform,
          icon: PLATFORM_ICON[platform],
          label: PLATFORM_LABELS[platform],
          value: hasAny ? total : null,
          metricLabel: 'Seguidores',
          colors: PLATFORM_COLORS[platform],
        }
      }
    },
  )

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Web card */}
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌐</span>
            <span className="text-xs font-semibold text-gray-300">Web</span>
          </div>
          <p className="text-2xl font-bold text-green-400 tabular-nums">
            {webSessions != null ? formatCount(webSessions) : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Sesiones (GA4)</p>
        </div>

        {/* Social platform cards */}
        {rrssLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-700/40 bg-gray-700/20 p-4 animate-pulse">
                <div className="h-4 w-16 rounded bg-gray-700 mb-2" />
                <div className="h-7 w-20 rounded bg-gray-700" />
              </div>
            ))
          : socialCards.map((card) => (
              <div
                key={card.platform}
                className={`rounded-xl border p-4 flex flex-col gap-2 ${card.colors.card}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{card.icon}</span>
                  <span className="text-xs font-semibold text-gray-300">{card.label}</span>
                </div>
                {card.value != null ? (
                  <>
                    <p className={`text-2xl font-bold tabular-nums ${card.colors.accent}`}>
                      {formatCount(card.value)}
                    </p>
                    <p className="text-[10px] text-gray-500">{card.metricLabel}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">Sin datos</p>
                )}
              </div>
            ))}
      </div>
    </div>
  )
}

// ─── Web (GA4) slide ──────────────────────────────────────────────────────────

function WebSlide({
  overview,
  sessions,
  traffic,
  pages,
  geo,
  loading,
  error,
  errorCode,
  onRetry,
}: {
  overview: OverviewMetrics | null
  sessions: DailyMetrics[]
  traffic: TrafficSource[]
  pages: LandingPage[]
  geo: GeoBreakdown[]
  loading: boolean
  error: string | null
  errorCode: string | null
  onRetry: () => void
}) {
  return (
    <div className="p-5 space-y-6">
      {/* Error states */}
      {error && errorCode === 'PERMISSION_DENIED' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h3 className="text-base font-semibold text-amber-300">Configurar Google Analytics</h3>
          <p className="mt-2 text-sm text-amber-400/90">
            La cuenta de servicio no tiene acceso a la propiedad de GA4. Agrega la siguiente cuenta como{' '}
            <strong>Viewer</strong> en la configuración de la propiedad:
          </p>
          <code className="mt-3 block rounded-lg bg-gray-900/60 px-4 py-2 text-sm text-amber-200">
            kpi-dashboard@firmador-de-documentos.iam.gserviceaccount.com
          </code>
          <button
            onClick={onRetry}
            className="mt-4 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30"
          >
            Reintentar
          </button>
        </div>
      )}

      {error && errorCode === 'NOT_CONFIGURED' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h3 className="text-base font-semibold text-amber-300">API Key no configurada</h3>
          <p className="mt-2 text-sm text-amber-400/90">
            Configurar la variable de entorno{' '}
            <code className="rounded bg-gray-900/60 px-2 py-0.5 text-amber-200">
              NEXT_PUBLIC_SYNC_API_KEY
            </code>{' '}
            en Vercel para conectar el dashboard con la API de analytics.
          </p>
        </div>
      )}

      {error && errorCode !== 'PERMISSION_DENIED' && errorCode !== 'NOT_CONFIGURED' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="text-red-400">Error: {error}</p>
          <button
            onClick={onRetry}
            className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <AnalyticsKpiCards data={overview} loading={loading} />

      {/* Sessions Over Time */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-200">Sesiones en el Tiempo</h3>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <SessionsTimeChart data={sessions} loading={loading} />
        </div>
      </section>

      {/* Traffic Sources + Geo */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-semibold text-gray-200">Fuentes de Tráfico</h3>
          </div>
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <TrafficSourcesChart data={traffic} loading={loading} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-gray-200">Distribución Geográfica</h3>
          </div>
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <GeoBreakdownTable data={geo} loading={loading} />
          </div>
        </section>
      </div>

      {/* Top Landing Pages */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-gray-200">Top Landing Pages</h3>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <TopLandingPages data={pages} loading={loading} />
        </div>
      </section>
    </div>
  )
}

// ─── YouTube tab ──────────────────────────────────────────────────────────────

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
  const topVideos: YouTubeVideoSnapshot[] = snapshot?.raw_data?.topVideos ?? []

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/60 p-5 flex flex-col gap-4">
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
          Actualizado:{' '}
          {new Date(snapshot.captured_at).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}

function YouTubeSlide({ snapshots }: { snapshots: Map<string, RRSSSnapshot> }) {
  const accounts = ACCOUNTS_BY_PLATFORM('youtube')

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
    <div className="p-5 space-y-4">
      {totals.synced > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
            Total combinado · {totals.synced} canal{totals.synced !== 1 ? 'es' : ''}
          </p>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <YouTubeChannelCard key={account.id} account={account} snapshot={snapshots.get(account.id)} />
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

// ─── Generic platform slide ───────────────────────────────────────────────────

function GenericPlatformSlide({
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
    <div className="p-5 space-y-4">
      {withData.length > 0 && (
        <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-4">
          <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
            Seguidores totales
          </p>
          <p className={`text-3xl font-bold ${colors.accent}`}>{formatCount(totalFollowers)}</p>
          <p className="text-xs text-gray-600 mt-1">
            {withData.length} de {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} con datos
          </p>
        </div>
      )}

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
                  {new Date(snap.captured_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                  })}
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

function SkeletonSlide() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="h-20 rounded-xl bg-gray-700/40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-gray-700/40" />
        ))}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AnalyticsCarouselProps {
  overview: OverviewMetrics | null
  sessions: DailyMetrics[]
  traffic: TrafficSource[]
  pages: LandingPage[]
  geo: GeoBreakdown[]
  loading: boolean
  error: string | null
  errorCode: string | null
  onRetry: () => void
}

// ─── Main carousel ────────────────────────────────────────────────────────────

export default function AnalyticsCarousel({
  overview,
  sessions,
  traffic,
  pages,
  geo,
  loading,
  error,
  errorCode,
  onRetry,
}: AnalyticsCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)

  // RRSS data
  const [snapshots, setSnapshots] = useState<Map<string, RRSSSnapshot>>(new Map())
  const [rrssLoading, setRrssLoading] = useState(true)
  const [rrssError, setRrssError] = useState<string | null>(null)

  useEffect(() => {
    getLatestRRSSSnapshots()
      .then(setSnapshots)
      .catch((err) => setRrssError(err instanceof Error ? err.message : 'Error cargando datos RRSS'))
      .finally(() => setRrssLoading(false))
  }, [])

  function goTo(idx: number) {
    if (idx === current) return
    setVisible(false)
    setTimeout(() => {
      setCurrent(idx)
      setVisible(true)
    }, 150)
  }

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length)
  const next = () => goTo((current + 1) % SLIDES.length)

  const slide = SLIDES[current]

  function renderSlide(id: SlideId) {
    switch (id) {
      case 'overview':
        return (
          <OverviewSlide
            overview={overview}
            snapshots={snapshots}
            rrssLoading={rrssLoading}
          />
        )
      case 'web':
        return (
          <WebSlide
            overview={overview}
            sessions={sessions}
            traffic={traffic}
            pages={pages}
            geo={geo}
            loading={loading}
            error={error}
            errorCode={errorCode}
            onRetry={onRetry}
          />
        )
      case 'youtube':
        return rrssLoading ? <SkeletonSlide /> : <YouTubeSlide snapshots={snapshots} />
      case 'instagram':
      case 'facebook':
      case 'tiktok':
      case 'linkedin':
        return rrssLoading ? (
          <SkeletonSlide />
        ) : (
          <GenericPlatformSlide platform={id as SocialPlatform} snapshots={snapshots} />
        )
    }
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-gray-700/50 px-5 py-4">
        {/* Left arrow */}
        <button
          onClick={prev}
          aria-label="Canal anterior"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-400 transition-all hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Center: title + subtitle + dots */}
        <div className="flex flex-1 flex-col items-center gap-1">
          <h3 className="text-sm font-semibold text-gray-200">{slide.label}</h3>
          <p className="text-center text-xs text-gray-500">{slide.subtitle}</p>

          {/* Dot indicators */}
          <div className="mt-1 flex items-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`Ver ${s.label}`}
                className={[
                  'rounded-full transition-all duration-300',
                  i === current
                    ? `h-1.5 w-5 ${s.dotColor}`
                    : 'h-1.5 w-1.5 bg-gray-600 hover:bg-gray-400',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={next}
          aria-label="Siguiente canal"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-400 transition-all hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 active:scale-90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* RRSS global error banner */}
      {rrssError && (
        <div className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {rrssError}
        </div>
      )}

      {/* ── Slide content ── */}
      <div
        className="transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {renderSlide(slide.id)}
      </div>
    </div>
  )
}
