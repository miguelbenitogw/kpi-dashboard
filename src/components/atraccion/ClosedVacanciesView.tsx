'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  getClosedVacanciesData,
  type ClosedVacanciesData,
  type ClosedVacancy,
} from '@/lib/queries/atraccion'
import { tagChipStyle, tagColor, TAG_LEGEND } from '@/lib/utils/tags'

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
  if (s === 'filled' || s === 'conseguido exitósamente' || s === 'conseguido exitosamente')
    return 'text-emerald-400'
  if (s === 'cancelled' || s === 'cancelado por nosotros') return 'text-red-400'
  if (s === 'inactive') return 'text-gray-400'
  return 'text-blue-400'
}

/** Aggregate tag counts from an array of vacancies */
function aggregateTags(vacancies: ClosedVacancy[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const v of vacancies) {
    for (const [tag, count] of Object.entries(v.tags)) {
      result[tag] = (result[tag] ?? 0) + count
    }
  }
  return result
}

// Color per status type
function statusColorClass(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('hired') || s.includes('training') || s.includes('to place') || s.includes('assigned') || s.includes('next project')) return 'text-emerald-400'
  if (s.includes('approved') || s.includes('first call') || s.includes('second call') || s.includes('associated') || s.includes('waiting')) return 'text-blue-400'
  if (s.includes('withdrawn') || s.includes('declined') || s.includes('rejected') || s.includes('expelled') || s.includes('cancelled') || s.includes('no show') || s.includes('transferred')) return 'text-red-400'
  return 'text-gray-400'
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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tagChipStyle(tag)}`}>
      {tag}
      <span className="rounded-full bg-black/20 px-1 font-medium tabular-nums">
        {count}
      </span>
    </span>
  )
}

interface TagBreakdownProps {
  tags: Record<string, number>
  label: string
}

function TagBreakdown({ tags, label }: TagBreakdownProps) {
  const sorted = Object.entries(tags).sort(([, a], [, b]) => b - a)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 mt-3">
      <p className="text-xs font-semibold text-gray-300 mb-2">
        Etiquetas — {label}
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  useEffect(() => {
    getClosedVacanciesData().then((d) => {
      setData(d)
      if (d.allYears.length > 0) {
        setSelectedYear(d.allYears[0])
      }
      setLoading(false)
    })
  }, [])

  // When year changes, clear selection, search, and tag filters
  const handleYearChange = useCallback((year: number | 'all') => {
    setSelectedYear(year)
    setSelectedIds(new Set())
    setSearchQuery('')
    setSelectedTags(new Set())
  }, [])

  const toggleVacancy = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }, [])

  const clearTagFilter = useCallback(() => setSelectedTags(new Set()), [])

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

  // Apply search filter
  const searchLower = searchQuery.trim().toLowerCase()
  const afterSearch = searchLower
    ? vacanciesInView.filter((v) => v.title.toLowerCase().includes(searchLower))
    : vacanciesInView

  // Apply tag intersection filter (every selected tag must have count > 0)
  const filteredVacancies =
    selectedTags.size > 0
      ? afterSearch.filter((v) =>
          Array.from(selectedTags).every((tag) => (v.tags[tag] ?? 0) > 0)
        )
      : afterSearch

  // Tags to display in chart:
  // - if any selected → aggregate of those vacancies only
  // - otherwise → aggregate of all in view
  const selectedVacancies = vacanciesInView.filter((v) => selectedIds.has(v.id))
  const tagsInView =
    selectedIds.size > 0
      ? aggregateTags(selectedVacancies)
      : selectedYear === 'all'
        ? data.allTags
        : aggregateTags(vacanciesInView)

  // Top 30 tags sorted descending
  const topTags = Object.entries(tagsInView)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([name, value]) => ({ name, value }))

  const hasTagData = topTags.some((t) => t.value > 0)

  // Chart label
  const chartLabel =
    selectedIds.size > 0
      ? `${selectedIds.size} vacante${selectedIds.size !== 1 ? 's' : ''} seleccionada${selectedIds.size !== 1 ? 's' : ''}`
      : selectedYear !== 'all'
        ? `${selectedYear}`
        : 'todos los años'

  // Tag breakdown label for selected
  const selectedLabel =
    selectedIds.size === 1
      ? (selectedVacancies[0]?.title ?? '')
      : `${selectedIds.size} vacantes`

  // All statuses that appear across visible vacancies — dynamic, no hardcoding
  const activeStatusCols = (data.allStatuses ?? [])
    .filter((status) => filteredVacancies.some((v) => (v.byStatus[status] ?? 0) > 0))
    .map((status) => ({ key: status, label: status, colorClass: statusColorClass(status) }))

  return (
    <div className="space-y-5 p-5">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleYearChange('all')}
          className={[
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            selectedYear === 'all'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
          ].join(' ')}
        >
          Todos
          <span className="rounded-full bg-gray-600/50 px-1.5 text-gray-400 text-[10px]">
            {data.allYears.reduce((sum, y) => sum + (data.byYear[y]?.length ?? 0), 0)}
          </span>
        </button>
        {data.allYears.map((year) => (
          <button
            key={year}
            onClick={() => handleYearChange(year)}
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

      {/* Tag distribution — clickable bar list with filter */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-300">
              Distribución de etiquetas — {chartLabel}
            </h4>
            {/* Tag prefix legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 mb-0.5">
              {TAG_LEGEND.map((l) => (
                <span key={l.prefix} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className={`h-2 w-2 rounded-full ${l.dotColor}`} />
                  <span className={l.color}>{l.prefix}</span>
                  <span>{l.label}</span>
                </span>
              ))}
            </div>
            {selectedTags.size > 0 && (
              <p className="mt-0.5 text-[10px] text-indigo-400">
                {selectedTags.size} etiqueta{selectedTags.size !== 1 ? 's' : ''} activa{selectedTags.size !== 1 ? 's' : ''} · filtrando tabla
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selectedTags.size > 0 && (
              <button
                onClick={clearTagFilter}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/30 rounded-full px-2 py-0.5"
              >
                Limpiar filtro
              </button>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/30 rounded-full px-2 py-0.5"
              >
                Limpiar selección
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: bar list (60%) */}
          <div className="lg:col-span-3">
            {!hasTagData ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-xs text-gray-500">Sin datos de etiquetas aún</p>
              </div>
            ) : (() => {
              const maxValue = topTags[0]?.value ?? 1
              const totalAssignments = topTags.reduce((sum, t) => sum + t.value, 0)
              return (
                <div>
                  <div className="max-h-[400px] overflow-y-auto space-y-0.5 pr-1">
                    {topTags.map((tag) => {
                      const isTagSelected = selectedTags.has(tag.name)
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => toggleTag(tag.name)}
                          className={[
                            'group w-full rounded-lg px-2 py-1.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
                            isTagSelected
                              ? 'bg-indigo-600/20 ring-1 ring-inset ring-indigo-500/40'
                              : 'hover:bg-gray-700/30',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {/* Prefix color dot */}
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: tagColor(tag.name) }}
                            />

                            {/* Tag name */}
                            <span
                              className={[
                                'min-w-0 flex-1 truncate text-xs leading-none',
                                isTagSelected
                                  ? 'font-semibold text-indigo-200'
                                  : 'text-gray-300 group-hover:text-gray-100',
                              ].join(' ')}
                              title={tag.name}
                            >
                              {tag.name}
                            </span>

                            {/* Count badge */}
                            <span
                              className={[
                                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none',
                                isTagSelected
                                  ? 'bg-indigo-500/30 text-indigo-200'
                                  : 'bg-gray-700/60 text-gray-400 group-hover:text-gray-300',
                              ].join(' ')}
                            >
                              {tag.value}
                            </span>
                          </div>

                          {/* Bar track — color based on tag prefix */}
                          <div className="ml-4 h-1.5 overflow-hidden rounded-full bg-gray-700/50">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.max(2, Math.round((tag.value / maxValue) * 100))}%`,
                                backgroundColor: tagColor(tag.name),
                                opacity: isTagSelected ? 1 : 0.7,
                              }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-[10px] text-gray-500">
                    {topTags.length} etiquetas · {totalAssignments} asignaciones · clic para filtrar
                  </p>
                </div>
              )
            })()}
          </div>

          {/* Right: donut chart (40%) */}
          <div className="lg:col-span-2 rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
            <h4 className="mb-2 text-xs font-semibold text-gray-300">Distribución (top 10)</h4>
            {!hasTagData ? (
              <p className="text-xs text-gray-500 text-center mt-8">Sin datos</p>
            ) : (() => {
              const donutColors = ['#818cf8','#6366f1','#a5b4fc','#4f46e5','#7c3aed','#8b5cf6','#c4b5fd','#4338ca','#6d28d9','#5b21b6']
              const donutTags = selectedTags.size > 0
                ? topTags.filter((t) => selectedTags.has(t.name))
                : topTags.slice(0, 10)
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={donutTags}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {donutTags.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={donutColors[index % donutColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid rgba(55,65,81,0.5)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#e5e7eb',
                      }}
                      formatter={(value) => [value, 'candidatos']}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }}
                      formatter={(value) => value.length > 18 ? value.slice(0, 18) + '\u2026' : value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Vacancies table */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
        <div className="border-b border-gray-700/50 px-5 py-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold text-gray-300">
              Vacantes cerradas
              {selectedYear !== 'all' ? ` — ${selectedYear}` : ''}
              <span className="ml-2 text-gray-500 font-normal">
                {filteredVacancies.length}
                {filteredVacancies.length !== vacanciesInView.length
                  ? ` de ${vacanciesInView.length}`
                  : ''}{' '}
                vacante{filteredVacancies.length !== 1 ? 's' : ''}
              </span>
            </h4>
            {selectedIds.size > 0 && (
              <span className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-2 py-0.5">
                {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Active tag filter chip */}
          {selectedTags.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 text-[10px] text-indigo-300">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                {selectedTags.size} etiqueta{selectedTags.size !== 1 ? 's' : ''} filtrada{selectedTags.size !== 1 ? 's' : ''}
                <span className="mx-0.5 text-indigo-500/60">|</span>
                <button
                  onClick={clearTagFilter}
                  className="font-medium text-indigo-300 hover:text-indigo-100 transition-colors"
                >
                  Limpiar
                </button>
              </span>
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // Typing clears tag filters to avoid confusing intersections
                if (selectedTags.size > 0) setSelectedTags(new Set())
              }}
              placeholder="Buscar por título..."
              className="w-full rounded-lg border border-gray-700/50 bg-gray-700/40 pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {filteredVacancies.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-gray-500">
              {searchQuery || selectedTags.size > 0
                ? 'Sin resultados para los filtros aplicados'
                : 'Sin vacantes cerradas para este año'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/30">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-4 py-2.5 text-left font-medium text-gray-400">Título</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-400 whitespace-nowrap">Estado</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap">Candidatos</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap">Contratados</th>
                  {activeStatusCols.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-medium text-gray-400 whitespace-nowrap">Apertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/20">
                {filteredVacancies.map((v) => {
                  const isSelected = selectedIds.has(v.id)
                  const hasStatusData = Object.keys(v.byStatus).length > 0
                  return (
                    <tr
                      key={v.id}
                      onClick={() => toggleVacancy(v.id)}
                      className={[
                        'cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                          : 'hover:bg-gray-700/20',
                      ].join(' ')}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected}
                          className="h-3.5 w-3.5 rounded border-gray-600 accent-indigo-500 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleVacancy(v.id)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={['font-medium leading-snug', isSelected ? 'text-indigo-200' : 'text-gray-200'].join(' ')}>
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
                      {activeStatusCols.map((col) => {
                        const count = v.byStatus[col.key] ?? 0
                        return (
                          <td key={col.key} className="px-3 py-2.5 text-right tabular-nums">
                            {hasStatusData ? (
                              <span className={count > 0 ? col.colorClass : 'text-gray-600'}>
                                {count > 0 ? count : '—'}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-[10px]">n/d</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                        {formatDate(v.date_opened)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tag breakdown for selected vacancies */}
        {selectedIds.size > 0 && (
          <div className="px-5 pb-5">
            <TagBreakdown
              tags={aggregateTags(selectedVacancies)}
              label={selectedLabel}
            />
          </div>
        )}
      </div>
    </div>
  )
}
