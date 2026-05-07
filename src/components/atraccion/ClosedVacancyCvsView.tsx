'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  getClosedVacanciesUnified,
  type ClosedVacancyUnified,
  type ClosedVacanciesUnifiedData,
} from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS, type VacancyCountry } from '@/lib/utils/vacancy-country'
import { type TipoProfesional, deriveProfesionTipo } from '@/lib/utils/vacancy-profession'
import { tagColor, TAG_LEGEND } from '@/lib/utils/tags'
import TagPrefixCharts from '@/components/etiquetas/TagPrefixCharts'

// ─── constants ────────────────────────────────────────────────────────────────

type SortKey = 'title' | 'year' | 'totalCandidates' | 'hiredCount' | 'successRate' | 'peakWeekLabel'
type SortDir = 'asc' | 'desc'

// ─── helpers ──────────────────────────────────────────────────────────────────

function rateColor(rate: number | null): string {
  if (rate === null) return '#a8a29e'
  if (rate > 0.2) return '#16a34a'
  if (rate >= 0.1) return '#ca8a04'
  return '#dc2626'
}

function rateColorByPct(pct: number | null): string {
  if (pct === null) return '#a8a29e'
  if (pct >= 20) return '#16a34a'
  if (pct >= 10) return '#d97706'
  return '#dc2626'
}

function truncateTitle(title: string, maxLength = 38): string {
  return title.length <= maxLength ? title : `${title.slice(0, maxLength - 1)}…`
}

/** Color for status columns — inline style equivalent of ClosedVacanciesView.statusColorClass */
function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (
    s.includes('hired') || s.includes('training') || s.includes('to place') ||
    s.includes('assigned') || s.includes('next project')
  ) return '#16a34a'
  if (
    s.includes('approved') || s.includes('first call') || s.includes('second call') ||
    s.includes('associated') || s.includes('waiting')
  ) return '#2563eb'
  if (
    s.includes('withdrawn') || s.includes('declined') || s.includes('rejected') ||
    s.includes('expelled') || s.includes('cancelled') || s.includes('no show') ||
    s.includes('transferred')
  ) return '#dc2626'
  return '#9ca3af'
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? '#ffffff' : '#78716c',
        background: active ? '#1e4b9e' : '#f7f4ef',
        border: `1px solid ${active ? '#1e4b9e' : '#e7e2d8'}`,
        borderRadius: 99,
        cursor: 'pointer',
        lineHeight: 1.4,
      }}
    >
      {children}
    </button>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = 'right',
  minWidth,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
  minWidth?: number
}) {
  const active = currentKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: '7px 12px',
        textAlign: align,
        color: active ? '#1e4b9e' : '#78716c',
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        minWidth,
      }}
    >
      {label}{' '}
      {active ? (currentDir === 'desc' ? '↓' : '↑') : <span style={{ color: '#e7e2d8' }}>↕</span>}
    </th>
  )
}

