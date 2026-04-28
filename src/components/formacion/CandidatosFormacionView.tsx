'use client'

import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import {
  getFormacionPromos,
  getFormacionCandidates,
  getFormacionCandidateHistory,
  getFormacionCandidateNotes,
  getFormacionCandidateStageHistory,
} from '@/lib/queries/formacion'
import type {
  FormacionCandidateRow,
  FormacionCandidateHistory,
  FormacionCandidateNote,
  FormacionPromoCount,
  FormacionCandidateStageHistory,
} from '@/lib/queries/formacion'

// ---------------------------------------------------------------------------
// Status dot colour map (inline styles to avoid Tailwind purge)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  'In Training': '#3b82f6',   // blue-500
  'Hired': '#22c55e',          // green-500
  'Offer-Withdrawn': '#ef4444', // red-500
  'Expelled': '#ef4444',        // red-500
  'Stand-by': '#eab308',        // yellow-500
  'Transferred': '#a855f7',     // purple-500
  'To Place': '#f97316',        // orange-500
  'Assigned': '#06b6d4',        // cyan-500
  'Training Finished': '#6366f1', // indigo-500
}

function statusColor(status: string | null): string {
  if (!status) return '#6b7280'
  return STATUS_COLORS[status] ?? '#6b7280'
}

// Strip "Promoción " prefix for chip display
function shortPromoName(name: string): string {
  return name.replace(/^Promoci[oó]n\s+/i, 'Prom. ')
}

type TimelineItem =
  | { type: 'history'; date: string | null; entry: FormacionCandidateHistory }
  | { type: 'note'; date: string | null; note: FormacionCandidateNote }
  | { type: 'stage'; date: string | null; stage: FormacionCandidateStageHistory }

function parseDate(value: string | null): number {
  if (!value) return -Infinity
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? -Infinity : ts
}

function formatDateTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mergeTimeline(
  history: FormacionCandidateHistory[],
  notes: FormacionCandidateNote[],
  stages: FormacionCandidateStageHistory[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...history.map((entry) => ({ type: 'history' as const, date: entry.fetched_at ?? null, entry })),
    ...notes.map((note) => ({ type: 'note' as const, date: note.created_at ?? null, note })),
    ...stages.map((stage) => ({ type: 'stage' as const, date: stage.changed_at ?? null, stage })),
  ]

  items.sort((a, b) => {
    const aDate = parseDate(a.date)
    const bDate = parseDate(b.date)
    if (aDate === -Infinity && bDate === -Infinity) return 0
    if (aDate === -Infinity) return 1
    if (bDate === -Infinity) return -1
    return bDate - aDate
  })

  return items
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-surface-700/40">
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 rounded bg-surface-700/60 animate-pulse" style={{ width: j === 0 ? '140px' : '80px' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// History sub-row
// ---------------------------------------------------------------------------

function HistoryRow({ candidateId }: { candidateId: string }) {
  const [history, setHistory] = useState<FormacionCandidateHistory[]>([])
  const [notes, setNotes] = useState<FormacionCandidateNote[]>([])
  const [stages, setStages] = useState<FormacionCandidateStageHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getFormacionCandidateHistory(candidateId),
      getFormacionCandidateNotes(candidateId),
      getFormacionCandidateStageHistory(candidateId),
    ]).then(([historyData, notesData, stagesData]) => {
      if (!cancelled) {
        setHistory(historyData)
        setNotes(notesData)
        setStages(stagesData)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [candidateId])

  const timeline = mergeTimeline(history, notes, stages)

  return (
    <tr>
      <td colSpan={7} className="bg-surface-800/30 px-6 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Cargando cronologia...</span>
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Sin cronologia disponible</p>
        ) : (
          <ul className="space-y-1.5">
            {timeline.map((item, idx) => (
              item.type === 'history' ? (
                <li key={`history-${idx}`} className="rounded-lg border border-surface-700/60 bg-surface-800/60 px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-200">
                      {item.entry.job_opening_title ?? item.entry.job_opening_id ?? '-'}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {formatDateTime(item.entry.fetched_at)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {item.entry.candidate_status_in_jo && (
                      <span className="rounded-full border border-surface-600/60 bg-surface-700 px-2 py-0.5 text-[10px] text-gray-300 whitespace-nowrap">
                        {item.entry.candidate_status_in_jo}
                      </span>
                    )}
                    {item.entry.association_type && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300 whitespace-nowrap">
                        {item.entry.association_type}
                      </span>
                    )}
                  </div>
                </li>
              ) : item.type === 'stage' ? (
                <li key={`stage-${item.stage.id}`} className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.stage.from_status && (
                        <>
                          <span className="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-gray-400 whitespace-nowrap">
                            {item.stage.from_status}
                          </span>
                          <span className="text-[10px] text-gray-500">→</span>
                        </>
                      )}
                      {item.stage.to_status && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-300 whitespace-nowrap">
                          {item.stage.to_status}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {formatDateTime(item.stage.changed_at)}
                    </span>
                  </div>
                  {item.stage.job_opening_id && (
                    <p className="mt-1 text-[10px] text-gray-500 truncate">
                      {item.stage.job_opening_id}
                    </p>
                  )}
                </li>
              ) : (
                <li key={`note-${item.note.id}`} className="rounded-lg border border-surface-700/60 bg-surface-800/60 px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-gray-200">
                      {item.note.note_title ?? (item.note.is_system ? 'Cambio de estado' : 'Nota')}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {formatDateTime(item.note.created_at)}
                    </span>
                  </div>
                  {item.note.note_content && (
                    <p className="mt-1 whitespace-pre-wrap text-gray-400">{item.note.note_content}</p>
                  )}
                  {!item.note.is_system && item.note.author && (
                    <p className="mt-1 text-[10px] text-gray-500">{item.note.author}</p>
                  )}
                </li>
              )
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CandidatosFormacionViewProps {
  /** When provided the chip strip is hidden and this promo is pre-selected */
  initialPromo?: string | null
}

export default function CandidatosFormacionView({ initialPromo }: CandidatosFormacionViewProps = {}) {
  const [promos, setPromos] = useState<FormacionPromoCount[]>([])
  const [candidates, setCandidates] = useState<FormacionCandidateRow[]>([])
  const [selectedPromo, setSelectedPromo] = useState<string | null>(initialPromo ?? null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingCandidates, setLoadingCandidates] = useState(true)

  const showChips = initialPromo === undefined || initialPromo === null

  // Load promos only when chip strip is visible
  useEffect(() => {
    if (showChips) getFormacionPromos().then(setPromos)
  }, [showChips])

  // Load candidates when filter changes
  useEffect(() => {
    setLoadingCandidates(true)
    setExpandedId(null)
    getFormacionCandidates(selectedPromo).then((data) => {
      setCandidates(data)
      setLoadingCandidates(false)
    })
  }, [selectedPromo])

  const totalCount = promos.reduce((sum, p) => sum + p.count, 0)

  function handleRowClick(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-4">
      {/* Promo chip strip — only when no pre-selection from parent */}
      {showChips && (
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedPromo(null)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
              selectedPromo === null
                ? 'bg-brand-600/30 border-brand-400 text-white'
                : 'border-surface-600/60 bg-surface-800 text-gray-400 hover:border-brand-500/50 hover:text-gray-200',
            ].join(' ')}
          >
            Todas ({totalCount})
          </button>

          {promos.map((promo) => (
            <button
              key={promo.name}
              onClick={() => setSelectedPromo(promo.name)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                selectedPromo === promo.name
                  ? 'bg-brand-600/30 border-brand-400 text-white'
                  : 'border-surface-600/60 bg-surface-800 text-gray-400 hover:border-brand-500/50 hover:text-gray-200',
              ].join(' ')}
            >
              {shortPromoName(promo.name)} ({promo.count})
            </button>
          ))}
        </div>
      )}

      {/* Table card */}
      <div className="rounded-xl border border-surface-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-surface-700/60 bg-surface-800/60">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Promoción</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Agencia</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Open To</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Disponibilidad</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/40">
              {loadingCandidates ? (
                <SkeletonRows />
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 italic">
                    Sin candidatos para esta promoción
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <Fragment key={candidate.id}>
                    <tr
                      onClick={() => handleRowClick(candidate.id)}
                      className="cursor-pointer hover:bg-surface-800/60 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-200 font-medium">
                        {candidate.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: statusColor(candidate.current_status) }}
                          />
                          <span className="text-gray-300 text-xs whitespace-nowrap">
                            {candidate.current_status ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {candidate.promocion_nombre
                          ? shortPromoName(candidate.promocion_nombre)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {candidate.assigned_agency ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {candidate.gp_open_to ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {candidate.gp_availability ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {expandedId === candidate.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                    </tr>
                    {expandedId === candidate.id && (
                      <HistoryRow candidateId={candidate.id} />
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
