'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, XCircle } from 'lucide-react'
import CandidateDetailTable from '@/components/candidates/CandidateDetailTable'
import { getCandidateStats, type CandidateStats } from '@/lib/queries/candidates'
import { TERMINAL_STATUSES } from '@/lib/zoho/transform'

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
  bgClass: string
}) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgClass}`}
        >
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-gray-100">
            {value.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

function TopStatusList({
  statuses,
  title,
}: {
  statuses: { status: string; count: number }[]
  title: string
}) {
  const top5 = statuses.slice(0, 5)
  const total = statuses.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
        {title}
      </h3>
      <div className="space-y-2">
        {top5.map((s) => {
          const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : '0'
          return (
            <div key={s.status} className="flex items-center justify-between text-sm">
              <span className="truncate text-gray-300">{s.status}</span>
              <span className="ml-2 shrink-0 tabular-nums text-gray-500">
                {s.count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CandidatesPage() {
  const [stats, setStats] = useState<CandidateStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    getCandidateStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false))
  }, [])

  // Prepare filter options from stats
  const statusOptions = (stats?.byStatus ?? []).map((s) => ({
    value: s.status,
    count: s.count,
  }))

  const nationalityOptions = (stats?.byNationality ?? []).map((n) => ({
    value: n.nationality,
    count: n.count,
  }))

  const sourceOptions = (stats?.bySources ?? []).map((s) => ({
    value: s.source,
    count: s.count,
  }))

  // Top 5 active and terminal statuses
  const activeStatuses = (stats?.byStatus ?? []).filter(
    (s) => !TERMINAL_STATUSES.includes(s.status)
  )
  const terminalStatuses = (stats?.byStatus ?? []).filter((s) =>
    TERMINAL_STATUSES.includes(s.status)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Candidatos</h1>
        <p className="mt-1 text-gray-400">
          Todos los candidatos sincronizados desde Zoho Recruit.
        </p>
      </div>

      {/* Stats cards */}
      {loadingStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
            />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Candidatos"
              value={stats.total}
              icon={Users}
              colorClass="text-blue-400"
              bgClass="bg-blue-500/20"
            />
            <StatCard
              label="En Proceso"
              value={stats.activeCount}
              icon={TrendingUp}
              colorClass="text-emerald-400"
              bgClass="bg-emerald-500/20"
            />
            <StatCard
              label="Finalizados"
              value={stats.terminalCount}
              icon={XCircle}
              colorClass="text-gray-400"
              bgClass="bg-gray-500/20"
            />
          </div>

          {/* Status breakdowns */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TopStatusList
              statuses={activeStatuses}
              title="Top 5 Status Activos"
            />
            <TopStatusList
              statuses={terminalStatuses}
              title="Top 5 Status Finalizados"
            />
          </div>
        </>
      ) : null}

      {/* Table */}
      <CandidateDetailTable
        initialStatusOptions={statusOptions}
        initialNationalityOptions={nationalityOptions}
        initialSourceOptions={sourceOptions}
      />
    </div>
  )
}
