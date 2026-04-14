'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getPromoHistoryOverview,
  type CandidateWithHistory,
  type CandidateHistoryRecord,
} from '@/lib/queries/performance'
import StatusBadge from '@/components/candidates/StatusBadge'

// --- Sub-components ---

function TimelineStep({ record }: { record: CandidateHistoryRecord }) {
  const isAtraccion = record.association_type === 'atraccion'
  const dotColor = isAtraccion ? 'bg-blue-400' : 'bg-emerald-400'
  const lineColor = isAtraccion ? 'bg-blue-400/30' : 'bg-emerald-400/30'
  const labelColor = isAtraccion ? 'text-blue-400' : 'text-emerald-400'
  const badgeBg = isAtraccion ? 'bg-blue-500/15' : 'bg-emerald-500/15'

  return (
    <div className="relative flex items-start gap-3 pb-6 last:pb-0">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
        <div className={`w-0.5 flex-1 ${lineColor}`} />
      </div>
      {/* Card */}
      <div className="min-w-0 flex-1 rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-2">
        <p className="truncate text-sm font-medium text-gray-200" title={record.job_opening_title ?? ''}>
          {record.job_opening_title ?? 'Sin titulo'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {record.candidate_status_in_jo && (
            <StatusBadge status={record.candidate_status_in_jo} size="sm" />
          )}
          <span className={`rounded-full ${badgeBg} px-2 py-0.5 text-[10px] font-medium ${labelColor}`}>
            {record.association_type ?? 'unknown'}
          </span>
        </div>
      </div>
    </div>
  )
}

function HorizontalTimeline({ records }: { records: CandidateHistoryRecord[] }) {
  if (records.length === 0) {
    return <p className="py-3 text-xs text-gray-500">Sin historial de proyectos</p>
  }
  return (
    <div className="overflow-x-auto py-3">
      <div className="flex items-start gap-2">
        {records.map((record, idx) => {
          const isAtraccion = record.association_type === 'atraccion'
          const dotColor = isAtraccion ? 'bg-blue-400' : 'bg-emerald-400'
          const lineColor = isAtraccion ? 'border-blue-400/40' : 'border-emerald-400/40'
          const labelColor = isAtraccion ? 'text-blue-400' : 'text-emerald-400'
          const badgeBg = isAtraccion ? 'bg-blue-500/15' : 'bg-emerald-500/15'

          return (
            <div key={record.id} className="flex items-start">
              {/* Step */}
              <div className="flex flex-col items-center">
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                <div className="mt-1 w-[140px] rounded-lg border border-gray-700/50 bg-gray-800/60 px-2.5 py-2">
                  <p className="truncate text-xs font-medium text-gray-200" title={record.job_opening_title ?? ''}>
                    {record.job_opening_title ?? 'Sin titulo'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {record.candidate_status_in_jo && (
                      <StatusBadge status={record.candidate_status_in_jo} size="sm" />
                    )}
                  </div>
                  <span className={`mt-1 inline-block rounded-full ${badgeBg} px-1.5 py-0.5 text-[9px] font-medium ${labelColor}`}>
                    {record.association_type ?? 'unknown'}
                  </span>
                </div>
              </div>
              {/* Connector line */}
              {idx < records.length - 1 && (
                <div className={`mt-1 h-0 w-4 self-start border-t-2 border-dashed ${lineColor}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExpandableRow({ candidate }: { candidate: CandidateWithHistory }) {
  const [expanded, setExpanded] = useState(false)

  // Sort: atraccion first, then formacion
  const sortedHistory = useMemo(() => {
    return [...candidate.history].sort((a, b) => {
      if (a.association_type === b.association_type) return 0
      return a.association_type === 'atraccion' ? -1 : 1
    })
  }, [candidate.history])

  return (
    <>
      <tr
        className="cursor-pointer transition hover:bg-gray-700/20"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <td className="whitespace-nowrap px-3 py-2.5">
          <div className="flex items-center gap-2">
            <svg
              className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-gray-100">
              {candidate.candidate_name ?? '\u2014'}
            </span>
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <StatusBadge status={candidate.current_status} size="sm" />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center">
          {candidate.atraccionCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-400">
              {candidate.atraccionCount} atraccion
            </span>
          ) : (
            <span className="text-xs text-gray-600">\u2014</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center">
          {candidate.formacionCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              {candidate.formacionCount} formacion
            </span>
          ) : (
            <span className="text-xs text-gray-600">\u2014</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center tabular-nums text-gray-400">
          {candidate.history.length}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-gray-800/40 px-6 py-3">
            {/* Use vertical timeline on narrow, horizontal on wide */}
            <div className="hidden md:block">
              <HorizontalTimeline records={sortedHistory} />
            </div>
            <div className="md:hidden">
              {sortedHistory.length === 0 ? (
                <p className="py-3 text-xs text-gray-500">Sin historial de proyectos</p>
              ) : (
                sortedHistory.map((record) => (
                  <TimelineStep key={record.id} record={record} />
                ))
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// --- Sort helpers ---

type SortField = 'name' | 'status' | 'atraccion' | 'formacion' | 'total'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

const COLUMNS: { key: SortField; label: string; minWidth: string }[] = [
  { key: 'name', label: 'Nombre', minWidth: '180px' },
  { key: 'status', label: 'Estado', minWidth: '140px' },
  { key: 'atraccion', label: 'Atraccion', minWidth: '100px' },
  { key: 'formacion', label: 'Formacion', minWidth: '100px' },
  { key: 'total', label: 'Total JOs', minWidth: '80px' },
]

function SortIcon({ field, sort }: { field: SortField; sort: SortState }) {
  if (sort.field !== field) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sort.direction === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
    </svg>
  )
}

// --- Main component ---

interface HistoryViewProps {
  promocion: string
}

export default function HistoryView({ promocion }: HistoryViewProps) {
  const [data, setData] = useState<CandidateWithHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ field: 'name', direction: 'asc' })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSearch('')
    getPromoHistoryOverview(promocion)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => console.error('Error loading history:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [promocion])

  const filtered = useMemo(() => {
    let result = data
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((c) => c.candidate_name?.toLowerCase().includes(q))
    }
    // Sort
    const dir = sort.direction === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      switch (sort.field) {
        case 'name':
          return dir * (a.candidate_name ?? '').localeCompare(b.candidate_name ?? '')
        case 'status':
          return dir * (a.current_status ?? '').localeCompare(b.current_status ?? '')
        case 'atraccion':
          return dir * (a.atraccionCount - b.atraccionCount)
        case 'formacion':
          return dir * (a.formacionCount - b.formacionCount)
        case 'total':
          return dir * (a.history.length - b.history.length)
        default:
          return 0
      }
    })
    return result
  }, [data, search, sort])

  const handleSort = (field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const withHistory = data.filter((c) => c.history.length > 0).length
  const totalRecords = data.reduce((acc, c) => acc + c.history.length, 0)

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-gray-700/60 px-3 py-1 text-xs text-gray-300">
          {data.length} candidatos
        </span>
        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-400">
          {withHistory} con historial
        </span>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-400">
          {totalRecords} registros
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-700/50 bg-gray-800/60 py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* Count */}
      <div className="text-xs text-gray-500">
        {filtered.length > 0
          ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`
          : 'Sin resultados'}
        {loading && <span className="ml-2 text-blue-400">Cargando...</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-3 py-3"
                  style={{ minWidth: col.minWidth }}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center transition hover:text-gray-200"
                  >
                    {col.label}
                    <SortIcon field={col.key} sort={sort} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading && data.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skel-${i}`} className="animate-pulse">
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-3">
                      <div className="h-4 w-3/4 rounded bg-gray-700/40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((candidate) => (
                <ExpandableRow key={candidate.candidate_id} candidate={candidate} />
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-gray-500">
                  No hay candidatos con historial
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
