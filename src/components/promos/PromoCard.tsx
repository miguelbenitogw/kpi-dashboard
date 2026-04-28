'use client'

import { Star } from 'lucide-react'
import type { JobOpening } from '@/lib/supabase/types'
import type { PromoStatusCount } from '@/lib/queries/promos'
import { getStatusColor } from './StatusBreakdown'
import { TERMINAL_STATUSES } from '@/lib/constants'

interface PromoCardProps {
  promo: JobOpening
  statusBreakdown: PromoStatusCount[]
  lastActivity: Date | null
  lastSyncedAt: string | null
  isSelected: boolean
  isFavorite: boolean
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}

export default function PromoCard({
  promo,
  statusBreakdown,
  lastActivity,
  lastSyncedAt,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
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
      className="relative w-full rounded-xl border p-3 text-left transition-all duration-200"
      style={{
        border: isSelected
          ? '1px solid #93c5fd'
          : isFavorite
          ? '1px solid #fcd34d'
          : '1px solid #e7e2d8',
        background: isSelected
          ? '#eff6ff'
          : isFavorite
          ? '#fffbeb'
          : '#ffffff',
        boxShadow: isSelected
          ? '0 0 0 2px rgba(59,130,246,0.15), 0 1px 3px rgba(28,25,23,0.06)'
          : '0 1px 3px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04)',
      }}
    >
      {/* Favorite button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(promo.id)
        }}
        className="absolute right-3 top-3 rounded-md p-1 transition-colors"
        style={{ color: isFavorite ? '#f59e0b' : '#9c9691' }}
        aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Star
          className="h-4 w-4 transition-colors"
          style={{
            fill: isFavorite ? '#f59e0b' : 'transparent',
            color: isFavorite ? '#f59e0b' : '#9c9691',
          }}
        />
      </button>

      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2 pr-6">
        <h3 className="text-[13px] font-semibold leading-tight" style={{ color: '#1c1917' }}>
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
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums" style={{ color: '#1c1917' }}>{total}</span>
        <span className="text-[11px]" style={{ color: '#78716c' }}>candidatos</span>
      </div>

      {/* Hired progress bar */}
      {total > 0 && (
        <div className="mb-2">
          <div className="mb-0.5 flex items-center justify-between text-[10px]">
            <span style={{ color: '#78716c' }}>Hired {hiredCount}/{total}</span>
            <span className="tabular-nums" style={{ color: '#16a34a' }}>{hiredPct.toFixed(0)}%</span>
          </div>
          <div className="flex h-1 w-full overflow-hidden rounded-full" style={{ background: '#e7e2d8' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${hiredPct}%`, background: '#16a34a' }}
            />
          </div>
        </div>
      )}

      {/* Stacked bar for all statuses */}
      {total > 0 && (
        <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#e7e2d8' }}>
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
      <div className="mb-2 grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-sm font-bold tabular-nums" style={{ color: '#1e4b9e' }}>{activeCount}</p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#78716c' }}>Activos</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums" style={{ color: '#16a34a' }}>{hiredCount}</p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#78716c' }}>Hired</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums" style={{ color: '#57534e' }}>{terminalCount}</p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: '#78716c' }}>Finalizados</p>
        </div>
      </div>

      {/* Top 5 status badges */}
      {topStatuses.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {topStatuses.map((d) => (
            <span
              key={d.status}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: '#f0ece4', color: '#44403c' }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getStatusColor(d.status) }}
              />
              {d.status}
              <span className="tabular-nums" style={{ color: '#78716c' }}>{d.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Last sync & activity */}
      <div className="space-y-0.5 text-[10px]" style={{ color: '#78716c' }}>
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
