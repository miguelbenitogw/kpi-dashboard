'use client'

import { useEffect, useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { getDropoutsWithTags } from '@/lib/queries/dropouts'
import type { DropoutRow } from '@/lib/queries/dropouts'
import DropoutsKpiBanner from './DropoutsKpiBanner'
import DropoutsFilters from './DropoutsFilters'
import type { DropoutFilters, FilterOption } from './DropoutsFilters'
import DropoutsCharts from './DropoutsCharts'
import DropoutsTable from './DropoutsTable'

const EMPTY_FILTERS: DropoutFilters = {
  search: '',
  promos: [],
  reasons: [],
  languageLevels: [],
  interests: [],
  tags: [],
  nationalities: [],
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ height: 72, borderRadius: 10, background: '#f5f1ea', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
      <div style={{ height: 40, borderRadius: 8, background: '#f5f1ea' }} />
      <div style={{ height: 260, borderRadius: 12, background: '#f5f1ea' }} />
    </div>
  )
}

export default function DropoutsView() {
  const [allDropouts, setAllDropouts] = useState<DropoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DropoutFilters>(EMPTY_FILTERS)
  const [chartsOpen, setChartsOpen] = useState(true)

  useEffect(() => {
    getDropoutsWithTags().then((data) => {
      setAllDropouts(data)
      setLoading(false)
    })
  }, [])

  // Filtered rows
  const filtered = useMemo(() => {
    return allDropouts.filter((d) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const nameMatch = d.full_name?.toLowerCase().includes(q) ?? false
        const emailMatch = d.email?.toLowerCase().includes(q) ?? false
        if (!nameMatch && !emailMatch) return false
      }
      if (filters.promos.length > 0 && !filters.promos.includes(d.promocion_nombre ?? ''))
        return false
      if (
        filters.reasons.length > 0 &&
        !filters.reasons.includes(d.dropout_reason ?? 'Sin motivo')
      )
        return false
      if (
        filters.languageLevels.length > 0 &&
        !filters.languageLevels.includes(d.dropout_language_level ?? 'Sin dato')
      )
        return false
      if (
        filters.interests.length > 0 &&
        !filters.interests.includes(d.dropout_interest_future ?? 'Sin dato')
      )
        return false
      if (
        filters.nationalities.length > 0 &&
        !filters.nationalities.includes(d.nationality ?? 'Sin dato')
      )
        return false
      if (filters.tags.length > 0 && !filters.tags.some((t) => d.tags.includes(t)))
        return false
      return true
    })
  }, [allDropouts, filters])

  // Options derived from allDropouts, counts from filtered
  const options = useMemo(() => {
    function buildOpts(
      getter: (d: DropoutRow) => string,
      source: DropoutRow[],
      filtered: DropoutRow[]
    ): FilterOption[] {
      const all = new Set(source.map(getter))
      return Array.from(all)
        .sort()
        .map((value) => ({
          value,
          label: value,
          count: filtered.filter((d) => getter(d) === value).length,
        }))
    }

    const promos = buildOpts(
      (d) => d.promocion_nombre ?? '',
      allDropouts.filter((d) => d.promocion_nombre),
      filtered
    )
    const reasons = buildOpts(
      (d) => d.dropout_reason ?? 'Sin motivo',
      allDropouts,
      filtered
    )
    const languageLevels = buildOpts(
      (d) => d.dropout_language_level ?? 'Sin dato',
      allDropouts,
      filtered
    )
    const interests = buildOpts(
      (d) => d.dropout_interest_future ?? 'Sin dato',
      allDropouts,
      filtered
    )
    const nationalities = buildOpts(
      (d) => d.nationality ?? 'Sin dato',
      allDropouts,
      filtered
    )

    // Tags — unique across all dropouts
    const allTagSet = new Set<string>()
    for (const d of allDropouts) d.tags.forEach((t) => allTagSet.add(t))
    const tags: FilterOption[] = Array.from(allTagSet)
      .sort()
      .map((tag) => ({
        value: tag,
        label: tag,
        count: filtered.filter((d) => d.tags.includes(tag)).length,
      }))

    return { promos, reasons, languageLevels, interests, tags, nationalities }
  }, [allDropouts, filtered])

  if (loading) return <Skeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DropoutsKpiBanner rows={filtered} />

      <DropoutsFilters
        filters={filters}
        options={options}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {/* Charts — collapsible */}
      <div style={{ borderRadius: 12, border: '1px solid #e7e2d8', background: '#ffffff', overflow: 'hidden' }}>
        <button
          onClick={() => setChartsOpen((o) => !o)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 500,
            color: '#1c1917',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>Gráficos</span>
          {chartsOpen ? (
            <ChevronUp style={{ width: 16, height: 16, color: '#78716c' }} />
          ) : (
            <ChevronDown style={{ width: 16, height: 16, color: '#78716c' }} />
          )}
        </button>
        {chartsOpen && (
          <div style={{ borderTop: '1px solid #e7e2d8', padding: 12 }}>
            <DropoutsCharts rows={filtered} />
          </div>
        )}
      </div>

      <DropoutsTable rows={filtered} />
    </div>
  )
}
