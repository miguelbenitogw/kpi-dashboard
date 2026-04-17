'use client'

import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import type { TrafficLight } from '@/lib/queries/semaphore'

type Props = {
  title: string
  subtitle?: string
  status: TrafficLight
  ratio?: number // 0..1 or more
  metrics?: { label: string; value: string | number }[]
  icon?: LucideIcon
}

const STATUS_STYLES: Record<
  TrafficLight,
  {
    border: string
    iconBg: string
    icon: LucideIcon
    label: string
    labelText: string
  }
> = {
  green: {
    border: 'border-l-ok-500',
    iconBg: 'bg-ok-500/15 text-ok-400',
    icon: CheckCircle2,
    label: 'Objetivo cumplido',
    labelText: 'text-ok-400',
  },
  yellow: {
    border: 'border-l-warn-500',
    iconBg: 'bg-warn-500/15 text-warn-400',
    icon: AlertTriangle,
    label: 'A -10% del objetivo',
    labelText: 'text-warn-400',
  },
  red: {
    border: 'border-l-danger-500',
    iconBg: 'bg-danger-500/15 text-danger-400',
    icon: XCircle,
    label: 'A -20% o peor',
    labelText: 'text-danger-400',
  },
  unknown: {
    border: 'border-l-surface-600',
    iconBg: 'bg-surface-700/60 text-gray-400',
    icon: HelpCircle,
    label: 'Sin objetivo definido',
    labelText: 'text-gray-400',
  },
}

export default function SemaphoreCard({
  title,
  subtitle,
  status,
  ratio,
  metrics,
  icon: CustomIcon,
}: Props) {
  const s = STATUS_STYLES[status]
  const Icon = CustomIcon ?? s.icon

  const pct = ratio !== undefined && Number.isFinite(ratio) ? Math.round(ratio * 100) : null

  return (
    <div
      className={`rounded-xl border border-surface-700/60 bg-surface-850/60 p-5 border-l-4 ${s.border} transition-colors hover:bg-surface-800/80`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-400 truncate">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</p>
          )}
          {pct !== null && (
            <p className="mt-2 text-3xl font-bold text-gray-50 tabular-nums">
              {pct}%
            </p>
          )}
          <p className={`mt-1 text-xs font-medium ${s.labelText}`}>{s.label}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${s.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {metrics && metrics.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-surface-700/50 pt-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                {m.label}
              </p>
              <p className="text-sm font-semibold text-gray-200 tabular-nums">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
