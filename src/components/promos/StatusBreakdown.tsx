'use client'

import type { PromoStatusCount } from '@/lib/queries/promos'

const STATUS_COLORS: Record<string, string> = {
  'Associated': '#6B7280',
  'Check Interest': '#8B5CF6',
  'First Call': '#3B82F6',
  'Second Call': '#2563EB',
  'Interview in Progress': '#F59E0B',
  'Interview-Scheduled': '#F59E0B',
  'Approved by client': '#10B981',
  'In Training': '#06B6D4',
  'Training Finished': '#14B8A6',
  'Hired': '#22C55E',
  'To Place': '#84CC16',
  'Assigned': '#22D3EE',
  'On Hold': '#EAB308',
  'Rejected': '#EF4444',
  'Expelled': '#DC2626',
  'No Answer': '#9CA3AF',
  'No Show': '#9CA3AF',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6B7280'
}

interface StatusBreakdownProps {
  data: PromoStatusCount[]
  compact?: boolean
}

export default function StatusBreakdown({ data, compact = false }: StatusBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <div className="text-center text-sm text-gray-500">
        Sin candidatos
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        {data.map((d) => {
          const pct = ((d.count / total) * 100).toFixed(0)
          const color = getStatusColor(d.status)
          return (
            <div key={d.status} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1 truncate text-gray-300">{d.status}</span>
              <span className="tabular-nums text-gray-400">
                {d.count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = ((d.count / total) * 100).toFixed(1)
        const color = getStatusColor(d.status)
        return (
          <div key={d.status} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-200">{d.status}</span>
              </div>
              <span className="tabular-nums text-gray-400">
                {d.count} <span className="text-gray-500">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700/50">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { STATUS_COLORS, getStatusColor }
