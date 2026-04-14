'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getPromoDropouts,
  getPromoStudentList,
  type DropoutCandidate,
} from '@/lib/queries/performance'

const REASON_COLORS: Record<string, string> = {
  'Offer Withdrawn': '#F59E0B',
  'Offer-Withdrawn': '#F59E0B',
  'Offer Declined': '#F97316',
  'Offer-Declined': '#F97316',
  'Expelled': '#EF4444',
  'Transferred': '#3B82F6',
  'Rejected': '#DC2626',
  'Not Valid': '#B91C1C',
  'Un-Qualified': '#991B1B',
  'Personal reasons': '#8B5CF6',
  'Health issues': '#EC4899',
  'Other': '#6B7280',
}

function getReasonColor(reason: string): string {
  return REASON_COLORS[reason] ?? '#6B7280'
}

interface DropoutAnalysisProps {
  promocion: string
}

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

  const topReason = reasonDistribution[0]?.reason ?? 'N/A'
  const dropoutRate = totalStudents > 0
    ? Math.round((dropouts.length / totalStudents) * 100)
    : 0

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* Bar chart */}
      {reasonDistribution.length > 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Distribucion de motivos
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={reasonDistribution} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="reason"
                tick={{ fill: '#D1D5DB', fontSize: 11 }}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#F3F4F6' }}
                itemStyle={{ color: '#D1D5DB' }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {reasonDistribution.map((entry) => (
                  <Cell key={entry.reason} fill={getReasonColor(entry.reason)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dropout table */}
      {dropouts.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-700/50">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Fecha baja</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">% Asistencia</th>
                <th className="px-3 py-3">Nivel idioma</th>
                <th className="px-3 py-3">Transferido a</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {dropouts.map((d) => (
                <tr key={d.id} className="transition hover:bg-gray-700/20">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-100">
                    {d.full_name ?? '\u2014'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${getReasonColor(d.current_status ?? '')}20`,
                        color: getReasonColor(d.current_status ?? ''),
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
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                    {d.transferred_to ?? '\u2014'}
                  </td>
                </tr>
              ))}
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
