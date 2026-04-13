'use client'

import { useState, useMemo } from 'react'
import type { JobOpening } from '@/lib/supabase/types'
import type { PromoStatusCount } from '@/lib/queries/promos'
import type { CandidateWithHistory } from '@/lib/queries/promos'
import StatusBreakdown from './StatusBreakdown'
import { getStatusColor } from './StatusBreakdown'

interface PromoDetailProps {
  promo: JobOpening
  candidates: CandidateWithHistory[]
  statusBreakdown: PromoStatusCount[]
}

type SortField = 'full_name' | 'current_status' | 'days_in_process' | 'sla_status' | 'modified_time'
type SortDir = 'asc' | 'desc'
type TabView = 'breakdown' | 'students' | 'timeline'

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
  const [activeTab, setActiveTab] = useState<TabView>('breakdown')

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
      if (sortField === 'modified_time') {
        const aDate = a.modified_time ?? ''
        const bDate = b.modified_time ?? ''
        return aDate.localeCompare(bDate) * dir
      }
      const aVal = (a[sortField] ?? '').toLowerCase()
      const bVal = (b[sortField] ?? '').toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })
  }, [candidates, statusFilter, sortField, sortDir])

  // Build timeline data from candidates with stage_history
  const timelineEvents = useMemo(() => {
    const events: {
      candidateName: string
      fromStatus: string | null
      toStatus: string | null
      changedAt: string | null
      daysInStage: number | null
    }[] = []

    for (const c of candidates) {
      if (c.stage_history && c.stage_history.length > 0) {
        for (const h of c.stage_history) {
          events.push({
            candidateName: c.full_name ?? 'Sin nombre',
            fromStatus: h.from_status,
            toStatus: h.to_status,
            changedAt: h.changed_at,
            daysInStage: h.days_in_stage,
          })
        }
      }
    }

    return events.sort((a, b) => {
      const aDate = a.changedAt ?? ''
      const bDate = b.changedAt ?? ''
      return bDate.localeCompare(aDate)
    })
  }, [candidates])

  const total = statusBreakdown.reduce((sum, d) => sum + d.count, 0)

  // Get unique statuses for filter dropdown
  const uniqueStatuses = useMemo(
    () => statusBreakdown.map((d) => d.status),
    [statusBreakdown]
  )

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

  const tabs: { id: TabView; label: string }[] = [
    { id: 'breakdown', label: 'Distribución' },
    { id: 'students', label: `Estudiantes (${total})` },
    { id: 'timeline', label: 'Timeline' },
  ]

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

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800/80 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 rounded-md px-3 py-2 text-xs font-medium transition
              ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-gray-100 shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Breakdown */}
      {activeTab === 'breakdown' && (
        <>
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
              Distribución por Estado
            </h3>
            <StatusBreakdown data={statusBreakdown} />
          </div>

          {/* Interactive status chart */}
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
                      onClick={() => {
                        setStatusFilter(statusFilter === d.status ? null : d.status)
                        setActiveTab('students')
                      }}
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
          </div>
        </>
      )}

      {/* Tab: Students */}
      {activeTab === 'students' && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          {/* Filter row */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-medium uppercase tracking-wider text-gray-400">
              Estudiantes
            </h3>
            <select
              value={statusFilter ?? ''}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {statusFilter && (
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className="text-xs text-blue-400 transition hover:text-blue-300"
              >
                Limpiar filtro
              </button>
            )}
            <span className="text-xs text-gray-500">
              ({filteredCandidates.length} de {candidates.length})
            </span>
          </div>

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
                      ['days_in_process', 'Días'],
                      ['sla_status', 'SLA'],
                      ['modified_time', 'Última mod.'],
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
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                          {c.modified_time
                            ? new Date(c.modified_time).toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '\u2014'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
            Movimientos recientes
          </h3>
          {timelineEvents.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-gray-500">
              No hay movimientos registrados
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 h-full w-px bg-gray-700/50" />

              {timelineEvents.slice(0, 50).map((event, idx) => {
                const toColor = getStatusColor(event.toStatus ?? '')
                return (
                  <div key={idx} className="relative flex gap-4 py-3 pl-4">
                    {/* Dot */}
                    <span
                      className="absolute left-[11px] top-[18px] z-10 h-2.5 w-2.5 rounded-full ring-2 ring-gray-800"
                      style={{ backgroundColor: toColor }}
                    />

                    {/* Content */}
                    <div className="ml-6 flex-1">
                      <p className="text-sm text-gray-200">
                        <span className="font-medium">{event.candidateName}</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                        {event.fromStatus && (
                          <>
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2 py-0.5 text-gray-400"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: getStatusColor(event.fromStatus) }}
                              />
                              {event.fromStatus}
                            </span>
                            <svg className="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-gray-700/50 px-2 py-0.5 text-gray-300"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: toColor }}
                          />
                          {event.toStatus ?? 'Unknown'}
                        </span>
                        {event.daysInStage != null && (
                          <span className="text-gray-500">
                            ({event.daysInStage}d en etapa anterior)
                          </span>
                        )}
                      </div>
                      {event.changedAt && (
                        <p className="mt-0.5 text-[10px] text-gray-500">
                          {new Date(event.changedAt).toLocaleDateString('es-AR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}

              {timelineEvents.length > 50 && (
                <p className="pl-10 pt-2 text-xs text-gray-500">
                  ...y {timelineEvents.length - 50} movimientos más
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
