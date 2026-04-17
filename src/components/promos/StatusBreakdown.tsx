'use client'

import type { PromoStatusCount } from '@/lib/queries/promos'
import { TERMINAL_STATUSES } from '@/lib/constants'

const STATUS_COLORS: Record<string, string> = {
  // Pipeline / Early stages
  'Associated': '#6B7280',
  'New': '#A78BFA',
  'Check Interest': '#8B5CF6',
  'First Call': '#3B82F6',
  'Second Call': '#2563EB',
  'No Answer': '#9CA3AF',
  'No Show': '#9CA3AF',
  'On Hold': '#EAB308',
  'Stand-by': '#CA8A04',
  'Next Project': '#A3A3A3',
  'Waiting for Evaluation': '#F59E0B',

  // Interview stages
  'Interview to be Scheduled': '#FB923C',
  'Interview in Progress': '#F97316',
  'Interview-Scheduled': '#EA580C',
  'Approved for interview': '#34D399',
  'Rejected for Interview': '#F87171',
  'Waiting for Consensus': '#FBBF24',

  // Client stages
  'Submitted-to-client': '#60A5FA',
  'Approved by client': '#10B981',
  'Rejected by client': '#EF4444',

  // Offer stages
  'To-be-Offered': '#A3E635',
  'Oferta realizada': '#84CC16',
  'Offer-Accepted': '#22C55E',
  'Offer-Declined': '#F87171',
  'Offer-Withdrawn': '#DC2626',

  // Training & Placement
  'In Training': '#06B6D4',
  'Training Finished': '#14B8A6',
  'In Training out of GW': '#0E7490',
  'To Place': '#84CC16',
  'Assigned': '#22D3EE',
  'Forward-to-Onboarding': '#2DD4BF',

  // Final / Hired
  'Hired': '#22C55E',
  'Converted - Temp': '#16A34A',
  'Converted - Employee': '#15803D',

  // Placement types
  'Permanent Kommune': '#0D9488',
  'Temporary Kommune': '#14B8A6',
  'Permanent Agency': '#0891B2',
  'Temporary Agency': '#06B6D4',

  // Rejected / Out
  'Rejected': '#EF4444',
  'Expelled': '#DC2626',
  'Not Valid': '#B91C1C',
  'Un-Qualified': '#991B1B',
  'No supera B1': '#F87171',
  'Non si presenta': '#9CA3AF',
  'Out of Network': '#78716C',
  'Not in Norway/Germany': '#A8A29E',
  'Transferred': '#7C3AED',

  // Other
  'Open to Opportunities': '#38BDF8',
  'Recolocation Process': '#818CF8',

  // Fallback
  'Unknown': '#6B7280',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6B7280'
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status)
}

interface StatusBreakdownProps {
  data: PromoStatusCount[]
  compact?: boolean
}

interface StatusGroup {
  label: string
  items: PromoStatusCount[]
  total: number
}

function groupStatuses(data: PromoStatusCount[]): StatusGroup[] {
  const active: PromoStatusCount[] = []
  const terminal: PromoStatusCount[] = []
  const other: PromoStatusCount[] = []

  for (const d of data) {
    if (isTerminalStatus(d.status)) {
      terminal.push(d)
    } else if (STATUS_COLORS[d.status]) {
      active.push(d)
    } else {
      other.push(d)
    }
  }

  const groups: StatusGroup[] = []

  if (active.length > 0) {
    groups.push({
      label: 'En Proceso',
      items: active,
      total: active.reduce((s, d) => s + d.count, 0),
    })
  }
  if (terminal.length > 0) {
    groups.push({
      label: 'Finalizados',
      items: terminal,
      total: terminal.reduce((s, d) => s + d.count, 0),
    })
  }
  if (other.length > 0) {
    groups.push({
      label: 'Otros',
      items: other,
      total: other.reduce((s, d) => s + d.count, 0),
    })
  }

  return groups
}

export default function StatusBreakdown({ data, compact = false }: StatusBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const activeCount = data
    .filter((d) => !isTerminalStatus(d.status))
    .reduce((s, d) => s + d.count, 0)
  const terminalCount = total - activeCount

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

  const groups = groupStatuses(data)

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2">
          <span className="text-2xl font-bold tabular-nums text-blue-400">{activeCount}</span>
          <span className="text-xs text-blue-300/70">En proceso</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-gray-500/10 px-3 py-2">
          <span className="text-2xl font-bold tabular-nums text-gray-400">{terminalCount}</span>
          <span className="text-xs text-gray-400/70">Finalizados</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-gray-700/30 px-3 py-2">
          <span className="text-2xl font-bold tabular-nums text-gray-300">{total}</span>
          <span className="text-xs text-gray-500">Total</span>
        </div>
      </div>

      {/* Stacked bar overview */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-700/40">
        {data.map((d) => {
          const pct = (d.count / total) * 100
          if (pct < 0.3) return null
          return (
            <div
              key={d.status}
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: getStatusColor(d.status),
              }}
              title={`${d.status}: ${d.count} (${pct.toFixed(1)}%)`}
            />
          )
        })}
      </div>

      {/* Grouped status lists */}
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {group.label}
            </h4>
            <span className="text-xs tabular-nums text-gray-500">{group.total}</span>
          </div>
          <div className="space-y-1.5">
            {group.items.map((d) => {
              const pct = (d.count / total) * 100
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
                      {d.count} <span className="text-gray-500">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/50">
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
        </div>
      ))}
    </div>
  )
}

export { STATUS_COLORS, getStatusColor }
