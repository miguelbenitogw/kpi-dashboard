'use client'

import { useEffect, useState } from 'react'
import {
  PLATFORM_ORDER,
  PLATFORM_LABELS,
  PLATFORMS_WITH_API,
  ACCOUNTS_BY_PLATFORM,
  type SocialPlatform,
} from '@/lib/social-media/accounts'
import { getLatestRRSSSnapshots, type RRSSSnapshot } from '@/lib/queries/rrss'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_ICON: Record<SocialPlatform, string> = {
  instagram: '📸',
  facebook: '📘',
  tiktok: '🎵',
  linkedin: '💼',
  youtube: '▶️',
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function getPrimaryMetric(
  snapshot: RRSSSnapshot | undefined,
  platform: SocialPlatform,
): number | null {
  if (!snapshot) return null
  if (platform === 'youtube') return snapshot.subscribers_count ?? null
  return snapshot.followers_count ?? null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ApiStatusBadge({ hasApi }: { hasApi: boolean }) {
  if (hasApi) {
    return (
      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
        API
      </span>
    )
  }
  return (
    <span className="ml-2 rounded-full bg-gray-700/60 px-2 py-0.5 text-xs font-medium text-gray-500">
      Manual
    </span>
  )
}

function AccountRow({
  account,
  snapshot,
  platform,
}: {
  account: { id: string; handle: string; url: string }
  snapshot: RRSSSnapshot | undefined
  platform: SocialPlatform
}) {
  const metric = getPrimaryMetric(snapshot, platform)
  const hasData = metric !== null

  return (
    <li className="flex items-center justify-between gap-2 py-1">
      <a
        href={account.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate text-xs text-gray-400 transition-colors hover:text-gray-200"
        title={account.url}
      >
        @{account.handle}
      </a>
      <span
        className={[
          'shrink-0 text-xs font-medium tabular-nums',
          hasData ? 'text-blue-400' : 'text-gray-600',
        ].join(' ')}
      >
        {hasData ? formatCount(metric) : '—'}
      </span>
    </li>
  )
}

function PlatformCard({
  platform,
  snapshots,
}: {
  platform: SocialPlatform
  snapshots: Map<string, RRSSSnapshot>
}) {
  const accounts = ACCOUNTS_BY_PLATFORM(platform)
  const hasApi = PLATFORMS_WITH_API.includes(platform)

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/60 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-base" aria-hidden="true">
          {PLATFORM_ICON[platform]}
        </span>
        <h3 className="text-sm font-semibold text-gray-200">{PLATFORM_LABELS[platform]}</h3>
        <ApiStatusBadge hasApi={hasApi} />
      </div>

      <ul className="divide-y divide-gray-700/40">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            snapshot={snapshots.get(account.id)}
            platform={platform}
          />
        ))}
      </ul>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/60 p-4 animate-pulse">
      <div className="mb-3 h-4 w-32 rounded bg-gray-700/60" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-28 rounded bg-gray-700/40" />
            <div className="h-3 w-10 rounded bg-gray-700/40" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RRSSOverview() {
  const [snapshots, setSnapshots] = useState<Map<string, RRSSSnapshot>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLatestRRSSSnapshots()
      .then(setSnapshots)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error cargando datos'))
      .finally(() => setLoading(false))
  }, [])

  // Split platforms into two balanced columns
  const half = Math.ceil(PLATFORM_ORDER.length / 2)
  const leftCol = PLATFORM_ORDER.slice(0, half)
  const rightCol = PLATFORM_ORDER.slice(half)

  return (
    <section aria-labelledby="rrss-heading" className="mt-8">
      <div className="mb-4">
        <h2 id="rrss-heading" className="text-base font-semibold text-gray-100">
          Redes Sociales
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Seguidores por plataforma.{' '}
          <span className="text-emerald-500">YouTube</span> actualizado via API; el resto
          requiere sincronización manual.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            {leftCol.map((p) => (
              <SkeletonCard key={p} />
            ))}
          </div>
          <div className="space-y-4">
            {rightCol.map((p) => (
              <SkeletonCard key={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            {leftCol.map((platform) => (
              <PlatformCard key={platform} platform={platform} snapshots={snapshots} />
            ))}
          </div>
          <div className="space-y-4">
            {rightCol.map((platform) => (
              <PlatformCard key={platform} platform={platform} snapshots={snapshots} />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/60" />
          API disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-600" />
          Entrada manual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-blue-400">123K</span>
          <span>= dato real</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-gray-600">—</span>
          <span>= sin datos aún</span>
        </span>
      </div>
    </section>
  )
}
