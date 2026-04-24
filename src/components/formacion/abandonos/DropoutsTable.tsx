'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { DropoutRow } from '@/lib/queries/dropouts'

interface Props {
  rows: DropoutRow[]
}

const PAGE_SIZE = 25

const INTEREST_COLORS: Record<string, string> = {
  Yes: 'text-emerald-400',
  No: 'text-red-400',
  'Does not know': 'text-amber-400',
}

const TAG_CHIP_COLORS: Record<string, string> = {
  FR: 'bg-indigo-500/20 text-indigo-300',
  CP: 'bg-emerald-500/20 text-emerald-300',
  GW: 'bg-purple-500/20 text-purple-300',
}

function tagChipColor(tag: string): string {
  for (const [prefix, cls] of Object.entries(TAG_CHIP_COLORS)) {
    if (tag.startsWith(prefix)) return cls
  }
  return 'bg-gray-700/40 text-gray-400'
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

type SortKey = keyof DropoutRow

type ColDef = {
  key: SortKey
  label: string
}

const COLUMNS: ColDef[] = [
  { key: 'full_name', label: 'Nombre' },
  { key: 'promocion_nombre', label: 'Promo' },
  { key: 'dropout_date', label: 'Fecha baja' },
  { key: 'dropout_reason', label: 'Motivo' },
  { key: 'dropout_language_level', label: 'Nivel' },
  { key: 'dropout_days_of_training', label: 'Días' },
  { key: 'dropout_interest_future', label: 'Interés' },
]

export default function DropoutsTable({ rows }: Props) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('dropout_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av).toLowerCase()
      const bs = String(bv).toLowerCase()
      if (as < bs) return sortDir === 'asc' ? -1 : 1
      if (as > bs) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const from = page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, sorted.length)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer whitespace-nowrap px-3 py-2.5 text-left font-medium text-gray-400 hover:text-gray-200"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-medium text-gray-400">Etiquetas</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-400">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/20">
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-700/20">
                <td className="px-3 py-2 text-gray-200">{row.full_name ?? '—'}</td>
                <td className="px-3 py-2 text-gray-400">
                  {row.promocion_nombre
                    ? row.promocion_nombre.replace(/^Promoci[oó]n\s+/i, 'Prom. ')
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-400">
                  {formatDate(row.dropout_date)}
                </td>
                <td className="px-3 py-2 text-gray-300">{row.dropout_reason ?? '—'}</td>
                <td className="px-3 py-2 text-gray-400">{row.dropout_language_level ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums text-gray-400">
                  {row.dropout_days_of_training ?? '—'}
                </td>
                <td
                  className={`px-3 py-2 ${INTEREST_COLORS[row.dropout_interest_future ?? ''] ?? 'text-gray-400'}`}
                >
                  {row.dropout_interest_future ?? '—'}
                </td>
                {/* Tags */}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tagChipColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                    {row.tags.length > 3 && (
                      <span className="rounded-full bg-gray-700/40 px-1.5 py-0.5 text-[10px] text-gray-500">
                        +{row.tags.length - 3} más
                      </span>
                    )}
                  </div>
                </td>
                {/* Notas */}
                <td className="px-3 py-2">
                  {row.dropout_notes ? (
                    <span
                      className="cursor-default text-gray-500"
                      title={row.dropout_notes}
                    >
                      {row.dropout_notes.length > 40
                        ? row.dropout_notes.slice(0, 40) + '…'
                        : row.dropout_notes}
                    </span>
                  ) : (
                    <span className="text-gray-700">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-700/50 px-4 py-2.5">
        <span className="text-xs text-gray-500">
          {sorted.length > 0 ? `Mostrando ${from}–${to} de ${sorted.length}` : 'Sin resultados'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-gray-700/50 px-2.5 py-1 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-200 disabled:opacity-30"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded border border-gray-700/50 px-2.5 py-1 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-200 disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
