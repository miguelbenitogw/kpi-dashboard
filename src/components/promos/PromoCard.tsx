'use client'

import type { JobOpening } from '@/lib/supabase/types'
import type { PromoStatusCount } from '@/lib/queries/promos'
import { getStatusColor } from './StatusBreakdown'

interface PromoCardProps {
  promo: JobOpening
  statusBreakdown: PromoStatusCount[]
  lastActivity: Date | null
  isSelected: boolean
  onSelect: (id: string) => void
}

export default function PromoCard({
  promo,
  statusBreakdown,
  lastActivity,
  isSelected,
  onSelect,
}: PromoCardProps) {
  const total = statusBreakdown.reduce((sum, d) => sum + d.count, 0)

  const findCount = (status: string) =>
    statusBreakdown.find((s) => s.status === status)?.count ?? 0

  const inTraining = findCount('In Training')
  const hired = findCount('Hired')
  const rejected = findCount('Rejected') + findCount('Expelled') + findCount('No Show') + findCount('No Answer')

  const isRecent =
    lastActivity && Date.now() - lastActivity.getTime() < 24 * 60 * 60 * 1000

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
        <h3 className="text-sm font-semibold text-gray-100 leading-tight">
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

      {/* Stacked bar */}
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
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-bold tabular-nums text-gray-100">{total}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Total</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-cyan-400">{inTraining}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Training</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-emerald-400">{hired}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Hired</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-red-400">{rejected}</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Dropped</p>
        </div>
      </div>

      {/* Last activity */}
      {lastActivity && (
        <p className="mt-3 text-[10px] text-gray-500">
          Última actividad: {lastActivity.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </button>
  )
}
