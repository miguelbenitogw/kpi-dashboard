'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronRight as ChevronExpandRight,
} from 'lucide-react'
import type { Candidate } from '@/lib/supabase/types'
import {
  getCandidates,
  getCandidateJobHistory,
  type CandidateQueryOptions,
  type CandidateQueryResult,
  type CandidateJobHistory,
} from '@/lib/queries/candidates'
import StatusBadge from './StatusBadge'
import CandidateFilters from './CandidateFilters'
import ExportCSV from './ExportCSV'

// --- Sort Icon (matches existing CandidateTable pattern) ---

type SortField =
  | 'full_name'
  | 'email'
  | 'current_status'
  | 'nationality'
  | 'source'
  | 'owner'
  | 'created_time'
  | 'last_activity_time'
  | 'days_in_process'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

function SortIcon({
  field,
  sort,
}: {
  field: SortField
  sort: SortState
}) {
  if (sort.field !== field) {
    return (
      <svg
        className="ml-1 inline h-3 w-3 text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    )
  }
  return (
    <svg
      className="ml-1 inline h-3 w-3 text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={sort.direction === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
      />
    </svg>
  )
}

// --- Relative date helper ---

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `${diffDays}d`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`
  return `${Math.floor(diffDays / 365)}a`
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Languages compact format ---

function formatLanguages(
  native: string | null,
  english: string | null,
  german: string | null
): string {
  const parts: string[] = []
  if (native) parts.push(native.substring(0, 2).toUpperCase())
  if (english) parts.push(english)
  if (german) parts.push(german)
  return parts.length > 0 ? parts.join(' / ') : '\u2014'
}

// --- Job history status colors ---

const STATUS_GREEN = new Set([
  'Hired', 'Approved by client', 'Offer-Accepted', 'To-be-Offered',
])
const STATUS_RED = new Set([
  'Rejected', 'Rejected by client', 'Offer-Declined', 'Not Valid',
])
const STATUS_YELLOW = new Set([
  'On Hold', 'No Answer', 'Next Project',
])

function getStatusInJoClass(status: string | null): string {
  if (!status) return 'bg-gray-700/50 text-gray-400'
  if (STATUS_GREEN.has(status)) return 'bg-emerald-500/15 text-emerald-400'
  if (STATUS_RED.has(status)) return 'bg-red-500/15 text-red-400'
  if (STATUS_YELLOW.has(status)) return 'bg-yellow-500/15 text-yellow-300'
  return 'bg-blue-500/15 text-blue-400'
}

function getAssocTypeClass(type: string | null): string {
  if (type === 'formacion') return 'bg-emerald-600/20 text-emerald-300'
  return 'bg-violet-600/20 text-violet-300'
}

// --- Job History Cards ---

function JobHistoryCards({ candidateId }: { candidateId: string }) {
  const [history, setHistory] = useState<CandidateJobHistory[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCandidateJobHistory(candidateId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [candidateId])

  if (loading) {
    return (
      <div className="flex gap-3 px-4 py-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 w-48 animate-pulse rounded-lg bg-gray-700/40" />
        ))}
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-gray-600 italic">
        Sin historial de vacantes
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 px-4 py-3">
      {history.map((h) => (
        <div
          key={h.id}
          className="flex min-w-[200px] max-w-[260px] flex-col gap-1.5 rounded-lg border border-gray-700/60 bg-gray-800/60 p-3 break-words"
        >
          {/* Titulo de vacante — max 2 lineas */}
          <p className="line-clamp-2 text-xs font-medium leading-snug text-gray-200">
            {h.job_opening_title ?? '—'}
          </p>

          {/* Status en esa vacante */}
          <span
            className={`inline-block self-start rounded px-1.5 py-0.5 text-[10px] font-medium ${getStatusInJoClass(h.candidate_status_in_jo)}`}
          >
            {h.candidate_status_in_jo ?? 'Sin estado'}
          </span>

          {/* Footer: tipo + fecha */}
          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getAssocTypeClass(h.association_type)}`}
            >
              {h.association_type ?? 'N/A'}
            </span>
            {h.fetched_at && (
              <span className="text-[10px] text-gray-500">
                Visto: {relativeDate(h.fetched_at)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Filter option type ---

interface FilterOption {
  value: string
  count?: number
}

// --- Component Props ---

interface CandidateDetailTableProps {
  jobOpeningId?: string
  initialStatusOptions?: FilterOption[]
  initialNationalityOptions?: FilterOption[]
  initialSourceOptions?: FilterOption[]
}

// --- Column definitions ---

const COLUMNS: {
  key: SortField | 'phone' | 'languages' | 'job_opening_title'
  label: string
  sortable: boolean
  minWidth: string
  sticky?: boolean
}[] = [
  { key: 'full_name', label: 'Nombre', sortable: true, minWidth: '180px', sticky: true },
  { key: 'email', label: 'Email', sortable: true, minWidth: '200px' },
  { key: 'phone', label: 'Telefono', sortable: false, minWidth: '130px' },
  { key: 'current_status', label: 'Status', sortable: true, minWidth: '180px' },
  { key: 'nationality', label: 'Nacionalidad', sortable: true, minWidth: '120px' },
  { key: 'languages', label: 'Idiomas', sortable: false, minWidth: '140px' },
  { key: 'source', label: 'Fuente', sortable: true, minWidth: '130px' },
  { key: 'owner', label: 'Owner', sortable: true, minWidth: '130px' },
  { key: 'job_opening_title', label: 'Promo', sortable: false, minWidth: '150px' },
  { key: 'created_time', label: 'Creado', sortable: true, minWidth: '90px' },
  { key: 'last_activity_time', label: 'Actividad', sortable: true, minWidth: '100px' },
  { key: 'days_in_process', label: 'Dias', sortable: true, minWidth: '60px' },
]

// --- Main Component ---

export default function CandidateDetailTable({
  jobOpeningId,
  initialStatusOptions = [],
  initialNationalityOptions = [],
  initialSourceOptions = [],
}: CandidateDetailTableProps) {
  // Data state
  const [result, setResult] = useState<CandidateQueryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [allFilteredCandidates, setAllFilteredCandidates] = useState<Candidate[]>([])

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Sort state
  const [sort, setSort] = useState<SortState>({
    field: 'created_time',
    direction: 'desc',
  })

  // Filter state
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])

  // Pagination
  const [page, setPage] = useState(1)
  const perPage = 50

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to first page on search
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Reset page on filter changes
  useEffect(() => {
    setPage(1)
  }, [selectedStatuses, selectedNationalities, selectedSources])

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const options: CandidateQueryOptions = {
        page,
        perPage,
        sortBy: sort.field,
        sortOrder: sort.direction,
        search: debouncedSearch || undefined,
        statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        nationalities:
          selectedNationalities.length > 0 ? selectedNationalities : undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        jobOpeningId,
      }

      const res = await getCandidates(options)
      setResult(res)
      setAllFilteredCandidates(res.data)
    } catch (err) {
      console.error('Failed to fetch candidates:', err)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    perPage,
    sort,
    debouncedSearch,
    selectedStatuses,
    selectedNationalities,
    selectedSources,
    jobOpeningId,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Sort toggle
  const handleSort = (field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Filter state helpers
  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedNationalities.length > 0 ||
    selectedSources.length > 0

  const clearAll = () => {
    setSearch('')
    setDebouncedSearch('')
    setSelectedStatuses([])
    setSelectedNationalities([])
    setSelectedSources([])
  }

  // Pagination helpers
  const totalPages = result?.totalPages ?? 1
  const total = result?.total ?? 0
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  // Filter options for dropdowns
  const statusOptions = useMemo(() => initialStatusOptions, [initialStatusOptions])
  const nationalityOptions = useMemo(() => initialNationalityOptions, [initialNationalityOptions])
  const sourceOptions = useMemo(() => initialSourceOptions, [initialSourceOptions])

  return (
    <div className="space-y-4">
      {/* Toolbar: Filters + Export */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CandidateFilters
          search={search}
          onSearchChange={setSearch}
          selectedStatuses={selectedStatuses}
          onStatusChange={setSelectedStatuses}
          statusOptions={statusOptions}
          selectedNationalities={selectedNationalities}
          onNationalityChange={setSelectedNationalities}
          nationalityOptions={nationalityOptions}
          selectedSources={selectedSources}
          onSourceChange={setSelectedSources}
          sourceOptions={sourceOptions}
          onClearAll={clearAll}
          hasActiveFilters={hasActiveFilters}
        />
        <ExportCSV
          candidates={allFilteredCandidates}
          filename={jobOpeningId ? `candidatos-promo` : 'candidatos'}
        />
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {total > 0
            ? `Mostrando ${from.toLocaleString('es-AR')}-${to.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')}`
            : 'Sin resultados'}
        </span>
        {loading && (
          <span className="text-blue-400">Cargando...</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
              {/* Expand toggle column */}
              <th className="sticky left-0 z-10 w-8 bg-gray-800/80 px-2 py-3" />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-3 py-3 ${
                    col.sticky
                      ? 'sticky left-8 z-10 bg-gray-800/80'
                      : ''
                  }`}
                  style={{ minWidth: col.minWidth }}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key as SortField)}
                      className="inline-flex items-center transition hover:text-gray-200"
                    >
                      {col.label}
                      <SortIcon field={col.key as SortField} sort={sort} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading && !result ? (
              // Skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skel-${i}`} className="animate-pulse">
                  <td className="px-2 py-3">
                    <div className="h-4 w-4 rounded bg-gray-700/40" />
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-3">
                      <div className="h-4 w-3/4 rounded bg-gray-700/40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : result && result.data.length > 0 ? (
              result.data.map((c) => {
                const isExpanded = expandedIds.has(c.id)
                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className="transition hover:bg-gray-700/20"
                    >
                      {/* Expand toggle */}
                      <td className="sticky left-0 z-10 w-8 bg-gray-900/95 px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(c.id)}
                          className="flex items-center justify-center rounded p-0.5 text-gray-500 transition hover:bg-gray-700/50 hover:text-gray-300"
                          title={isExpanded ? 'Colapsar vacantes' : 'Ver vacantes asociadas'}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronExpandRight className="h-3.5 w-3.5" />
                          }
                        </button>
                      </td>

                      {/* Name - sticky */}
                      <td className="sticky left-8 z-10 whitespace-nowrap bg-gray-900/95 px-3 py-2.5 font-medium text-gray-100">
                        {c.full_name ?? '\u2014'}
                      </td>

                      {/* Email */}
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-gray-300">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="hover:text-blue-400 hover:underline"
                            title={c.email}
                          >
                            {c.email}
                          </a>
                        ) : (
                          '\u2014'
                        )}
                      </td>

                      {/* Phone */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                        {c.phone ?? '\u2014'}
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <StatusBadge status={c.current_status} />
                      </td>

                      {/* Nationality */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-300">
                        {c.nationality ?? '\u2014'}
                      </td>

                      {/* Languages */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-400">
                        {formatLanguages(
                          c.native_language,
                          c.english_level,
                          c.german_level
                        )}
                      </td>

                      {/* Source */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                        {c.source ?? '\u2014'}
                      </td>

                      {/* Owner */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                        {c.owner ?? '\u2014'}
                      </td>

                      {/* Job Opening / Promo */}
                      <td
                        className="max-w-[150px] truncate px-3 py-2.5 text-gray-400"
                        title={c.job_opening_title ?? ''}
                      >
                        {c.job_opening_title ?? '\u2014'}
                      </td>

                      {/* Created — con etiqueta "CV:" */}
                      <td
                        className="whitespace-nowrap px-3 py-2.5 text-gray-500"
                        title={formatFullDate(c.created_time)}
                      >
                        {c.created_time ? (
                          <span>
                            <span className="text-gray-600">CV: </span>
                            {relativeDate(c.created_time)}
                          </span>
                        ) : '\u2014'}
                      </td>

                      {/* Last Activity — con etiqueta "Act:" */}
                      <td
                        className="whitespace-nowrap px-3 py-2.5 text-gray-500"
                        title={formatFullDate(c.last_activity_time)}
                      >
                        {c.last_activity_time ? (
                          <span>
                            <span className="text-gray-600">Act: </span>
                            {relativeDate(c.last_activity_time)}
                          </span>
                        ) : '\u2014'}
                      </td>

                      {/* Days in process */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-400">
                        {c.days_in_process != null
                          ? `${c.days_in_process}d`
                          : '\u2014'}
                      </td>
                    </tr>

                    {/* Expanded row — job history cards */}
                    {isExpanded && (
                      <tr className="bg-gray-900/60">
                        <td colSpan={COLUMNS.length + 1} className="border-t border-gray-700/30 py-0">
                          <JobHistoryCards candidateId={c.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-3 py-12 text-center text-gray-500"
                >
                  {hasActiveFilters ? (
                    <div>
                      <p className="mb-2">
                        No hay candidatos que coincidan con los filtros
                      </p>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-blue-400 hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  ) : (
                    'No hay candidatos'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Pagina {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="rounded p-1.5 text-gray-400 transition hover:bg-gray-700/50 hover:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Primera pagina"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded p-1.5 text-gray-400 transition hover:bg-gray-700/50 hover:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs tabular-nums text-gray-300">
              {page}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded p-1.5 text-gray-400 transition hover:bg-gray-700/50 hover:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="rounded p-1.5 text-gray-400 transition hover:bg-gray-700/50 hover:text-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Ultima pagina"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
