'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getPromoDropouts,
  getPromoStudentList,
  type DropoutCandidate,
} from '@/lib/queries/performance'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const REASON_COLORS: Record<string, string> = {
  'Offer Withdrawn': '#F59E0B',
  'Offer-Withdrawn': '#F59E0B',
  'Offer Declined': '#FB923C',
  'Offer-Declined': '#FB923C',
  'Expelled': '#EF4444',
  'Transferred': '#8B5CF6',
  'Done': '#10B981',
  'Rejected': '#DC2626',
  'Not Valid': '#B91C1C',
  'Un-Qualified': '#991B1B',
  'Personal reasons': '#8B5CF6',
  'Health issues': '#EC4899',
  'Other': '#6B7280',
  'Next Project': '#06B6D4',
}

const STATUS_COLORS: Record<string, string> = {
  'Offer Withdrawn': '#F59E0B',
  'Offer-Withdrawn': '#F59E0B',
  'Offer Declined': '#FB923C',
  'Offer-Declined': '#FB923C',
  'Expelled': '#EF4444',
  'Transferred': '#8B5CF6',
  'Done': '#10B981',
  'Next Project': '#06B6D4',
}

const MODALITY_STYLES: Record<string, { bg: string; text: string }> = {
  'Online': { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  'Presencial': { bg: 'rgba(16,185,129,0.15)', text: '#34D399' },
  'Semi': { bg: 'rgba(245,158,11,0.15)', text: '#FBBF24' },
}

function getReasonColor(reason: string): string {
  return REASON_COLORS[reason] ?? '#6B7280'
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6B7280'
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DropoutAnalysisProps {
  promocion: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DropoutAnalysis({ promocion }: DropoutAnalysisProps) {
  const [dropouts, setDropouts] = useState<DropoutCandidate[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      getPromoDropouts(promocion),
      getPromoStudentList(promocion, { perPage: 1 }),
    ])
      .then(([dropoutData, studentsResult]) => {
        if (cancelled) return
        setDropouts(dropoutData)
        setTotalStudents(studentsResult.total)
      })
      .catch((err) => {
        if (!cancelled) console.error('Error loading dropout data:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [promocion])

  // Reason distribution for chart
  const reasonDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of dropouts) {
      const reason = d.dropout_reason ?? 'Sin motivo'
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  }, [dropouts])

  // Status (sheet_status / current_status) distribution
  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of dropouts) {
      const status = d.current_status ?? 'Unknown'
      counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)
  }, [dropouts])

  // Language level distribution
  const langDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of dropouts) {
      if (d.dropout_language_level) {
        counts.set(d.dropout_language_level, (counts.get(d.dropout_language_level) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level.localeCompare(b.level))
  }, [dropouts])

  const hasLangData = langDistribution.length > 0

  // Avg days to dropout
  const avgDays = useMemo(() => {
    const values = dropouts
      .map((d) => d.dropout_days_of_training)
      .filter((v): v is number => v != null)
    if (values.length === 0) return null
    return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  }, [dropouts])

  const topReason = reasonDistribution[0]?.reason ?? 'N/A'
  const dropoutRate = totalStudents > 0
    ? Math.round((dropouts.length / totalStudents) * 100)
    : 0

  // Language level pill colours (cycle through a small palette)
  const LANG_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#FB923C']

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-800/50" />
          ))}
        </div>
        <div className="h-48 rounded-xl bg-gray-800/50" />
        <div className="h-40 rounded-xl bg-gray-800/50" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* Summary cards — 4 cards                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <p className="text-xs text-gray-500">Total bajas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-400">
            {dropouts.length}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <p className="text-xs text-gray-500">Tasa de abandono</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-orange-400">
            {dropoutRate}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <p className="text-xs text-gray-500">Top motivo</p>
          <p className="mt-1 text-sm font-semibold text-gray-200 truncate" title={topReason}>
            {topReason}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <p className="text-xs text-gray-500">Días promedio</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-400">
            {avgDays != null ? avgDays : '—'}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Distribución de motivos                                             */}
      {/* ------------------------------------------------------------------ */}
      {reasonDistribution.length > 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Distribucion de motivos
          </h3>
          {(() => {
            const maxCount = reasonDistribution[0]?.count ?? 1
            return (
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {reasonDistribution.map((entry) => {
                  const color = getReasonColor(entry.reason)
                  return (
                    <div key={entry.reason} className="flex items-center gap-3">
                      <span className="min-w-[200px] text-xs text-gray-300 leading-snug">
                        {entry.reason}
                      </span>
                      <div className="bg-gray-700/40 rounded-full h-2 flex-1">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(2, Math.round((entry.count / maxCount) * 100))}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span
                        className="text-xs tabular-nums font-semibold shrink-0"
                        style={{ color }}
                      >
                        {entry.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section A: Tipo de baja (status breakdown)                          */}
      {/* ------------------------------------------------------------------ */}
      {statusDistribution.length > 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Tipo de baja
          </h3>
          {(() => {
            const maxCount = statusDistribution[0]?.count ?? 1
            return (
              <div className="space-y-2">
                {statusDistribution.map((entry) => {
                  const color = getStatusColor(entry.status)
                  return (
                    <div key={entry.status} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-xs text-gray-300 leading-snug">
                        {entry.status}
                      </span>
                      <div className="bg-gray-700/40 rounded-full h-2 flex-1">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(2, Math.round((entry.count / maxCount) * 100))}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span
                        className="w-6 text-right text-xs tabular-nums font-semibold shrink-0"
                        style={{ color }}
                      >
                        {entry.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section B: Nivel al abandonar (language level pills)                */}
      {/* ------------------------------------------------------------------ */}
      {hasLangData && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Nivel al abandonar
          </h3>
          <div className="flex flex-wrap gap-2">
            {langDistribution.map(({ level, count }, idx) => {
              const color = LANG_COLORS[idx % LANG_COLORS.length]
              return (
                <span
                  key={level}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {level}
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${color}30` }}>
                    {count}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Detail table                                                         */}
      {/* ------------------------------------------------------------------ */}
      {dropouts.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-700/50">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Fecha baja</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">% Asistencia</th>
                <th className="px-3 py-3">Nivel idioma</th>
                <th className="px-3 py-3">Modalidad</th>
                <th className="px-3 py-3">Transferido a</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {dropouts.map((d) => {
                const modalityStyle = d.dropout_modality
                  ? (MODALITY_STYLES[d.dropout_modality] ?? { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' })
                  : null
                return (
                  <tr key={d.id} className="transition hover:bg-gray-700/20">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-100">
                      {d.full_name ?? '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: `${getStatusColor(d.current_status ?? '')}20`,
                          color: getStatusColor(d.current_status ?? ''),
                        }}
                      >
                        {d.current_status ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                      {d.dropout_date ?? '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: `${getReasonColor(d.dropout_reason ?? '')}20`,
                          color: getReasonColor(d.dropout_reason ?? ''),
                        }}
                      >
                        {d.dropout_reason ?? '\u2014'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-400">
                      {d.dropout_attendance_pct != null ? `${d.dropout_attendance_pct}%` : '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                      {d.dropout_language_level ?? '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {modalityStyle ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: modalityStyle.bg, color: modalityStyle.text }}
                        >
                          {d.dropout_modality}
                        </span>
                      ) : (
                        <span className="text-gray-600">\u2014</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                      {d.transferred_to ?? '\u2014'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
          <p className="text-sm text-gray-500">No hay bajas registradas para esta promo</p>
        </div>
      )}
    </div>
  )
}
