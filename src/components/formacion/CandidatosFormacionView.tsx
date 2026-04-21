'use client'

import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import {
  getFormacionPromos,
  getFormacionCandidates,
  getFormacionCandidateHistory,
} from '@/lib/queries/formacion'
import type {
  FormacionCandidateRow,
  FormacionCandidateHistory,
  FormacionPromoCount,
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getFormacionCandidateHistory(candidateId).then((data) => {
      if (!cancelled) {
        setHistory(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [candidateId])

  return (
    <tr>
      <td colSpan={7} className="bg-surface-800/30 px-6 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Cargando historial…</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Sin historial de formación</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((entry, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs">
                <span className="text-gray-300 truncate max-w-xs">
                  {entry.job_opening_title ?? '—'}
                </span>
                {entry.candidate_status_in_jo && (
                  <span className="rounded-full border border-surface-600/60 bg-surface-700 px-2 py-0.5 text-[10px] text-gray-300 whitespace-nowrap">
                    {entry.candidate_status_in_jo}
                  </span>
                )}
              </li>
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

export default function CandidatosFormacionView() {
  const [promos, setPromos] = useState<FormacionPromoCount[]>([])
  const [candidates, setCandidates] = useState<FormacionCandidateRow[]>([])
  const [selectedPromo, setSelectedPromo] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingCandidates, setLoadingCandidates] = useState(true)

  // Load promos once on mount
  useEffect(() => {
    getFormacionPromos().then(setPromos)
  }, [])

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
      {/* Promo chip strip */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {/* "Todas" chip */}
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
