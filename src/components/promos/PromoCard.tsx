'use client'

import type { JobOpening } from '@/lib/supabase/types'
import type { PromoStatusCount } from '@/lib/queries/promos'
import { getStatusColor } from './StatusBreakdown'
import { TERMINAL_STATUSES } from '@/lib/zoho/transform'

interface PromoCardProps {
  promo: JobOpening
  statusBreakdown: PromoStatusCount[]
  lastActivity: Date | null
  lastSyncedAt: string | null
  isSelected: boolean
  onSelect: (id: string) => void
}

export default function PromoCard({
  promo,
  statusBreakdown,
  lastActivity,
  lastSyncedAt,
  isSelected,
  onSelect,
}: PromoCardProps) {
  const total = statusBreakdown.reduce((sum, d) => sum + d.count, 0)

  const findCount = (status: string) =>
    statusBreakdown.find((s) => s.status === status)?.count ?? 0

  const hiredCount = findCount('Hired')
  const terminalCount = statusBreakdown
    .filter((d) => TERMINAL_STATUSES.includes(d.status))
    .reduce((s, d) => s + d.count, 0)
  const activeCount = total - terminalCount

  // Top 5 statuses for mini badges
  const topStatuses = statusBreakdown.slice(0, 5)

  const isRecent =
    lastActivity && Date.now() - lastActivity.getTime() < 24 * 60 * 60 * 1000

  // Hired progress percentage
  const hiredPct = total > 0 ? (hiredCount / total) * 100 : 0

  return (
    <button
      type="button"
      onClick={() => onSelect(promo.id)}
      className={`
        w-full rounded-xl border p-5 text-left transition-all duration-200
        ${
          isSelected
            ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30'
            : 'border-gray-700/50 bg-gray-800/50 hover:border-gray-600/50 hover:bg-gray-800/80'
        }
      `}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight text-gray-100">
          {promo.title}
        </h3>
        {isRecent && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Activa
          </span>
        )}
      </div>

      {/* Total candidates - prominent */}
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-gray-100">{total}</span>
        <span className="text-xs text-gray-500">candidatos</span>
      </div>

      {/* Hired progress bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-gray-500">Hired {hiredCount}/{total}</span>
            <span className="tabular-nums text-emerald-400">{hiredPct.toFixed(0)}%</span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-700/40">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${hiredPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stacked bar for all statuses */}
      {total > 0 && (
        <div className="mb-3 flex h-2 w-full overflow-hidden rounded-full bg-gray-700/40">
          {statusBreakdown.map((d) => {
            const pct = (d.count / total) * 100
            if (pct < 0.5) return null
            return (
              <div
                key={d.status}
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: getStatusColor(d.status),
                }}
                title={`${d.status}: ${d.count}`}
              />
            )
          })}
        </div>
      )}

      {/* Key numbers */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold tabular-nums text-blue-400">{activeCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Activos</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums text-emerald-400">{hiredCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Hired</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums text-gray-400">{terminalCount}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Finalizados</p>
        </div>
      </div>

      {/* Top 5 status badges */}
      {topStatuses.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {topStatuses.map((d) => (
            <span
              key={d.status}
              className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-300"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getStatusColor(d.status) }}
              />
              {d.status}
              <span className="tabular-nums text-gray-500">{d.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Last sync & activity */}
      <div className="space-y-0.5 text-[10px] text-gray-500">
        {lastActivity && (
          <p>
            Última actividad:{' '}
            {lastActivity.toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {lastSyncedAt && (
          <p>
            Último sync:{' '}
            {new Date(lastSyncedAt).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </button>
  )
}
