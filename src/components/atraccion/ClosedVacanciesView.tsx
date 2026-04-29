'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  getClosedVacanciesData,
  type ClosedVacanciesData,
  type ClosedVacancy,
} from '@/lib/queries/atraccion'
import { tagChipStyle, tagColor, TAG_LEGEND } from '@/lib/utils/tags'
import TagPrefixCharts from '@/components/etiquetas/TagPrefixCharts'
import {
  getVacancyCountry,
  COUNTRY_COLORS,
  type VacancyCountry,
} from '@/lib/utils/vacancy-country'

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
  const [selectedCountry, setSelectedCountry] = useState<VacancyCountry | 'Todos'>('Todos')
  const [hiddenStatusCols, setHiddenStatusCols] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('closed-vacancy-hidden-cols')
        if (saved) return new Set(JSON.parse(saved) as string[])
      } catch {}
    }
    return new Set<string>()
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getClosedVacanciesData().then((d) => {
      setData(d)
      if (d.allYears.length > 0) {
        setSelectedYear(d.allYears[0])
      }
      setLoading(false)
    })
  }, [])

  // When year changes, clear selection, search, tag filters, and country filter
  const handleYearChange = useCallback((year: number | 'all') => {
    setSelectedYear(year)
    setSelectedIds(new Set())
    setSearchQuery('')
    setSelectedTags(new Set())
    setSelectedCountry('Todos')
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

  const toggleStatusCol = useCallback((col: string) => {
    setHiddenStatusCols((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      localStorage.setItem('closed-vacancy-hidden-cols', JSON.stringify([...next]))
      return next
    })
  }, [])

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

  if (loading) {
    return (
      <div className="space-y-3 p-4">
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

  // Apply country filter
  const afterCountry =
    selectedCountry !== 'Todos'
      ? afterSearch.filter((v) => getVacancyCountry(v.title) === selectedCountry)
      : afterSearch

  // Apply tag intersection filter (every selected tag must have count > 0)
  const filteredVacancies =
    selectedTags.size > 0
      ? afterCountry.filter((v) =>
          Array.from(selectedTags).every((tag) => (v.tags[tag] ?? 0) > 0)
        )
      : afterCountry

  // Countries present in the current year's data (for filter pills)
  const countriesInView = Array.from(
    new Set(vacanciesInView.map((v) => getVacancyCountry(v.title)))
  ).sort() as VacancyCountry[]

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

  // ALL statuses ever seen across the full dataset — used for the column selector dropdown
  const allColOptions = (data.allStatuses ?? [])
    .map((status) => ({ key: status, label: status, colorClass: statusColorClass(status) }))

  // Table columns: only statuses with data in the CURRENT filtered vacancies, minus hidden ones
  const activeStatusCols = (data.allStatuses ?? [])
    .filter(
      (status) =>
        !hiddenStatusCols.has(status) &&
        filteredVacancies.some((v) => (v.byStatus[status] ?? 0) > 0),
    )
    .map((status) => ({ key: status, label: status, colorClass: statusColorClass(status) }))

  return (
    <div className="space-y-3 p-4">
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

      {/* Country filter */}
      {countriesInView.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedCountry('Todos')}
            className={[
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors',
              selectedCountry === 'Todos'
                ? 'bg-gray-600 text-gray-100 border-gray-500'
                : 'bg-gray-700/40 text-gray-400 border-gray-600/50 hover:bg-gray-700 hover:text-gray-200',
            ].join(' ')}
          >
            Todos
          </button>
          {countriesInView.map((country) => {
            const colors = COUNTRY_COLORS[country]
            const isActive = selectedCountry === country
            return (
              <button
                key={country}
                onClick={() => setSelectedCountry(isActive ? 'Todos' : country)}
                style={
                  isActive
                    ? {
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }
                    : undefined
                }
                className={[
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors',
                  isActive
                    ? ''
                    : 'bg-gray-700/40 text-gray-400 border-gray-600/50 hover:bg-gray-700 hover:text-gray-200',
                ].join(' ')}
              >
                {country}
              </button>
            )
          })}
        </div>
      )}

      {/* % Éxito summary stat for filtered vacancies */}
      {(() => {
        const withCandidates = filteredVacancies.filter((v) => v.total_candidates > 0)
        if (withCandidates.length === 0) return null
        const totalSuccess = withCandidates.reduce(
          (sum, v) => sum + v.hired_count + (v.byStatus['Approved by client'] ?? 0),
          0,
        )
        const totalCandidates = withCandidates.reduce((sum, v) => sum + v.total_candidates, 0)
        const rate = Math.round((totalSuccess / totalCandidates) * 1000) / 10
        const color = rate >= 15 ? '#16a34a' : rate >= 8 ? '#d97706' : '#9ca3af'
        const bgColor = rate >= 15 ? '#f0fdf4' : rate >= 8 ? '#fffbeb' : '#f9fafb'
        const borderColor = rate >= 15 ? '#bbf7d0' : rate >= 8 ? '#fde68a' : '#e5e7eb'
        return (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
            }}
          >
            <span style={{ color: '#6b7280', fontWeight: 500 }}>% Éxito selección:</span>
            <span style={{ color, fontWeight: 700, fontSize: 15 }}>
              {rate.toLocaleString('es-AR')}%
            </span>
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              →{' '}
              {totalSuccess.toLocaleString('es-AR')} éxitos de{' '}
              {totalCandidates.toLocaleString('es-AR')} CVs
            </span>
          </div>
        )
      })()}

      {/* FR / CP / GW breakdown charts */}
      {hasTagData && (() => {
        const prefixTagList = Object.entries(tagsInView).map(([tag, count]) => ({ tag, count }))
        return (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-xs font-semibold text-gray-300">
                Análisis de canales de captación — {chartLabel}
              </h4>
            </div>
            <TagPrefixCharts allTags={prefixTagList} />
          </div>
        )
      })()}

      {/* Tag distribution — clickable bar list with filter */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
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
        <div className="border-b border-gray-700/50 px-4 py-2 flex flex-col gap-2">
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

          {/* Column selector + Search */}
          <div className="flex items-center gap-2">
          {/* Columns dropdown */}
          <div className="relative shrink-0" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Columnas
              {hiddenStatusCols.size > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
              )}
            </button>
            {showColMenu && (
              <div className="absolute left-0 top-full mt-1.5 z-20 rounded-xl border border-gray-700/50 bg-gray-800 shadow-xl w-64 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-300">Columnas visibles</span>
                  <div className="flex gap-2">
                    {hiddenStatusCols.size > 0 && (
                      <button
                        onClick={() => {
                          setHiddenStatusCols(new Set())
                          localStorage.removeItem('closed-vacancy-hidden-cols')
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                      >
                        Mostrar todas
                      </button>
                    )}
                    <button onClick={() => setShowColMenu(false)} className="text-gray-500 hover:text-gray-300 text-sm leading-none">×</button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {allColOptions.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenStatusCols.has(col.key)}
                        onChange={() => toggleStatusCol(col.key)}
                        className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-700 accent-blue-500 cursor-pointer"
                      />
                      <span className={`text-xs ${col.colorClass}`}>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search input */}
          <div className="relative flex-1">
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
          </div>{/* end flex row */}
        </div>

        {filteredVacancies.length === 0 ? (
          <div className="p-4 text-center">
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
                  <th className="w-8 px-2 py-1.5" />
                  <th className="px-3 py-1.5 text-left font-medium text-gray-400" style={{ fontSize: 13 }}>Título</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-400 whitespace-nowrap" style={{ fontSize: 13 }}>Estado</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-400 whitespace-nowrap" style={{ fontSize: 13 }}>Candidatos</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-400 whitespace-nowrap" style={{ fontSize: 13 }}>Contratados</th>
                  <th className="px-3 py-1.5 text-right font-medium text-gray-400 whitespace-nowrap" style={{ fontSize: 13 }}>% Éxito</th>
                  {activeStatusCols.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-1.5 text-right font-medium text-gray-400 whitespace-nowrap"
                      style={{ fontSize: 13 }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-right font-medium text-gray-400 whitespace-nowrap" style={{ fontSize: 13 }}>Apertura</th>
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
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          readOnly
                          checked={isSelected}
                          className="h-3.5 w-3.5 rounded border-gray-600 accent-indigo-500 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleVacancy(v.id)}
                        />
                      </td>
                      <td className="px-3 py-1.5" style={{ fontSize: 13 }}>
                        <span className={['font-medium leading-snug', isSelected ? 'text-indigo-200' : 'text-gray-200'].join(' ')}>
                          {v.title}
                        </span>
                        {(() => {
                          const country = getVacancyCountry(v.title)
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
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ fontSize: 13 }}>
                        <span className={vacancyStatusColor(v.status)}>
                          {v.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-300" style={{ fontSize: 13 }}>
                        {v.total_candidates}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-300" style={{ fontSize: 13 }}>
                        {v.hired_count}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ fontSize: 13 }}>
                        {(() => {
                          if (!hasStatusData || v.total_candidates === 0) {
                            return <span className="text-gray-600 text-[10px]">n/d</span>
                          }
                          const success = v.hired_count + (v.byStatus['Approved by client'] ?? 0)
                          const rate = Math.round((success / v.total_candidates) * 1000) / 10
                          const color =
                            rate >= 15 ? '#16a34a' :
                            rate >= 8  ? '#d97706' : '#9ca3af'
                          return (
                            <span style={{ color, fontWeight: rate >= 8 ? 600 : 400 }}>
                              {rate.toLocaleString('es-AR')}%
                            </span>
                          )
                        })()}
                      </td>
                      {activeStatusCols.map((col) => {
                        const count = v.byStatus[col.key] ?? 0
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-right tabular-nums" style={{ fontSize: 13 }}>
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
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-400" style={{ fontSize: 13 }}>
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
          <div className="px-4 pb-4">
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
