'use client'

import { useEffect, useState } from 'react'
import { getVacancyRecruitmentStats, type VacancyRecruitmentStats } from '@/lib/queries/atraccion'

const PINNED_STATUSES = [
  'Approved by client',
  'Hired',
  'Interview in Progress',
  'Interview-Scheduled',
  'First Call',
  'Second Call',
  'Check Interest',
  'No Answer',
  'On Hold',
  'Rejected',
]

function sortStatuses(statuses: string[]): string[] {
  const pinned = PINNED_STATUSES.filter((s) => statuses.includes(s))
  const rest = statuses.filter((s) => !PINNED_STATUSES.includes(s)).sort()
  return [...pinned, ...rest]
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('hired') || s.includes('approved by client')) return 'text-emerald-400'
  if (s.includes('approved') || s.includes('interview')) return 'text-blue-400'
  if (s.includes('first call') || s.includes('second call') || s.includes('check')) return 'text-violet-400'
  if (s.includes('rejected') || s.includes('no answer')) return 'text-red-400'
  if (s.includes('on hold')) return 'text-yellow-400'
  return 'text-gray-300'
}

function vacancyStatusBadge(status: string | null) {
  if (!status) return null
  const s = status.toLowerCase()
  if (s.includes('in-progress') || s === 'open') {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Activa</span>
  }
  if (s.includes('espera') || s.includes('aprobación')) {
    return <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">En espera</span>
  }
  return <span className="rounded-full bg-gray-600/40 px-2 py-0.5 text-[10px] font-medium text-gray-400">{status}</span>
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function VacancyRecruitmentTable() {
  const [data, setData] = useState<VacancyRecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getVacancyRecruitmentStats().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="h-4 w-64 animate-pulse rounded bg-gray-700 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-700/50" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
        <p className="text-sm text-gray-400">Sin vacantes activas con etiqueta "Proceso atracción actual"</p>
        <p className="mt-1 text-xs text-gray-500">
          Ejecutá el sync de Zoho para actualizar las etiquetas
        </p>
      </div>
    )
  }

  const sortedStatuses = sortStatuses(data.statuses)
  const filtered = search.trim()
    ? data.rows.filter((r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.client_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : data.rows

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-700/50">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">
            Vacantes activas — candidatos por estado
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {data.rows.length} vacante{data.rows.length !== 1 ? 's' : ''} con etiqueta "Proceso atracción actual"
            {data.statuses.length > 0 && ` · ${data.statuses.length} estados`}
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar vacante…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-44"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="sticky left-0 z-10 bg-gray-800/95 px-4 py-3 text-left font-medium text-gray-400 whitespace-nowrap min-w-[220px]">
                Vacante
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-400 whitespace-nowrap">
                Estado
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                Apertura
              </th>
              {sortedStatuses.map((s) => (
                <th key={s} className="px-3 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                  {s}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-gray-300 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-gray-700/20 transition-colors">
                {/* Vacancy name */}
                <td className="sticky left-0 z-10 bg-gray-800/95 px-4 py-3">
                  <div className="font-medium text-gray-200 leading-snug">{row.title}</div>
                </td>

                {/* Vacancy status badge */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {vacancyStatusBadge(row.status)}
                </td>

                {/* Date opened */}
                <td className="px-3 py-3 text-right text-gray-400 whitespace-nowrap">
                  {formatDate(row.date_opened)}
                </td>

                {/* Candidate status counts */}
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
                  {row.total || row.total_candidates}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totals footer */}
          {filtered.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-600/50 bg-gray-700/20">
                <td className="sticky left-0 bg-gray-700/30 px-4 py-3 font-semibold text-gray-300">
                  TOTAL
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
                  {filtered.reduce((s, r) => s + (r.total || r.total_candidates), 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
