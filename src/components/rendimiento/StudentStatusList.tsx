'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Candidate } from '@/lib/supabase/types'
import {
  getPromoStudentList,
  type StudentListOptions,
  type StudentListResult,
} from '@/lib/queries/performance'
import StatusBadge from '@/components/candidates/StatusBadge'

type SortField =
  | 'full_name'
  | 'current_status'
  | 'coordinador'
  | 'tipo_perfil'
  | 'cliente'
  | 'days_in_process'
  | 'fecha_fin_formacion'

interface SortState {
  field: SortField
  direction: 'asc' | 'desc'
}

const COLUMNS: {
  key: SortField
  label: string
  minWidth: string
}[] = [
  { key: 'full_name', label: 'Nombre', minWidth: '180px' },
  { key: 'current_status', label: 'Estado', minWidth: '160px' },
  { key: 'coordinador', label: 'Coordinador', minWidth: '130px' },
  { key: 'tipo_perfil', label: 'Tipo Perfil', minWidth: '120px' },
  { key: 'cliente', label: 'Cliente', minWidth: '130px' },
  { key: 'days_in_process', label: 'Dias', minWidth: '70px' },
  { key: 'fecha_fin_formacion', label: 'Fin Formacion', minWidth: '120px' },
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

interface StudentStatusListProps {
  promocion: string
}

export default function StudentStatusList({ promocion }: StudentStatusListProps) {
  const [result, setResult] = useState<StudentListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortState>({ field: 'full_name', direction: 'asc' })
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)

  // Unique statuses for filter dropdown
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const options: StudentListOptions = {
        page,
        perPage: 50,
        sortBy: sort.field,
        sortOrder: sort.direction,
        statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
      }
      const res = await getPromoStudentList(promocion, options)
      setResult(res)

      // On first load, get available statuses
      if (availableStatuses.length === 0 && res.data.length > 0) {
        const statuses = new Set<string>()
        // We need all statuses, not just current page - fetch from a broader query
        const allRes = await getPromoStudentList(promocion, { perPage: 500 })
        for (const c of allRes.data) {
          if (c.current_status) statuses.add(c.current_status)
        }
        setAvailableStatuses(Array.from(statuses).sort())
      }
    } catch (err) {
      console.error('Error loading student list:', err)
    } finally {
      setLoading(false)
    }
  }, [promocion, page, sort, statusFilter, availableStatuses.length])

  useEffect(() => {
    setPage(1)
    setStatusFilter([])
    setAvailableStatuses([])
  }, [promocion])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSort = (field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  const totalPages = result?.totalPages ?? 1
  const total = result?.total ?? 0

  return (
    <div className="space-y-3">
      {/* Status filter */}
      {availableStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Filtrar:</span>
          <button
            type="button"
            onClick={() => { setStatusFilter([]); setPage(1) }}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              statusFilter.length === 0
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'
            }`}
          >
            Todos ({total})
          </button>
          {availableStatuses.slice(0, 8).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter((prev) =>
                  prev.includes(status)
                    ? prev.filter((s) => s !== status)
                    : [...prev, status]
                )
                setPage(1)
              }}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                statusFilter.includes(status)
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-700/50 text-gray-400 hover:text-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {/* Count */}
      <div className="text-xs text-gray-500">
        {total > 0 ? `${total} estudiante${total !== 1 ? 's' : ''}` : 'Sin resultados'}
        {loading && <span className="ml-2 text-blue-400">Cargando...</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full min-w-[900px] text-left text-sm">
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
            {loading && !result ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skel-${i}`} className="animate-pulse">
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-3">
                      <div className="h-4 w-3/4 rounded bg-gray-700/40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : result && result.data.length > 0 ? (
              result.data.map((c: Candidate) => (
                <tr key={c.id} className="transition hover:bg-gray-700/20">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-100">
                    {c.full_name ?? '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.current_status} />
                      {c.dropout_reason && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">
                          {c.dropout_reason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                    {c.coordinador ?? '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                    {c.tipo_perfil ?? '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                    {c.cliente ?? '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-400">
                    {c.days_in_process != null ? `${c.days_in_process}d` : '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                    {c.fecha_fin_formacion ?? '\u2014'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-12 text-center text-gray-500">
                  No hay estudiantes
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-700/50 disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="px-2 text-xs tabular-nums text-gray-300">{page}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded px-3 py-1.5 text-xs text-gray-400 transition hover:bg-gray-700/50 disabled:opacity-30"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
