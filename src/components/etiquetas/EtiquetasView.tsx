'use client'

import { useEffect, useState } from 'react'
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
  getAllTags,
  getStatusCountsByTags,
  type TagCount,
  type StatusCount,
} from '@/lib/queries/etiquetas'
import { tagChipStyle, TAG_LEGEND } from '@/lib/utils/tags'
import TagPrefixCharts from './TagPrefixCharts'

// ─── Color palette ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'In Training': '#3B82F6',
  Hired: '#10B981',
  'Offer Withdrawn': '#F59E0B',
  'Offer Declined': '#FB923C',
  Expelled: '#EF4444',
  Transferred: '#8B5CF6',
  'To Place': '#06B6D4',
  Assigned: '#22C55E',
  'Stand-by': '#6B7280',
  'Training Finished': '#14B8A6',
  'No Show': '#DC2626',
  'Next Project': '#A78BFA',
  'Approved by client': '#34D399',
  'Rejected by client': '#F87171',
}

function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? '#6B7280'
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1F2937',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    fontSize: '12px',
    color: '#F3F4F6',
  },
  labelStyle: { color: '#F3F4F6' },
  itemStyle: { color: '#D1D5DB' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      {/* Prefix charts skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <div className="mb-4 h-4 w-32 animate-pulse rounded bg-gray-700" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-700/40" />
          </div>
        ))}
      </div>
      {/* Tag chips skeleton */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-4 h-4 w-40 animate-pulse rounded bg-gray-700" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded-full bg-gray-700/60"
              style={{ width: `${60 + (i % 4) * 20}px` }}
            />
          ))}
        </div>
      </div>
      {/* Status chart skeleton */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-gray-700" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-700/40" />
      </div>
    </div>
  )
}

// ─── Tag chip ─────────────────────────────────────────────────────────────────

interface TagChipProps {
  tag: string
  count: number
  selected: boolean
  onClick: () => void
}

function TagChip({ tag, count, selected, onClick }: TagChipProps) {
  // Use prefix-based color when unselected; blue highlight when selected
  const unselectedStyle = tagChipStyle(tag)
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150',
        selected
          ? 'border-blue-500 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
          : `${unselectedStyle} hover:opacity-80`,
      ].join(' ')}
    >
      <span>{tag}</span>
      <span
        className={[
          'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
          selected ? 'bg-blue-500/30 text-blue-200' : 'bg-black/20 text-inherit opacity-80',
        ].join(' ')}
      >
        {count.toLocaleString('es-AR')}
      </span>
    </button>
  )
}

// ─── Status table ─────────────────────────────────────────────────────────────

function StatusTable({ rows }: { rows: StatusCount[] }) {
  const total = rows.reduce((acc, r) => acc + r.count, 0)
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
            <th className="px-3 py-2.5">Estado</th>
            <th className="px-3 py-2.5 text-right">Candidatos</th>
            <th className="px-3 py-2.5 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {rows.map((row) => (
            <tr key={row.status} className="transition hover:bg-gray-700/20">
              <td className="whitespace-nowrap px-3 py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: statusColor(row.status) }}
                  />
                  <span className="text-gray-200">{row.status}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-100">
                {row.count.toLocaleString('es-AR')}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-400">
                {total > 0 ? Math.round((row.count / total) * 100) : row.percentage}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-700/50 bg-gray-800/40">
            <td className="px-3 py-2 text-xs font-medium text-gray-400">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-sm font-semibold text-gray-100">
              {total.toLocaleString('es-AR')}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-400">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EtiquetasView() {
  const [allTags, setAllTags] = useState<TagCount[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([])
  const [loadingTags, setLoadingTags] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)

  // Load all tags once on mount
  useEffect(() => {
    getAllTags().then((tags) => {
      setAllTags(tags)
      setLoadingTags(false)
    })
  }, [])

  // Reload status counts when selection changes
  useEffect(() => {
    setLoadingChart(true)
    getStatusCountsByTags(selectedTags.length > 0 ? selectedTags : undefined).then((counts) => {
      setStatusCounts(counts)
      setLoadingChart(false)
    })
  }, [selectedTags])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function clearSelection() {
    setSelectedTags([])
  }

  const totalFiltered = statusCounts.reduce((acc, r) => acc + r.count, 0)

  if (loadingTags) return <Skeleton />

  return (
    <div className="space-y-6">
      {/* ── Automatic FR / CP / GW comparison charts ── */}
      <TagPrefixCharts allTags={allTags} />

      {/* ── Tag selector ── */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">
            Etiquetas disponibles
            <span className="ml-2 text-xs font-normal text-gray-500">
              ({allTags.length} etiquetas)
            </span>
          </h2>
          {selectedTags.length > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline"
            >
              Limpiar selección ({selectedTags.length})
            </button>
          )}
        </div>
        {/* Tag prefix legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {TAG_LEGEND.map((l) => (
            <span key={l.prefix} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className={`h-2 w-2 rounded-full ${l.dotColor}`} />
              <span className={l.color}>{l.prefix}</span>
              <span>{l.label}</span>
            </span>
          ))}
        </div>

        {allTags.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay etiquetas registradas en candidatos.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTags.map(({ tag, count }) => (
              <TagChip
                key={tag}
                tag={tag}
                count={count}
                selected={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </div>
        )}

        {selectedTags.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Mostrando candidatos con al menos una de las etiquetas seleccionadas.
          </p>
        )}
      </div>

      {/* ── Chart section ── */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">
            Candidatos por estado
            {selectedTags.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                — filtrado por {selectedTags.length} etiqueta{selectedTags.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          {!loadingChart && (
            <span className="text-xs tabular-nums text-gray-500">
              {totalFiltered.toLocaleString('es-AR')} candidatos
            </span>
          )}
        </div>

        {loadingChart ? (
          <div className="h-64 animate-pulse rounded-lg bg-gray-700/40" />
        ) : statusCounts.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-gray-500">Sin datos para mostrar</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusCounts}
                layout="vertical"
                margin={{ left: 10, right: 30, top: 4, bottom: 4 }}
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
                  tick={{ fill: '#D1D5DB', fontSize: 11 }}
                  width={130}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {statusCounts.map((entry) => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {!loadingChart && statusCounts.length > 0 && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-200">Detalle por estado</h2>
          <StatusTable rows={statusCounts} />
        </div>
      )}
    </div>
  )
}