// ─── section A: KPI strip ─────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: ClosedVacanciesUnifiedData['kpis'] | undefined }) {
  const avgPct = kpis?.avgSuccessRate != null ? kpis.avgSuccessRate * 100 : null
  const successColor = rateColor(kpis?.avgSuccessRate ?? null)

  const items = [
    {
      label: 'Total vacantes cerradas',
      value: kpis ? kpis.totalVacancies.toLocaleString('es-AR') : '—',
      color: '#1c1917',
    },
    {
      label: '% Éxito promedio',
      value: avgPct !== null ? `${avgPct.toFixed(1)}%` : '—',
      color: successColor,
    },
    {
      label: 'Total CVs históricos',
      value: kpis ? kpis.totalCVsHistorical.toLocaleString('es-AR') : '—',
      color: '#1c1917',
    },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            flex: '1 1 160px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 12,
            padding: '14px 20px',
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 500,
              margin: 0,
              marginBottom: 6,
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: item.color,
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Tags section ─────────────────────────────────────────────────────────────

function TagsSection({
  vacancies,
  selectedTags,
  onToggleTag,
  onClearTags,
}: {
  vacancies: ClosedVacancyUnified[]
  selectedTags: Set<string>
  onToggleTag: (tag: string) => void
  onClearTags: () => void
}) {
  // Aggregate tags from current filtered vacancies
  const aggregatedTags = useMemo(() => {
    const result: Record<string, number> = {}
    for (const v of vacancies) {
      for (const [tag, count] of Object.entries(v.tags)) {
        result[tag] = (result[tag] ?? 0) + count
      }
    }
    return result
  }, [vacancies])

  const prefixTagList = useMemo(
    () => Object.entries(aggregatedTags).map(([tag, count]) => ({ tag, count })),
    [aggregatedTags],
  )

  const hasTagData = prefixTagList.some((t) => t.count > 0)

  const topTags = useMemo(
    () =>
      Object.entries(aggregatedTags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 30)
        .map(([name, value]) => ({ name, value })),
    [aggregatedTags],
  )

  const maxValue = topTags[0]?.value ?? 1

  if (!hasTagData) return null

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e7e2d8',
          background: '#faf8f5',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            Análisis de etiquetas
          </p>
          {/* Tag prefix legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 4 }}>
            {TAG_LEGEND.map((l) => (
              <span
                key={l.prefix}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#78716c' }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tagColor(l.prefix + ' '),
                    flexShrink: 0,
                  }}
                />
                <strong style={{ color: '#1c1917' }}>{l.prefix}</strong>
                {' '}{l.label}
              </span>
            ))}
          </div>
          {selectedTags.size > 0 && (
            <p style={{ marginTop: 4, fontSize: 10, color: '#1e4b9e' }}>
              {selectedTags.size} etiqueta{selectedTags.size !== 1 ? 's' : ''} activa{selectedTags.size !== 1 ? 's' : ''} · filtrando tabla
            </p>
          )}
        </div>
        {selectedTags.size > 0 && (
          <button
            type="button"
            onClick={onClearTags}
            style={{
              fontSize: 10,
              color: '#1e4b9e',
              background: '#f0f4ff',
              border: '1px solid #c7d7ff',
              borderRadius: 99,
              padding: '3px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Limpiar filtro
          </button>
        )}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* FR/CP/GW prefix charts */}
        <TagPrefixCharts allTags={prefixTagList} />

        {/* Tag distribution bar list */}
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1917', margin: '0 0 8px' }}>
            Distribución top 30 etiquetas
          </p>
          <div
            style={{
              maxHeight: 300,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {topTags.map((tag) => {
              const isSelected = selectedTags.has(tag.name)
              const barColor = tagColor(tag.name)
              const barWidth = Math.max(2, Math.round((tag.value / maxValue) * 100))

              return (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => onToggleTag(tag.name)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    width: '100%',
                    textAlign: 'left',
                    background: isSelected ? '#f0f4ff' : 'transparent',
                    border: `1px solid ${isSelected ? '#c7d7ff' : 'transparent'}`,
                    borderRadius: 8,
                    padding: '6px 8px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: barColor,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: isSelected ? '#1e4b9e' : '#1c1917',
                        fontWeight: isSelected ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={tag.name}
                    >
                      {tag.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: isSelected ? '#1e4b9e' : '#78716c',
                        background: isSelected ? '#dbeafe' : '#f7f4ef',
                        borderRadius: 99,
                        padding: '1px 6px',
                        flexShrink: 0,
                      }}
                    >
                      {tag.value}
                    </span>
                  </div>
                  <div
                    style={{
                      marginLeft: 16,
                      height: 6,
                      background: '#f0ece4',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        background: barColor,
                        borderRadius: 3,
                        opacity: isSelected ? 1 : 0.7,
                      }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          <p style={{ marginTop: 6, fontSize: 10, color: '#a8a29e' }}>
            {topTags.length} etiquetas · clic para filtrar
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── section D: vacancy table ─────────────────────────────────────────────────

function SuccessRateBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <span style={{ color: '#a8a29e', fontSize: 12 }}>—</span>
  }
  const pct = rate * 100
  const color = rateColorByPct(pct)
  const bgColor = pct >= 20 ? '#dcfce7' : pct >= 10 ? '#fef3c7' : '#fee2e2'

  return (
    <div
      style={{
        position: 'relative',
        background: '#f7f4ef',
        borderRadius: 4,
        overflow: 'hidden',
        height: 20,
        minWidth: 64,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          background: bgColor,
          width: `${Math.min(100, pct)}%`,
          borderRadius: 4,
        }}
      />
      <span
        style={{
          position: 'relative',
          fontSize: 11,
          fontWeight: 600,
          color,
          padding: '0 6px',
          lineHeight: '20px',
          display: 'block',
          textAlign: 'center',
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function VacancyTable({
  vacancies,
  allStatuses,
  searchQuery,
  onSearchChange,
  selectedTags,
}: {
  vacancies: ClosedVacancyUnified[]
  allStatuses: string[]
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedTags: Set<string>
}) {
  const [sortKey, setSortKey] = useState<SortKey>('totalCandidates')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAll, setShowAll] = useState(false)
  const [hiddenStatusCols, setHiddenStatusCols] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('closed-unified-hidden-cols')
        if (saved) return new Set(JSON.parse(saved) as string[])
      } catch {}
    }
    return new Set<string>()
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const PAGE = 20

  // Close col menu on outside click
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

  const toggleStatusCol = useCallback((col: string) => {
    setHiddenStatusCols((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      try { localStorage.setItem('closed-unified-hidden-cols', JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])

  // Filter by search
  const afterSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return vacancies
    return vacancies.filter((v) => v.title.toLowerCase().includes(q))
  }, [vacancies, searchQuery])

  // Filter by selected tags (intersection)
  const filtered = useMemo(() => {
    if (selectedTags.size === 0) return afterSearch
    return afterSearch.filter((v) =>
      Array.from(selectedTags).every((tag) => (v.tags[tag] ?? 0) > 0),
    )
  }, [afterSearch, selectedTags])

  // Active status columns: statuses with data in current filtered vacancies, not hidden
  const activeStatusCols = useMemo(
    () =>
      allStatuses.filter(
        (s) => !hiddenStatusCols.has(s) && filtered.some((v) => (v.byStatus[s] ?? 0) > 0),
      ),
    [allStatuses, hiddenStatusCols, filtered],
  )

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number | null
      let vb: string | number | null

      switch (sortKey) {
        case 'title':
          va = a.title.toLowerCase()
          vb = b.title.toLowerCase()
          break
        case 'year':
          va = a.year ?? 0
          vb = b.year ?? 0
          break
        case 'totalCandidates':
          va = a.totalCandidates
          vb = b.totalCandidates
          break
        case 'hiredCount':
          va = a.hiredCount
          vb = b.hiredCount
          break
        case 'successRate':
          va = a.successRate ?? -1
          vb = b.successRate ?? -1
          break
        case 'peakWeekLabel':
          va = a.peakWeekLabel ?? ''
          vb = b.peakWeekLabel ?? ''
          break
        default:
          va = 0
          vb = 0
      }

      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const displayed = showAll ? sorted : sorted.slice(0, PAGE)

  // Reset showAll when filters change
  useEffect(() => { setShowAll(false) }, [vacancies, searchQuery, selectedTags])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Total column count for colSpan
  const totalCols = 9 + activeStatusCols.length

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e7e2d8',
          background: '#faf8f5',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            Detalle por vacante
          </p>
          <span
            style={{
              background: '#e7e2d8',
              color: '#78716c',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 99,
            }}
          >
            {filtered.length}
          </span>
          {(selectedTags.size > 0) && (
            <span
              style={{
                fontSize: 10,
                color: '#1e4b9e',
                background: '#f0f4ff',
                border: '1px solid #c7d7ff',
                borderRadius: 99,
                padding: '2px 8px',
              }}
            >
              {selectedTags.size} etiqueta{selectedTags.size !== 1 ? 's' : ''} filtrada{selectedTags.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Controls row: columns button + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Columns dropdown */}
          {allStatuses.length > 0 && (
            <div style={{ position: 'relative', flexShrink: 0 }} ref={colMenuRef}>
              <button
                type="button"
                onClick={() => setShowColMenu((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#78716c',
                  background: '#ffffff',
                  border: '1px solid #e7e2d8',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="8" y1="12" x2="20" y2="12" />
                  <line x1="12" y1="18" x2="20" y2="18" />
                </svg>
                Columnas
                {hiddenStatusCols.size > 0 && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#1e4b9e',
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
              {showColMenu && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 'calc(100% + 6px)',
                    zIndex: 20,
                    background: '#ffffff',
                    border: '1px solid #e7e2d8',
                    borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(28,25,23,0.12)',
                    width: 260,
                    padding: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1c1917' }}>Columnas visibles</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {hiddenStatusCols.size > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setHiddenStatusCols(new Set())
                            try { localStorage.removeItem('closed-unified-hidden-cols') } catch {}
                          }}
                          style={{ fontSize: 10, color: '#1e4b9e', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Mostrar todas
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowColMenu(false)}
                        style={{ fontSize: 14, color: '#a8a29e', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ maxHeight: 256, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {allStatuses.map((status) => (
                      <label
                        key={status}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 8px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenStatusCols.has(status)}
                          onChange={() => toggleStatusCol(status)}
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1e4b9e' }}
                        />
                        <span style={{ fontSize: 12, color: statusColor(status), fontWeight: 500 }}>
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <svg
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#a8a29e',
              }}
              width="14"
              height="14"
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
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por título..."
              style={{
                width: '100%',
                padding: '5px 32px 5px 32px',
                fontSize: 12,
                color: '#1c1917',
                background: '#ffffff',
                border: '1px solid #e7e2d8',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#a8a29e',
                  lineHeight: 1,
                  padding: 2,
                }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f4ef', borderBottom: '1px solid #e7e2d8' }}>
              <SortableHeader
                label="Vacante"
                sortKey="title"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                align="left"
                minWidth={240}
              />
              <th
                style={{
                  padding: '7px 12px',
                  textAlign: 'left',
                  color: '#78716c',
                  fontWeight: 500,
                  minWidth: 80,
                  whiteSpace: 'nowrap',
                }}
              >
                País
              </th>
              <SortableHeader
                label="Año"
                sortKey="year"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={60}
              />
              <SortableHeader
                label="CVs"
                sortKey="totalCandidates"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={80}
              />
              <SortableHeader
                label="Contratados"
                sortKey="hiredCount"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={90}
              />
              <SortableHeader
                label="% Éxito"
                sortKey="successRate"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={100}
              />
              <th
                style={{ padding: '7px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#78716c', whiteSpace: 'nowrap', minWidth: 100 }}
                title="Éxito sobre candidatos realmente contactados"
              >
                % Éxito real
              </th>
              <th
                style={{ padding: '7px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#78716c', whiteSpace: 'nowrap', minWidth: 100 }}
                title="Tasa de descarte / ruido del pipeline"
              >
                % Descarte
              </th>
              {activeStatusCols.map((status) => (
                <th
                  key={status}
                  style={{
                    padding: '7px 12px',
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 500,
                    color: statusColor(status),
                    whiteSpace: 'nowrap',
                    minWidth: 90,
                  }}
                >
                  {status}
                </th>
              ))}
              <SortableHeader
                label="Pico"
                sortKey="peakWeekLabel"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={90}
              />
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#a8a29e',
                    fontSize: 13,
                  }}
                >
                  Sin vacantes para el filtro seleccionado
                </td>
              </tr>
            ) : (
              displayed.map((v, index) => {
                const country = getVacancyCountry(v.title)
                const c = COUNTRY_COLORS[country]
                const rowBg = index % 2 === 0 ? '#ffffff' : '#faf8f5'
                const hasStatusData = Object.keys(v.byStatus).length > 0

                return (
                  <tr
                    key={v.id}
                    style={{ background: rowBg, borderBottom: '1px solid #f0ece4' }}
                  >
                    {/* Vacante */}
                    <td
                      style={{
                        padding: '7px 12px',
                        color: '#1c1917',
                        fontWeight: 500,
                        maxWidth: 320,
                      }}
                    >
                      <span
                        title={v.title}
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.title}
                      </span>
                    </td>

                    {/* País */}
                    <td style={{ padding: '7px 12px' }}>
                      <span
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {country}
                      </span>
                    </td>

                    {/* Año */}
                    <td
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#78716c',
                      }}
                    >
                      {v.year ?? <span style={{ color: '#a8a29e' }}>—</span>}
                    </td>

                    {/* CVs */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#1c1917',
                        fontWeight: 600,
                      }}
                    >
                      {v.totalCandidates.toLocaleString('es-AR')}
                    </td>

                    {/* Contratados */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#1c1917',
                      }}
                    >
                      {v.hiredCount.toLocaleString('es-AR')}
                    </td>

                    {/* % Éxito */}
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      <SuccessRateBar rate={v.successRate} />
                    </td>

                    {/* % Éxito real */}
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      {v.ratioExitoContactados == null ? (
                        <span style={{ fontSize: 10, color: '#c8c4bb' }}>n/d</span>
                      ) : (() => {
                        const pct = Math.round(v.ratioExitoContactados * 100 * 10) / 10
                        const T = (v.ratioExitoThreshold ?? 0.06) * 100
                        const color = pct >= T ? '#16a34a' : pct >= T * 0.5 ? '#d97706' : '#dc2626'
                        return <span style={{ fontSize: 12, fontWeight: 600, color }}>{pct.toLocaleString('es-AR')}%</span>
                      })()}
                    </td>

                    {/* % Descarte */}
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      {v.ratioDescarte == null ? (
                        <span style={{ fontSize: 10, color: '#c8c4bb' }}>n/d</span>
                      ) : (() => {
                        const pct = Math.round(v.ratioDescarte * 100 * 10) / 10
                        const TD = (v.ratioDescarteThreshold ?? 0.50) * 100
                        const color = pct > TD ? '#dc2626' : pct > TD * 0.6 ? '#d97706' : '#9ca3af'
                        return <span style={{ fontSize: 12, fontWeight: pct > TD * 0.6 ? 600 : 400, color }}>{pct.toLocaleString('es-AR')}%</span>
                      })()}
                    </td>

                    {/* Dynamic status columns */}
                    {activeStatusCols.map((status) => {
                      const count = v.byStatus[status] ?? 0
                      return (
                        <td
                          key={status}
                          className="tabular-nums"
                          style={{ padding: '7px 12px', textAlign: 'right' }}
                        >
                          {hasStatusData ? (
                            <span style={{ color: count > 0 ? statusColor(status) : '#c8c4bb', fontWeight: count > 0 ? 600 : 400 }}>
                              {count > 0 ? count : '—'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: '#c8c4bb' }}>n/d</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Pico */}
                    <td
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#78716c',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.peakWeekLabel ?? <span style={{ color: '#a8a29e' }}>—</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Ver más */}
      {!showAll && sorted.length > PAGE && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e7e2d8',
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              fontSize: 12,
              color: '#1e4b9e',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Ver las {sorted.length - PAGE} vacantes restantes ↓
          </button>
        </div>
      )}
    </div>
  )
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: '1 1 160px',
              background: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: 12,
              padding: '14px 20px',
              boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
            }}
          >
            <div
              style={{ width: 120, height: 12, background: '#f0ece4', borderRadius: 4 }}
              className="animate-pulse"
            />
            <div
              style={{
                width: 80,
                height: 28,
                background: '#f0ece4',
                borderRadius: 4,
                marginTop: 8,
              }}
              className="animate-pulse"
            />
          </div>
        ))}
      </div>

      {/* Bar chart placeholder */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        }}
      >
        <div
          style={{ height: 220, background: '#faf8f5', borderRadius: 8 }}
          className="animate-pulse"
        />
      </div>

      {/* Two columns */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div
          style={{
            flex: '3 1 340px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          <div
            style={{ height: 360, background: '#faf8f5', borderRadius: 8 }}
            className="animate-pulse"
          />
        </div>
        <div
          style={{
            flex: '2 1 220px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          <div
            style={{ height: 300, background: '#faf8f5', borderRadius: 8 }}
            className="animate-pulse"
          />
        </div>
      </div>

      {/* Table placeholder */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        }}
      >
        <div
          style={{ height: 280, background: '#faf8f5', borderRadius: 8 }}
          className="animate-pulse"
        />
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  profesionFilter?: TipoProfesional | 'todos'
  countryFilter?: VacancyCountry | 'todos'
}

export default function ClosedVacancyCvsView({ profesionFilter = 'todos', countryFilter = 'todos' }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ClosedVacanciesUnifiedData | null>(null)
  const [backfillState, setBackfillState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [backfillResult, setBackfillResult] = useState<{ updated: number; skipped: number; errors: number; total: number } | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'todos'>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  async function runBackfill() {
    setBackfillState('running')
    try {
      const res = await fetch('/api/admin/do-backfill', { method: 'POST' })
      const text = await res.text()
      console.log('[backfill] status:', res.status, 'body:', text)
      if (!res.ok) {
        console.error('[backfill] error response:', text)
        setBackfillState('error')
        return
      }
      const json = JSON.parse(text)
      setBackfillResult(json)
      setBackfillState('done')
    } catch (err) {
      console.error('[backfill] fetch/parse error:', err)
      setBackfillState('error')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const result = await getClosedVacanciesUnified(52)
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const clearTags = useCallback(() => setSelectedTags(new Set()), [])

  if (loading) return <LoadingSkeleton />
  if (!data) return null

  // Available years from byYear, sorted desc
  const availableYears = Object.keys(data.byYear)
    .map(Number)
    .sort((a, b) => b - a)

  // Apply year filter first
  const afterYear =
    selectedYear === 'todos'
      ? data.vacancies
      : data.vacancies.filter((v) => v.year === selectedYear)

  // Apply profesion + country filters
  const filteredVacancies = afterYear.filter((v) => {
    if (profesionFilter !== 'todos' && deriveProfesionTipo(v.title) !== profesionFilter) return false
    if (countryFilter !== 'todos' && getVacancyCountry(v.title) !== countryFilter) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* A — KPI strip */}
      <KpiStrip kpis={data.kpis} />

      {/* Year filter pills */}
      {availableYears.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <PillButton active={selectedYear === 'todos'} onClick={() => setSelectedYear('todos')}>
            Todos
          </PillButton>
          {availableYears.map((year) => (
            <PillButton
              key={year}
              active={selectedYear === year}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </PillButton>
          ))}
        </div>
      )}

      {/* Tags analysis section */}
      <TagsSection
        vacancies={filteredVacancies}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
      />

      {/* TEMPORAL — backfill hired_count desde Zoho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 10 }}>
        <span style={{ fontSize: 12, color: '#92400e' }}>
          🔧 <strong>Admin:</strong> Repoblar <code>hired_count</code> desde Zoho para vacantes cerradas con 0
        </span>
        <button
          onClick={runBackfill}
          disabled={backfillState === 'running' || backfillState === 'done'}
          style={{
            padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: backfillState === 'running' || backfillState === 'done' ? 'not-allowed' : 'pointer',
            background: backfillState === 'done' ? '#16a34a' : backfillState === 'error' ? '#dc2626' : '#1e4b9e',
            color: '#fff', border: 'none', flexShrink: 0,
          }}
        >
          {backfillState === 'idle' && '▶ Ejecutar backfill'}
          {backfillState === 'running' && '⏳ Ejecutando (~50s)…'}
          {backfillState === 'done' && `✓ Hecho — ${backfillResult?.updated} actualizadas`}
          {backfillState === 'error' && '✗ Error — abrí DevTools (F12) → Console'}
        </button>
        {backfillState === 'done' && backfillResult && (
          <span style={{ fontSize: 11, color: '#78716c' }}>
            Total: {backfillResult.total} · Actualizadas: {backfillResult.updated} · Sin dato en Zoho: {backfillResult.skipped} · Errores: {backfillResult.errors}
          </span>
        )}
      </div>

      {/* D — vacancy table */}
      <VacancyTable
        vacancies={filteredVacancies}
        allStatuses={data.allStatuses}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTags={selectedTags}
      />
    </div>
  )
}
