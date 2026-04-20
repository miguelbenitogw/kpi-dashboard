'use client'

import { useEffect, useState } from 'react'
import { getPromoRecruitmentStats, type PromoRecruitmentStats } from '@/lib/queries/atraccion'

// Status color mapping for quick visual scanning
function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('hired') || s.includes('contrat')) return 'text-emerald-400'
  if (s.includes('approved') || s.includes('aprobad')) return 'text-blue-400'
  if (s.includes('interview') || s.includes('entrevista')) return 'text-violet-400'
  if (s.includes('rejected') || s.includes('rechaz')) return 'text-red-400'
  if (s.includes('on hold') || s.includes('espera')) return 'text-yellow-400'
  return 'text-gray-300'
}

function progressPct(aceptados: number | null, objetivo: number | null): number {
  if (!objetivo || objetivo === 0) return 0
  return Math.min(100, Math.round(((aceptados ?? 0) / objetivo) * 100))
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

// Statuses to pin first in the column order (they appear before alphabetical remainder)
const PINNED_STATUSES = [
  'Approved by client',
  'Hired',
  'In Training',
  'Interview in Progress',
  'First Call',
  'Second Call',
  'Check Interest',
  'No Answer',
  'Rejected',
  'On Hold',
]

function sortStatuses(statuses: string[]): string[] {
  const pinned = PINNED_STATUSES.filter((s) => statuses.includes(s))
  const rest = statuses.filter((s) => !PINNED_STATUSES.includes(s)).sort()
  return [...pinned, ...rest]
}

export default function PromoRecruitmentTable() {
  const [data, setData] = useState<PromoRecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPromoRecruitmentStats().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="h-4 w-48 animate-pulse rounded bg-gray-700 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-700/50" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
        <p className="text-sm text-gray-400">Sin datos de promociones activas</p>
        <p className="mt-1 text-xs text-gray-500">
          Ejecutá el sync del Excel madre para poblar los datos
        </p>
      </div>
    )
  }

  const sortedStatuses = sortStatuses(data.statuses)

  const filtered = search.trim()
    ? data.rows.filter((r) =>
        r.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (r.coordinador ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : data.rows

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-700/50">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">
            Promociones activas — candidatos por estado
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {data.rows.length} promoc{data.rows.length === 1 ? 'ión' : 'iones'} ·{' '}
            {data.statuses.length} estado{data.statuses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar promo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-40"
        />
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              {/* Sticky promo name column */}
              <th className="sticky left-0 z-10 bg-gray-800/95 px-4 py-3 text-left font-medium text-gray-400 whitespace-nowrap min-w-[180px]">
                Promoción
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                Objetivo
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                % logro
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                Fecha fin
              </th>
              {/* Dynamic status columns */}
              {sortedStatuses.map((s) => (
                <th
                  key={s}
                  className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap"
                >
                  {s}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-gray-300 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {filtered.map((row) => {
              const pct = progressPct(row.aceptados, row.objetivo)
              return (
                <tr
                  key={row.nombre}
                  className="hover:bg-gray-700/20 transition-colors"
                >
                  {/* Promo name */}
                  <td className="sticky left-0 z-10 bg-gray-800/95 px-4 py-3 font-medium text-gray-200 whitespace-nowrap">
                    <div>{row.nombre}</div>
                    {row.coordinador && (
                      <div className="text-gray-500 font-normal">{row.coordinador}</div>
                    )}
                  </td>

                  {/* Objetivo */}
                  <td className="px-3 py-3 text-right text-gray-300 tabular-nums">
                    {row.objetivo ?? '—'}
                  </td>

                  {/* % logro — mini progress bar */}
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 rounded-full bg-gray-700 h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={`tabular-nums ${pct >= 100 ? 'text-emerald-400' : pct >= 80 ? 'text-blue-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </td>

                  {/* Fecha fin */}
                  <td className="px-3 py-3 text-right text-gray-400 whitespace-nowrap">
                    {formatDate(row.fecha_fin)}
                  </td>

                  {/* Status counts */}
                  {sortedStatuses.map((s) => {
                    const count = row.byStatus[s] ?? 0
                    return (
                      <td key={s} className="px-3 py-3 text-right tabular-nums">
                        <span className={count > 0 ? statusColor(s) : 'text-gray-600'}>
                          {count > 0 ? count : '—'}
                        </span>
                      </td>
                    )
                  })}

                  {/* Total */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-200 tabular-nums">
                    {row.total}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Totals footer */}
          {filtered.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-600/50 bg-gray-700/20">
                <td className="sticky left-0 bg-gray-700/30 px-4 py-3 font-semibold text-gray-300">
                  TOTAL
                </td>
                <td className="px-3 py-3 text-right font-semibold text-gray-300 tabular-nums">
                  {filtered.reduce((s, r) => s + (r.objetivo ?? 0), 0) || '—'}
                </td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3" />
                {sortedStatuses.map((s) => {
                  const total = filtered.reduce((sum, r) => sum + (r.byStatus[s] ?? 0), 0)
                  return (
                    <td key={s} className="px-3 py-3 text-right font-semibold tabular-nums">
                      <span className={total > 0 ? statusColor(s) : 'text-gray-600'}>
                        {total > 0 ? total : '—'}
                      </span>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                  {filtered.reduce((s, r) => s + r.total, 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
