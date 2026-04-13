'use client'

import { useState, useMemo } from 'react'
import type { JobOpening, Candidate } from '@/lib/supabase/types'
import type { PromoStatusCount } from '@/lib/queries/promos'
import StatusBreakdown from './StatusBreakdown'
import { getStatusColor } from './StatusBreakdown'

interface PromoDetailProps {
  promo: JobOpening
  candidates: Candidate[]
  statusBreakdown: PromoStatusCount[]
}

type SortField = 'full_name' | 'current_status' | 'days_in_process' | 'sla_status'
type SortDir = 'asc' | 'desc'

const SLA_BADGE: Record<string, string> = {
  green: 'bg-emerald-500/20 text-emerald-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  red: 'bg-red-500/20 text-red-400',
  critical: 'bg-red-600/30 text-red-300',
}

export default function PromoDetail({
  promo,
  candidates,
  statusBreakdown,
}: PromoDetailProps) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('current_status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filteredCandidates = useMemo(() => {
    let list = candidates
    if (statusFilter) {
      list = list.filter((c) => c.current_status === statusFilter)
    }
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'days_in_process') {
        return ((a.days_in_process ?? 0) - (b.days_in_process ?? 0)) * dir
      }
      const aVal = (a[sortField] ?? '').toLowerCase()
      const bVal = (b[sortField] ?? '').toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })
  }, [candidates, statusFilter, sortField, sortDir])

  const total = statusBreakdown.reduce((sum, d) => sum + d.count, 0)

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="ml-1 inline h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return (
      <svg className="ml-1 inline h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
        />
      </svg>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-100">{promo.title}</h2>
        <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-400">
          {promo.client_name && (
            <span>
              Cliente: <span className="text-gray-200">{promo.client_name}</span>
            </span>
          )}
          {promo.owner && (
            <span>
              Owner: <span className="text-gray-200">{promo.owner}</span>
            </span>
          )}
          <span>
            Total: <span className="text-gray-200">{total}</span>
          </span>
        </div>
      </div>

      {/* Status breakdown full */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
          Distribución por Estado
        </h3>
        <StatusBreakdown data={statusBreakdown} />
      </div>

      {/* Status chart - grouped bars */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
          Estudiantes por Estado
        </h3>
        {total > 0 ? (
          <div className="space-y-2">
            {statusBreakdown.map((d) => {
              const pct = (d.count / total) * 100
              const color = getStatusColor(d.status)
              return (
                <button
                  key={d.status}
                  type="button"
                  onClick={() =>
                    setStatusFilter(statusFilter === d.status ? null : d.status)
                  }
                  className={`
                    group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition
                    ${
                      statusFilter === d.status
                        ? 'bg-gray-700/60 ring-1 ring-blue-500/40'
                        : 'hover:bg-gray-700/30'
                    }
                  `}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 text-gray-200">{d.status}</span>
                  <span className="tabular-nums font-medium text-gray-300">
                    {d.count}
                  </span>
                  <div className="hidden w-32 sm:block">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/50">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right tabular-nums text-xs text-gray-500">
                    {pct.toFixed(0)}%
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500">Sin datos</p>
        )}
        {statusFilter && (
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition"
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Student list */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
          Estudiantes
          {statusFilter && (
            <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-normal normal-case text-blue-400">
              {statusFilter}
            </span>
          )}
          <span className="ml-2 text-xs font-normal normal-case text-gray-500">
            ({filteredCandidates.length})
          </span>
        </h3>

        {filteredCandidates.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-500">
            No hay estudiantes{statusFilter ? ` con estado "${statusFilter}"` : ''}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-700/50 text-xs uppercase tracking-wider text-gray-400">
                  {([
                    ['full_name', 'Nombre'],
                    ['current_status', 'Estado'],
                    ['days_in_process', 'Días en proceso'],
                    ['sla_status', 'SLA'],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th key={field} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className="inline-flex items-center transition hover:text-gray-200"
                      >
                        {label}
                        <SortIcon field={field} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredCandidates.map((c) => {
                  const slaClass =
                    SLA_BADGE[c.sla_status?.toLowerCase() ?? ''] ??
                    'bg-gray-700/30 text-gray-500'
                  const statusColor = getStatusColor(c.current_status ?? '')

                  return (
                    <tr
                      key={c.id}
                      className="transition hover:bg-gray-700/20"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-100">
                        {c.full_name ?? '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: statusColor }}
                          />
                          <span className="text-gray-300">
                            {c.current_status ?? '\u2014'}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-300">
                        {c.days_in_process != null ? `${c.days_in_process}d` : '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${slaClass}`}
                        >
                          {c.sla_status ?? 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
