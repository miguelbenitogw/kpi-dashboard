'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import {
  getVacancyRecruitmentStats,
  getVacancyTagCounts,
  type VacancyRecruitmentStats,
  type VacancyTagCount,
} from '@/lib/queries/atraccion'
import { tagChipStyle } from '@/lib/utils/tags'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'
import { type TipoProfesional, deriveProfesionTipo, PROFESION_LABELS, PROFESION_COLORS } from '@/lib/utils/vacancy-profession'

const ALL_STATUSES = [
  'Associated', 'Waiting for Evaluation', 'Rejected', 'First Call', 'Not Valid',
  'On Hold', 'No Answer', 'Next Project', 'Approved by client', 'Check Interest',
  'Second Call', 'Offer-Declined', 'Interview-Scheduled', 'Rejected by client',
  'Interview to be Scheduled', 'No Show', 'Waiting for Consensus', 'Offer-Withdrawn',
  'In Training out of GW', 'Expelled', 'To Place', 'Hired', 'Interview in Progress',
]

const DEFAULT_COLS = [
  'Approved by client', 'Hired', 'Interview in Progress', 'Interview-Scheduled',
  'First Call', 'Second Call', 'Check Interest', 'No Answer', 'On Hold', 'Rejected',
]

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('hired') || s.includes('approved by client')) return 'text-emerald-400'
  if (s.includes('approved') || s.includes('interview')) return 'text-blue-400'
  if (s.includes('first call') || s.includes('second call') || s.includes('check')) return 'text-violet-400'
  if (s.includes('rejected') || s.includes('no answer')) return 'text-red-400'
  if (s.includes('on hold')) return 'text-yellow-400'
  if (s.includes('associated')) return 'text-gray-300'
  if (s.includes('waiting for evaluation')) return 'text-violet-300'
  if (s.includes('not valid')) return 'text-gray-500'
  if (s.includes('next project')) return 'text-cyan-400'
  if (s.includes('offer-declined') || s.includes('offer declined')) return 'text-orange-400'
  if (s.includes('rejected by client')) return 'text-red-500'
  if (s.includes('interview to be scheduled')) return 'text-blue-300'
  if (s.includes('no show')) return 'text-rose-400'
  if (s.includes('waiting for consensus')) return 'text-violet-400'
  if (s.includes('offer-withdrawn') || s.includes('offer withdrawn')) return 'text-orange-500'
  if (s.includes('in training')) return 'text-emerald-300'
  if (s.includes('expelled')) return 'text-red-600'
  if (s.includes('to place')) return 'text-teal-400'
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

// ---------------------------------------------------------------------------
// Tag chips — lazy loaded per vacancy, grouped by category
// ---------------------------------------------------------------------------

const TAG_GROUPS: { label: string; prefix: string[] }[] = [
  { label: 'Fuente',     prefix: ['FR'] },
  { label: 'Cómo llegó', prefix: ['CP'] },
  { label: 'Recruiter',  prefix: ['GW'] },
  { label: 'Modalidad',  prefix: ['ONL', 'SEMI', 'PRESEN', 'ONLINE', 'PRESENCIAL'] },
]

const TOP_PER_GROUP = 5
const TOP_OTHER     = 6

function groupTags(tags: VacancyTagCount[]) {
  const used = new Set<string>()
  const groups: { label: string; items: VacancyTagCount[] }[] = []

  for (const g of TAG_GROUPS) {
    const items = tags
      .filter(t => g.prefix.some(p => t.tag.toUpperCase().startsWith(p)))
      .slice(0, TOP_PER_GROUP)
    if (items.length > 0) {
      items.forEach(t => used.add(t.tag))
      groups.push({ label: g.label, items })
    }
  }

  const others = tags.filter(t => !used.has(t.tag)).slice(0, TOP_OTHER)
  if (others.length > 0) groups.push({ label: 'Otras', items: others })

  return groups
}

