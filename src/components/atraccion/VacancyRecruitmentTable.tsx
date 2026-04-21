'use client'

import { useCallback, useEffect, useState } from 'react'
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

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('hired') || s.includes('approved by client')) return 'text-emerald-400'
  if (s.includes('approved') || s.includes('interview')) return 'text-blue-400'
  if (s.includes('first call') || s.includes('second call') || s.includes('check')) return 'text-violet-400'
  if (s.includes('rejected') || s.includes('no answer')) return 'text-red-400'
  if (s.includes('on hold')) return 'text-yellow-400'
  return 'text-gray-300'
}

function formatSyncDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

export default function VacancyRecruitmentTable() {
  const [data, setData] = useState<VacancyRecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    getVacancyRecruitmentStats().then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSync = useCallback(async () => {
    setSyncState('syncing')
    setSyncError(null)

    try {
      const res = await fetch('/api/admin/sync-vacancy-stats', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_SYNC_API_KEY ?? '',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }

      setSyncState('success')

      // Show success for 3s then reload data
      setTimeout(() => {
        setSyncState('idle')
        loadData()
      }, 3000)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err))
      setSyncState('error')
    }
  }, [loadData])

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

  // Always show pinned status columns regardless of data — they show "—" when empty
  const cols = PINNED_STATUSES
  const filtered = search.trim()
    ? data.rows.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
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
            {data.rows.length} vacante{data.rows.length !== 1 ? 's' : ''} · {
              data.rows.reduce((s, r) => s + r.total_candidates, 0).toLocaleString()
            } candidatos en total
            {data.lastSynced && (
              <> · <span className="text-gray-600">Última sync: {formatSyncDate(data.lastSynced)}</span></>
            )}
          </p>

          {syncState === 'error' && syncError && (
            <p className="mt-1 text-xs text-red-400">{syncError}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              syncState === 'syncing'
                ? 'cursor-not-allowed bg-blue-700/50 text-blue-300'
                : syncState === 'success'
                  ? 'bg-emerald-700/60 text-emerald-300'
                  : 'bg-blue-600 text-white hover:bg-blue-500',
            ].join(' ')}
          >
            {syncState === 'syncing' && (
              <svg
                className="h-3 w-3 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            )}
            {syncState === 'success' && (
              <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            )}
            {syncState === 'syncing'
              ? 'Sincronizando…'
              : syncState === 'success'
                ? 'Listo'
                : 'Sincronizar'}
          </button>

          {/* Search */}
          <input
            type="text"
            placeholder="Buscar vacante…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 w-44"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="sticky left-0 z-10 bg-gray-800/95 px-4 py-3 text-left font-medium text-gray-400 whitespace-nowrap min-w-[200px]">
                Vacante
              </th>
              {cols.map((s) => (
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
                <td className="sticky left-0 z-10 bg-gray-800/95 px-4 py-3">
                  <div className="font-medium text-gray-200 leading-snug">{row.title}</div>
                </td>

                {cols.map((s) => {
                  const count = row.byStatus[s] ?? 0
                  return (
                    <td key={s} className="px-3 py-3 text-right tabular-nums">
                      <span className={count > 0 ? statusColor(s) : 'text-gray-600'}>
                        {count > 0 ? count : '—'}
                      </span>
                    </td>
                  )
                })}

                <td className="px-4 py-3 text-right font-semibold text-gray-200 tabular-nums">
                  {row.total_candidates}
                </td>
              </tr>
            ))}
          </tbody>

          {filtered.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-600/50 bg-gray-700/20">
                <td className="sticky left-0 bg-gray-700/30 px-4 py-3 font-semibold text-gray-300">
                  TOTAL
                </td>
                {cols.map((s) => {
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
                  {filtered.reduce((s, r) => s + r.total_candidates, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
