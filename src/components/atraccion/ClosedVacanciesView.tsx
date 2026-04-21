'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getClosedVacanciesData,
  type ClosedVacanciesData,
  type ClosedVacancy,
} from '@/lib/queries/atraccion'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function vacancyStatusColor(status: string | null): string {
  if (!status) return 'text-gray-400'
  const s = status.toLowerCase()
  if (
    s === 'filled' ||
    s === 'conseguido exitósamente' ||
    s === 'conseguido exitosamente'
  )
    return 'text-emerald-400'
  if (s === 'cancelled' || s === 'cancelado por nosotros') return 'text-red-400'
  if (s === 'inactive') return 'text-gray-400'
  return 'text-blue-400'
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface TagChipProps {
  tag: string
  count: number
}

function TagChip({ tag, count }: TagChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-600/50 bg-gray-700/50 px-2 py-0.5 text-xs text-gray-300">
      {tag}
      <span className="rounded-full bg-indigo-500/30 px-1 text-indigo-300 font-medium">
        {count}
      </span>
    </span>
  )
}

interface TagBreakdownProps {
  tags: Record<string, number>
  vacancyTitle: string
}

function TagBreakdown({ tags, vacancyTitle }: TagBreakdownProps) {
  const sorted = Object.entries(tags).sort(([, a], [, b]) => b - a)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 mt-3">
      <p className="text-xs font-semibold text-gray-300 mb-2">
        Etiquetas — {vacancyTitle}
      </p>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500">Sin etiquetas disponibles aún</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map(([tag, count]) => (
            <TagChip key={tag} tag={tag} count={count} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ClosedVacanciesView() {
  const [data, setData] = useState<ClosedVacanciesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null)

  useEffect(() => {
    getClosedVacanciesData().then((d) => {
      setData(d)
      // Default to most recent year if available
      if (d.allYears.length > 0) {
        setSelectedYear(d.allYears[0])
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-4 w-48 animate-pulse rounded bg-gray-700" />
        <div className="h-40 animate-pulse rounded-xl bg-gray-700/50" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-gray-700/50" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.allYears.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-400">Sin vacantes cerradas</p>
      </div>
    )
  }

  // Vacancies for the selected year (or all)
  const vacanciesInView: ClosedVacancy[] =
    selectedYear === 'all'
      ? data.allYears.flatMap((y) => data.byYear[y] ?? [])
      : (data.byYear[selectedYear] ?? [])

  // Aggregated tags for the selected view
  const tagsInView: Record<string, number> = {}
  if (selectedYear === 'all') {
    for (const [tag, count] of Object.entries(data.allTags)) {
      tagsInView[tag] = count
    }
  } else {
    for (const v of vacanciesInView) {
      for (const [tag, count] of Object.entries(v.tags)) {
        tagsInView[tag] = (tagsInView[tag] ?? 0) + count
      }
    }
  }

  // Top 15 tags sorted descending
  const topTags = Object.entries(tagsInView)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([name, value]) => ({ name, value }))

  const hasTagData = topTags.some((t) => t.value > 0)

  // Selected vacancy details
  const selectedVacancyObj = selectedVacancy
    ? vacanciesInView.find((v) => v.id === selectedVacancy) ?? null
    : null

  return (
    <div className="space-y-5 p-5">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setSelectedYear('all')
            setSelectedVacancy(null)
          }}
          className={[
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            selectedYear === 'all'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
          ].join(' ')}
        >
          Todos
          <span className="rounded-full bg-gray-600/50 px-1.5 text-gray-400 text-[10px]">
            {data.allYears.reduce(
              (sum, y) => sum + (data.byYear[y]?.length ?? 0),
              0,
            )}
          </span>
        </button>
        {data.allYears.map((year) => (
          <button
            key={year}
            onClick={() => {
              setSelectedYear(year)
              setSelectedVacancy(null)
            }}
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedYear === year
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
            ].join(' ')}
          >
            {year}
            <span className="rounded-full bg-gray-600/50 px-1.5 text-gray-400 text-[10px]">
              {data.byYear[year]?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Tag distribution chart */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <h4 className="mb-4 text-xs font-semibold text-gray-300">
          Distribución de etiquetas de candidatos
          {selectedYear !== 'all' ? ` — ${selectedYear}` : ' — todos los años'}
        </h4>
        {!hasTagData ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-xs text-gray-500">
              Sin datos de etiquetas aún
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={topTags}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 120 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={115}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid rgba(55,65,81,0.5)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e5e7eb',
                }}
                formatter={(value: number) => [value, 'candidatos']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {topTags.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? '#818cf8' : '#6366f1'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Vacancies table */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
        <div className="border-b border-gray-700/50 px-5 py-3">
          <h4 className="text-xs font-semibold text-gray-300">
            Vacantes cerradas
            {selectedYear !== 'all' ? ` — ${selectedYear}` : ''}
            <span className="ml-2 text-gray-500 font-normal">
              {vacanciesInView.length} vacante
              {vacanciesInView.length !== 1 ? 's' : ''}
            </span>
          </h4>
        </div>

        {vacanciesInView.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-gray-500">
              Sin vacantes cerradas para este año
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/30">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-400">
                    Título
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-400 whitespace-nowrap">
                    Estado
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap">
                    Candidatos
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap">
                    Contratados
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap">
                    Apertura
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/20">
                {vacanciesInView.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() =>
                      setSelectedVacancy(
                        selectedVacancy === v.id ? null : v.id,
                      )
                    }
                    className={[
                      'cursor-pointer transition-colors',
                      selectedVacancy === v.id
                        ? 'bg-blue-500/10'
                        : 'hover:bg-gray-700/20',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-200 leading-snug">
                        {v.title}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={vacancyStatusColor(v.status)}>
                        {v.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-300">
                      {v.total_candidates}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-300">
                      {v.hired_count}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                      {formatDate(v.date_opened)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tag breakdown for selected vacancy */}
        {selectedVacancyObj && (
          <div className="px-5 pb-5">
            <TagBreakdown
              tags={selectedVacancyObj.tags}
              vacancyTitle={selectedVacancyObj.title}
            />
          </div>
        )}
      </div>
    </div>
  )
}