function VacancyTagRow({
  vacancyId,
  vacancyTitle,
  colSpan,
}: {
  vacancyId: string
  vacancyTitle: string
  colSpan: number
}) {
  const [tags, setTags] = useState<VacancyTagCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getVacancyTagCounts(vacancyId).then((data) => {
      if (!cancelled) { setTags(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [vacancyId])

  const country = getVacancyCountry(vacancyTitle)
  const countryColors = COUNTRY_COLORS[country]
  const profesion = deriveProfesionTipo(vacancyTitle)
  const profesionColors = PROFESION_COLORS[profesion]

  const grouped = groupTags(tags)

  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          background: '#f9f7f4',
          borderBottom: '1px solid #e7e2d8',
          padding: '10px 16px',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {[80, 60, 96, 70, 56].map((w, i) => (
              <div key={i} style={{ height: 20, width: w, borderRadius: 99, background: '#e7e2d8', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'nowrap', overflowX: 'auto' }}>

            {/* Metadata pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vacante</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ background: countryColors.bg, color: countryColors.text, border: `1px solid ${countryColors.border}`, borderRadius: 99, fontSize: 10, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                  {country}
                </span>
                <span style={{ background: profesionColors.bg, color: profesionColors.text, border: `1px solid ${profesionColors.border}`, borderRadius: 99, fontSize: 10, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                  {PROFESION_LABELS[profesion]}
                </span>
              </div>
            </div>

            {/* Divider */}
            {grouped.length > 0 && (
              <div style={{ width: 1, background: '#e7e2d8', alignSelf: 'stretch', flexShrink: 0, margin: '0 2px' }} />
            )}

            {/* Tag groups */}
            {grouped.length > 0 ? grouped.map(group => (
              <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {group.label}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 240 }}>
                  {group.items.map(({ tag, count }) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${tagChipStyle(tag)}`}
                    >
                      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tag}
                      </span>
                      <span style={{ fontWeight: 700, opacity: 0.75, flexShrink: 0 }}>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )) : (
              <span style={{ fontSize: 12, color: '#a8a29e', fontStyle: 'italic', alignSelf: 'center' }}>
                Sin etiquetas de candidatos
              </span>
            )}

            {/* Total tags hint */}
            {tags.length > 0 && (
              <span style={{ fontSize: 10, color: '#c8c4bb', alignSelf: 'flex-end', flexShrink: 0, paddingBottom: 2 }}>
                {tags.length} etiquetas en total
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function VacancyRecruitmentTable({
  profesionFilter = 'todos',
}: {
  profesionFilter?: TipoProfesional | 'todos'
}) {
  const [data, setData] = useState<VacancyRecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vacancy-table-cols')
        if (saved) return JSON.parse(saved) as string[]
      } catch {}
    }
    return DEFAULT_COLS
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    localStorage.setItem('vacancy-table-cols', JSON.stringify(visibleCols))
  }, [visibleCols])

  useEffect(() => {
    if (!showColMenu) return
    function handleMouseDown(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [showColMenu])

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
        throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`)
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

  const toggleCol = (status: string) => {
    setVisibleCols((prev) =>
      prev.includes(status) ? prev.filter((c) => c !== status) : [...prev, status]
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <div className="h-4 w-64 animate-pulse rounded bg-gray-700 mb-3" />
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
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
        <p className="text-sm text-gray-400">Sin vacantes activas con etiqueta "Proceso atracción actual"</p>
        <p className="mt-1 text-xs text-gray-500">
          Ejecutá el sync de Zoho para actualizar las etiquetas
        </p>
      </div>
    )
  }

  // Use visible columns for the table
  const cols = visibleCols
  const filtered = data.rows
    .filter((r) =>
      profesionFilter === 'todos' || deriveProfesionTipo(r.title) === profesionFilter,
    )
    .filter((r) =>
      !search.trim() || r.title.toLowerCase().includes(search.toLowerCase()),
    )

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-700/50">
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

          {/* Columns dropdown */}
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Columnas
              {visibleCols.length !== DEFAULT_COLS.length && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
              )}
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-20 rounded-xl border border-gray-700/50 bg-gray-800 shadow-xl w-72 p-3">
                {/* Dropdown header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-300">Columnas visibles</span>
                  <button
                    onClick={() => setShowColMenu(false)}
                    className="text-gray-500 hover:text-gray-300 text-sm leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Quick actions */}
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => setVisibleCols(DEFAULT_COLS)}
                    className="flex-1 rounded-lg border border-gray-600/50 bg-gray-700/50 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
                  >
                    Predeterminado
                  </button>
                  <button
                    onClick={() => setVisibleCols([...ALL_STATUSES])}
                    className="flex-1 rounded-lg border border-gray-600/50 bg-gray-700/50 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
                  >
                    Todas
                  </button>
                </div>

                <div className="border-t border-gray-700/50 my-2" />

                {/* Status list */}
                <div className="max-h-72 overflow-y-auto space-y-0.5">
                  {ALL_STATUSES.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(status)}
                        onChange={() => toggleCol(status)}
                        className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-700 accent-blue-500 cursor-pointer"
                      />
                      <span className={`text-xs ${statusColor(status)}`}>{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-auto max-h-[560px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              {/* Top-left corner — sticky both axes, highest z-index */}
              <th className="sticky top-0 left-0 z-30 bg-gray-800 px-3 py-2 text-left font-medium text-gray-400 whitespace-nowrap min-w-[200px]">
                Vacante
              </th>
              {cols.map((s) => (
                <th key={s} className="sticky top-0 z-20 bg-gray-800 px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">
                  {s}
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-gray-800 px-3 py-2 text-right font-semibold text-gray-300 whitespace-nowrap">
                Total
              </th>
              <th className="sticky top-0 z-20 bg-gray-800 px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap">
                % Éxito
              </th>
              <th className="sticky top-0 z-20 bg-gray-800 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {filtered.map((row) => {
              const isExpanded = expandedId === row.id
              return (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    className="cursor-pointer hover:bg-gray-700/20 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-gray-800/95 px-3 py-2">
                      <div className="font-medium text-gray-200 leading-snug">
                        {row.title}
                        {(() => {
                          const country = getVacancyCountry(row.title)
                          const colors = COUNTRY_COLORS[country]
                          return (
                            <span
                              style={{
                                background: colors.bg,
                                color: colors.text,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 99,
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1px 6px',
                                marginLeft: 6,
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}
                            >
                              {country}
                            </span>
                          )
                        })()}
                      </div>
                    </td>

                    {cols.map((s) => {
                      const count = row.byStatus[s] ?? 0
                      return (
                        <td key={s} className="px-3 py-2 text-right tabular-nums">
                          <span className={count > 0 ? statusColor(s) : 'text-gray-600'}>
                            {count > 0 ? count : '—'}
                          </span>
                        </td>
                      )
                    })}

                    <td className="px-3 py-2 text-right font-semibold text-gray-200 tabular-nums">
                      {row.total_candidates}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(() => {
                        if (row.total_candidates === 0) return <span className="text-gray-600">—</span>
                        const success = row.hired_count + (row.byStatus['Approved by client'] ?? 0)
                        const rate = Math.round((success / row.total_candidates) * 1000) / 10
                        const color = rate >= 15 ? '#16a34a' : rate >= 8 ? '#d97706' : '#9ca3af'
                        return (
                          <span style={{ color, fontWeight: rate >= 8 ? 600 : 400 }}>
                            {rate.toLocaleString('es-AR')}%
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-2 py-2 text-gray-500">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <VacancyTagRow
                      vacancyId={row.id}
                      vacancyTitle={row.title}
                      colSpan={cols.length + 4}
                    />
                  )}
                </Fragment>
              )
            })}
          </tbody>

          {filtered.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-600/50 bg-gray-700/20">
                <td className="sticky left-0 bg-gray-700/30 px-3 py-2 font-semibold text-gray-300">
                  TOTAL
                </td>
                {cols.map((s) => {
                  const total = filtered.reduce((sum, r) => sum + (r.byStatus[s] ?? 0), 0)
                  return (
                    <td key={s} className="px-3 py-2 text-right font-semibold tabular-nums">
                      <span className={total > 0 ? statusColor(s) : 'text-gray-600'}>
                        {total > 0 ? total : '—'}
                      </span>
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right font-semibold text-white tabular-nums">
                  {filtered.reduce((s, r) => s + r.total_candidates, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {(() => {
                    const totalCands = filtered.reduce((s, r) => s + r.total_candidates, 0)
                    if (totalCands === 0) return <span className="text-gray-600">—</span>
                    const totalSuccess = filtered.reduce(
                      (s, r) => s + r.hired_count + (r.byStatus['Approved by client'] ?? 0),
                      0,
                    )
                    const rate = Math.round((totalSuccess / totalCands) * 1000) / 10
                    const color = rate >= 15 ? '#16a34a' : rate >= 8 ? '#d97706' : '#9ca3af'
                    return <span style={{ color }}>{rate.toLocaleString('es-AR')}%</span>
                  })()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
