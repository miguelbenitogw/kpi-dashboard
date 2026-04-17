'use client'

import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

type Status = 'good' | 'warning' | 'danger'

interface KpiCardProps {
  title: string
  value: string | number
  trend?: number
  trendLabel?: string
  status?: Status
  icon: LucideIcon
}

const statusAccent: Record<Status, string> = {
  good: 'border-l-ok-500',
  warning: 'border-l-warn-500',
  danger: 'border-l-danger-500',
}

const statusIconBg: Record<Status, string> = {
  good: 'bg-ok-500/10 text-ok-400',
  warning: 'bg-warn-500/10 text-warn-400',
  danger: 'bg-danger-500/10 text-danger-400',
}

const trendColor = (trend: number) =>
  trend >= 0 ? 'text-ok-400' : 'text-danger-400'

export default function KpiCard({
  title,
  value,
  trend,
  trendLabel,
  status = 'good',
  icon: Icon,
}: KpiCardProps) {
  return (
    <div
      className={`
        rounded-xl border border-surface-700/60 bg-surface-850/60 p-5
        border-l-4 ${statusAccent[status]}
        transition-colors hover:bg-surface-800/80 hover:border-brand-600/40
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-400 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-50 tabular-nums">
            {value}
          </p>
        </div>
        <div className={`rounded-lg p-2.5 ${statusIconBg[status]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend >= 0 ? (
            <TrendingUp className={`h-3.5 w-3.5 ${trendColor(trend)}`} />
          ) : (
            <TrendingDown className={`h-3.5 w-3.5 ${trendColor(trend)}`} />
          )}
          <span className={`text-xs font-medium ${trendColor(trend)}`}>
            {trend >= 0 ? '+' : ''}
            {trend}%
          </span>
          {trendLabel && (
            <span className="text-xs text-gray-500">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
