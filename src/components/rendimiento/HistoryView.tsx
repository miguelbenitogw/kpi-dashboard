'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getPromoHistoryOverview,
  getCandidateHistory,
  getCandidateNotes,
  type CandidateWithHistory,
  type CandidateHistoryRecord,
  type CandidateNote,
} from '@/lib/queries/performance'
import StatusBadge from '@/components/candidates/StatusBadge'

// --- Timeline types ---

type TimelineItem =
  | { type: 'job'; date: string | null; record: CandidateHistoryRecord }
  | { type: 'note'; date: string | null; note: CandidateNote }

function parseDate(d: string | null): number {
  if (!d) return -Infinity
  const ts = Date.parse(d)
  return isNaN(ts) ? -Infinity : ts
}

function formatDateTime(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mergeTimeline(
  history: CandidateHistoryRecord[],
  notes: CandidateNote[]
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...history.map((r): TimelineItem => ({ type: 'job', date: r.associated_at ?? null, record: r })),
    ...notes.map((n): TimelineItem => ({ type: 'note', date: n.created_at ?? null, note: n })),
  ]
  // Sort descending: items with dates first (newest first), then null-date items last
  items.sort((a, b) => {
    const da = parseDate(a.date)
    const db = parseDate(b.date)
    if (da === -Infinity && db === -Infinity) return 0
    if (da === -Infinity) return 1
    if (db === -Infinity) return -1
    return db - da
  })
  return items
}

// --- Sub-components ---

function TimelineStep({ record }: { record: CandidateHistoryRecord }) {
  const isAtraccion = record.association_type === 'atraccion'
  const dotColor = isAtraccion ? 'bg-blue-400' : 'bg-emerald-400'
  const lineColor = isAtraccion ? 'bg-blue-400/30' : 'bg-emerald-400/30'
  const labelColor = isAtraccion ? 'text-blue-400' : 'text-emerald-400'
  const badgeBg = isAtraccion ? 'bg-blue-500/15' : 'bg-emerald-500/15'

  return (
    <div className="relative flex items-start gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
        <div className={`w-0.5 flex-1 ${lineColor}`} />
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-200" title={record.job_opening_title ?? ''}>
            {record.job_opening_title ?? 'Sin titulo'}
          </p>
          {record.associated_at && (
            <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
              {new Date(record.associated_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
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

function NoteStep({ note }: { note: CandidateNote }) {
  const [expanded, setExpanded] = useState(false)
  const isSystem = note.is_system
  const dotColor = isSystem ? 'bg-gray-500' : 'bg-purple-400'
  const lineColor = isSystem ? 'bg-gray-500/30' : 'bg-purple-400/30'

  return (
    <div className="relative flex items-start gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
        <div className={`w-0.5 flex-1 ${lineColor}`} />
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {isSystem ? (
              /* gear icon */
              <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ) : (
              /* pencil icon */
              <svg className="h-3.5 w-3.5 shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
            {isSystem ? (
              <span className="text-xs text-gray-400">
                Estado cambiado
                {note.note_title && (
                  <span className="text-gray-500"> · {note.note_title}</span>
                )}
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-200">
                {note.note_title ?? 'Nota sin título'}
              </span>
            )}
          </div>
          {note.created_at && (
            <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
              {formatDateTime(note.created_at)}
            </span>
          )}
        </div>

        {isSystem ? (
          note.note_content && (
            <p className="mt-1 text-xs italic text-gray-500">{note.note_content}</p>
          )
        ) : (
          note.note_content && (
            <div className="mt-1">
              <p
                className={`text-xs leading-relaxed text-gray-400 ${expanded ? '' : 'line-clamp-3'}`}
              >
                {note.note_content}
              </p>
              {note.note_content.length > 120 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p) }}
                  className="mt-1 text-[10px] text-purple-400 hover:text-purple-300 transition"
                >
                  {expanded ? 'Ver menos' : 'Ver más'}
                </button>
              )}
            </div>
          )
        )}

        {!isSystem && note.author && (
          <p className="mt-1 text-[10px] text-gray-600">{note.author}</p>
        )}
      </div>
    </div>
  )
}

function IntegratedTimeline({
  history,
  notes,
}: {
  history: CandidateHistoryRecord[]
  notes: CandidateNote[]
}) {
  const items = useMemo(() => mergeTimeline(history, notes), [history, notes])

  if (items.length === 0) {
    return <p className="py-3 text-xs text-gray-500">Sin cronología disponible</p>
  }

  return (
    <div className="py-2">
      {items.map((item, idx) =>
        item.type === 'job' ? (
          <TimelineStep key={`job-${item.record.id}-${idx}`} record={item.record} />
        ) : (
          <NoteStep key={`note-${item.note.id}-${idx}`} note={item.note} />
        )
      )}
    </div>
  )
}

function ExpandableRow({ candidate }: { candidate: CandidateWithHistory }) {
  const [expanded, setExpanded] = useState(false)
  const [loadedHistory, setLoadedHistory] = useState<CandidateHistoryRecord[] | null>(null)
  const [loadedNotes, setLoadedNotes] = useState<CandidateNote[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && loadedHistory === null) {
      setDetailLoading(true)
      setDetailError(null)
      Promise.all([
        getCandidateHistory(candidate.candidate_id),
        getCandidateNotes(candidate.candidate_id),
      ])
        .then(([hist, notes]) => {
          setLoadedHistory(hist)
          setLoadedNotes(notes)
        })
        .catch((err) => {
          console.error('Error loading candidate detail:', err)
          setDetailError('Error al cargar los datos')
        })
        .finally(() => setDetailLoading(false))
    }
  }

  return (
    <>
      <tr
        className="cursor-pointer transition hover:bg-gray-700/20"
        onClick={handleExpand}
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
            {detailLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-gray-500">
                <svg
                  className="h-4 w-4 animate-spin text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando cronología...
              </div>
            ) : detailError ? (
              <p className="py-3 text-xs text-red-400">{detailError}</p>
            ) : (
              <IntegratedTimeline
                history={loadedHistory ?? []}
                notes={loadedNotes ?? []}
              />
            )}
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
