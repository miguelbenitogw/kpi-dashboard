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
import { getAllDropouts, type DropoutAggregate } from '@/lib/queries/performance'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

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

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6B7280'
}

// Ordered language levels for heatmap rows
const LANG_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBy<T>(arr: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of arr) {
    const k = key(item)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string | number
  color?: string
}

function KpiCard({ label, value, color = 'text-gray-100' }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GlobalDropoutAnalysis() {
  const [rows, setRows] = useState<DropoutAggregate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAllDropouts()
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => { if (!cancelled) setError(String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ---- KPI metrics ----
  const totalDropouts = rows.length

  const distinctPromos = useMemo(() => {
    return new Set(rows.map((r) => r.promocion_nombre)).size
  }, [rows])

  const topReason = useMemo(() => {
    const counts = countBy(rows, (r) => r.dropout_reason ?? 'Sin motivo')
    let best = ''
    let bestCount = 0
    for (const [k, v] of counts) {
      if (v > bestCount) { bestCount = v; best = k }
    }
    return best || 'N/A'
  }, [rows])

  const topLang = useMemo(() => {
    const withLang = rows.filter((r) => r.dropout_language_level != null)
    if (withLang.length === 0) return 'N/A'
    const counts = countBy(withLang, (r) => r.dropout_language_level!)
    let best = ''
    let bestCount = 0
    for (const [k, v] of counts) {
      if (v > bestCount) { bestCount = v; best = k }
    }
    return best || 'N/A'
  }, [rows])

  // ---- Status distribution for bar chart ----
  const statusChartData = useMemo(() => {
    const counts = countBy(rows, (r) => r.sheet_status ?? 'Unknown')
    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)
  }, [rows])

  // ---- Top 10 reasons table ----
  const topReasonsData = useMemo(() => {
    const counts = countBy(rows, (r) => r.dropout_reason ?? 'Sin motivo')
    const sorted = Array.from(counts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    const max = sorted[0]?.count ?? 1
    return sorted.map((item) => ({ ...item, pct: Math.round((item.count / totalDropouts) * 100), barPct: Math.round((item.count / max) * 100) }))
  }, [rows, totalDropouts])

  // ---- Heatmap: language level vs status ----
  const heatmapData = useMemo(() => {
    // Collect all statuses
    const statuses = Array.from(new Set(rows.map((r) => r.sheet_status ?? 'Unknown'))).sort()

    // Build language level list: known levels first, then any extras, then null bucket
    const knownLevels = LANG_ORDER.filter((l) =>
      rows.some((r) => r.dropout_language_level === l)
    )
    const extraLevels = Array.from(new Set(
      rows
        .map((r) => r.dropout_language_level)
        .filter((l): l is string => l != null && !LANG_ORDER.includes(l))
    )).sort()
    const hasSinDatos = rows.some((r) => r.dropout_language_level == null)
    const levels = [...knownLevels, ...extraLevels, ...(hasSinDatos ? ['Sin datos'] : [])]

    // Count matrix
    const matrix: { level: string; cells: { status: string; count: number }[] }[] = levels.map((level) => {
      const filtered = level === 'Sin datos'
        ? rows.filter((r) => r.dropout_language_level == null)
        : rows.filter((r) => r.dropout_language_level === level)

      const cells = statuses.map((status) => ({
        status,
        count: filtered.filter((r) => (r.sheet_status ?? 'Unknown') === status).length,
      }))
      return { level, cells }
    })

    return { statuses, matrix }
  }, [rows])

  // Max cell value for heatmap intensity
  const heatmapMax = useMemo(() => {
    let max = 1
    for (const row of heatmapData.matrix) {
      for (const cell of row.cells) {
        if (cell.count > max) max = cell.count
      }
    }
    return max
  }, [heatmapData])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-800/50" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-gray-800/50" />
        <div className="h-48 rounded-xl bg-gray-800/50" />
        <div className="h-48 rounded-xl bg-gray-800/50" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-700/40 bg-red-900/20 p-6 text-center">
        <p className="text-sm text-red-400">Error cargando datos: {error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
        <p className="text-sm text-gray-500">No hay bajas registradas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* A. KPI row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total bajas" value={totalDropouts} color="text-red-400" />
        <KpiCard label="Promos con datos" value={distinctPromos} color="text-blue-400" />
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <p className="text-xs text-gray-500">Motivo más frecuente</p>
          <p className="mt-1 text-sm font-semibold text-gray-200 truncate" title={topReason}>
            {topReason}
          </p>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
          <p className="text-xs text-gray-500">Nivel más frecuente</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-purple-400">{topLang}</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* B. Status distribution — horizontal bar chart                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          Distribución por tipo de baja
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(180, statusChartData.length * 42)}>
          <BarChart
            data={statusChartData}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 120 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="status"
              width={115}
              tick={{ fill: '#D1D5DB', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#F3F4F6' }}
              itemStyle={{ color: '#9CA3AF' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {statusChartData.map((entry) => (
                <Cell key={entry.status} fill={statusColor(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* C. Top 10 reasons table                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          Top 10 motivos de baja
        </h3>
        <div className="space-y-2">
          {topReasonsData.map((item) => (
            <div key={item.reason} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-xs text-gray-300" title={item.reason}>
                {item.reason}
              </span>
              <div className="w-32 shrink-0 bg-gray-700/40 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${item.barPct}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs tabular-nums font-semibold text-blue-400 shrink-0">
                {item.count}
              </span>
              <span className="w-8 text-right text-[11px] tabular-nums text-gray-500 shrink-0">
                {item.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* D. Language level vs status heatmap                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          Nivel de idioma vs tipo de baja
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="pb-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Nivel</th>
                {heatmapData.statuses.map((s) => (
                  <th key={s} className="pb-2 px-2 font-medium text-gray-400 whitespace-nowrap text-center">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {heatmapData.matrix.map(({ level, cells }) => (
                <tr key={level} className="hover:bg-gray-700/10 transition-colors">
                  <td className="py-2 pr-4 font-semibold text-gray-300 whitespace-nowrap">
                    {level}
                  </td>
                  {cells.map(({ status, count }) => {
                    const intensity = count === 0 ? 0 : Math.max(0.08, count / heatmapMax)
                    const color = statusColor(status)
                    return (
                      <td key={status} className="px-2 py-2 text-center">
                        {count > 0 ? (
                          <span
                            className="inline-flex items-center justify-center w-8 h-6 rounded text-[11px] font-bold tabular-nums"
                            style={{
                              backgroundColor: `${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`,
                              color,
                            }}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
