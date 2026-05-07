'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { getVacancyRecruitmentStats, getVacancyTagCountsMap, type VacancyRecruitmentStats } from '@/lib/queries/atraccion'
import { tagColor, tagPrefix } from '@/lib/utils/tags'
import { getVacancyCountry, type VacancyCountry } from '@/lib/utils/vacancy-country'

// ---------------------------------------------------------------------------
// Status groups — based on Manual de Atracción, Reclutamiento y Selección
// Orden en la barra: positivos → en progreso → en espera → negativos → neutros
// ---------------------------------------------------------------------------

const STATUS_GROUPS = [
  {
    key: 'positive',
    label: 'Positivos',
    color: '#10B981',
    colorLight: '#d1fae5',
    statuses: [
      'Hired',
      'Approved by client',
      'In Training',
      'To Place',
      'Assigned',
      'Training Finished',
      'Stand-by',
    ],
  },
  {
    key: 'inprogress',
    label: 'En entrevista',
    color: '#3B82F6',
    colorLight: '#dbeafe',
    statuses: [
      'Interview to be Scheduled',
      'Interview-Scheduled',
      'Waiting for Consensus',
      'Waiting for Evaluation',
    ],
  },
  {
    key: 'hold',
    label: 'En espera',
    color: '#F59E0B',
    colorLight: '#fef3c7',
    statuses: [
      'On Hold',
      'Check Interest',
      'Next Project',
      'First Call',
      'Second Call',
    ],
  },
  {
    key: 'negative',
    label: 'Descartados',
    color: '#EF4444',
    colorLight: '#fee2e2',
    statuses: [
      'Rejected',
      'Rejected by client',
      'No Answer',
      'No Show',
      'Offer-Declined',
      'Offer-Withdrawn',
      'Expelled',
      'Transferred',
      'Not in Norway/Germany',
      'In Training out of GW',
    ],
  },
  {
    key: 'neutral',
    label: 'Sin contactar',
    color: '#9CA3AF',
    colorLight: '#f3f4f6',
    statuses: [
      'Associated',
      'Not Valid',
      'New',
    ],
  },
] as const

type GroupKey = (typeof STATUS_GROUPS)[number]['key']

// Individual status colors (used in the "Por estado" chart)
const STATUS_COLORS: Record<string, string> = {
  // Positivos
  'Hired':                       '#059669',
  'Approved by client':          '#10B981',
  'In Training':                 '#34D399',
  'To Place':                    '#6EE7B7',
  'Assigned':                    '#A7F3D0',
  'Training Finished':           '#D1FAE5',
  'Stand-by':                    '#99F6E4',
  // En entrevista
  'Interview to be Scheduled':   '#93C5FD',
  'Interview-Scheduled':         '#60A5FA',
  'Waiting for Consensus':       '#3B82F6',
  'Waiting for Evaluation':      '#1D4ED8',
  // En espera
  'On Hold':                     '#FCD34D',
  'Check Interest':              '#F59E0B',
  'Next Project':                '#D97706',
  // Negativos
  'No Answer':                   '#FCA5A5',
  'No Show':                     '#F87171',
  'Offer-Declined':              '#EF4444',
  'Offer-Withdrawn':             '#DC2626',
  'Rejected':                    '#B91C1C',
  'Rejected by client':          '#991B1B',
  'Expelled':                    '#7F1D1D',
  'Transferred':                 '#C2410C',
  'Not in Norway/Germany':       '#EA580C',
  'In Training out of GW':       '#F97316',
  // Neutros
  'First Call':                  '#D1D5DB',
  'Second Call':                 '#9CA3AF',
  'Associated':                  '#6B7280',
  'Not Valid':                   '#4B5563',
  'New':                         '#E5E7EB',
}

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? '#9CA3AF'
}

function groupForStatus(status: string): typeof STATUS_GROUPS[number] | null {
  return STATUS_GROUPS.find(g => (g.statuses as readonly string[]).includes(status)) ?? null
}

// ---------------------------------------------------------------------------
// Tooltip (warm-themed)
// ---------------------------------------------------------------------------

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#fff',
    border: '1px solid #e7e2d8',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#1c1917',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  labelStyle: { color: '#1c1917', fontWeight: 600 },
  itemStyle: { color: '#78716c' },
}

// ---------------------------------------------------------------------------
// Segmented horizontal bar — shows all status groups proportionally
// ---------------------------------------------------------------------------

function SegmentedStatusBar({
  byStatus,
  height = 14,
  showLabels = false,
}: {
  byStatus: Record<string, number>
  height?: number
  showLabels?: boolean
}) {
  const groupTotals = STATUS_GROUPS.map(g => ({
    ...g,
    total: (g.statuses as readonly string[]).reduce((sum, s) => sum + (byStatus[s] ?? 0), 0),
  }))
  const grand = groupTotals.reduce((s, g) => s + g.total, 0)

  if (grand === 0) {
    return <span style={{ fontSize: 10, color: '#c8c4bb' }}>—</span>
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          height,
          borderRadius: 99,
          overflow: 'hidden',
          width: '100%',
          background: '#f0ece4',
        }}
      >
        {groupTotals.filter(g => g.total > 0).map(g => (
          <div
            key={g.key}
            title={`${g.label}: ${g.total} (${Math.round((g.total / grand) * 100)}%)`}
            style={{
              width: `${(g.total / grand) * 100}%`,
              background: g.color,
              transition: 'width 400ms ease',
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {groupTotals.filter(g => g.total > 0).map(g => (
            <span
              key={g.key}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#78716c' }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: g.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span>{g.label}</span>
              <strong style={{ color: '#1c1917' }}>{g.total}</strong>
              <span style={{ color: '#a8a29e' }}>({Math.round((g.total / grand) * 100)}%)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-vacancy mini bar (compact, no labels)
// ---------------------------------------------------------------------------

function VacancyMiniBar({ byStatus }: { byStatus: Record<string, number> }) {
  return <SegmentedStatusBar byStatus={byStatus} height={8} showLabels={false} />
}

// ---------------------------------------------------------------------------
// Status detail legend — grouped by category
// Shows all statuses that have count > 0, grouped and colored
// ---------------------------------------------------------------------------

function StatusDetailLegend({ byStatus }: { byStatus: Map<string, number> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {STATUS_GROUPS.map(g => {
        const items = (g.statuses as readonly string[])
          .map(s => ({ status: s, count: byStatus.get(s) ?? 0 }))
          .filter(item => item.count > 0)
          .sort((a, b) => b.count - a.count)

        if (items.length === 0) return null

        const groupTotal = items.reduce((s, i) => s + i.count, 0)

        return (
          <div key={g.key}>
            {/* Group header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                paddingBottom: 4,
                borderBottom: `2px solid ${g.colorLight}`,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: g.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#78716c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {g.label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  fontWeight: 600,
                  color: g.color,
                }}
              >
                {groupTotal}
              </span>
            </div>

            {/* Status items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {items.map(item => (
                <div
                  key={item.status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '3px 6px',
                    borderRadius: 5,
                    background: g.colorLight,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusColor(item.status),
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 10, color: '#44403c' }}>{item.status}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#1c1917', flexShrink: 0 }}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface VacancyStatusChartsProps {
  profesionFilter?: string
  countryFilter?: VacancyCountry | 'todos'
}

export default function VacancyStatusCharts({
  profesionFilter,
  countryFilter,
}: VacancyStatusChartsProps = {}) {
  const [data, setData] = useState<VacancyRecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tagData, setTagData] = useState<{ tag: string; count: number }[]>([])

  useEffect(() => {
    getVacancyRecruitmentStats().then(async (d) => {
      setData(d)
      const activeIds = (d?.rows ?? []).map(r => r.id)
      if (activeIds.length > 0) {
        const tagMap = await getVacancyTagCountsMap(activeIds)
        const totals = new Map<string, number>()
        for (const tags of tagMap.values()) {
          for (const [tag, count] of Object.entries(tags)) {
            totals.set(tag, (totals.get(tag) ?? 0) + count)
          }
        }
        const sorted = [...totals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([tag, count]) => ({ tag, count }))
        setTagData(sorted)
      }
      setLoading(false)
    })
  }, [])

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ border: '1px solid #e7e2d8', borderRadius: 12, padding: 20, background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 10, background: '#f5f1ea', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ height: 18, borderRadius: 99, background: '#f5f1ea', marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 260, borderRadius: 10, background: '#f5f1ea', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div style={{ border: '1px solid #e7e2d8', borderRadius: 12, padding: 20, background: '#fff', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#a8a29e' }}>Sin vacantes activas</p>
      </div>
    )
  }

  // ── Apply filters (client-side, no re-fetch needed) ──
  const filteredRows = data.rows.filter(row => {
    if (profesionFilter && profesionFilter !== 'todos' && row.tipoProfesional !== profesionFilter) return false
    if (countryFilter && countryFilter !== 'todos' && getVacancyCountry(row.title) !== countryFilter) return false
    return true
  })

  if (filteredRows.length === 0) {
    return (
      <div style={{ border: '1px solid #e7e2d8', borderRadius: 12, padding: 20, background: '#fff', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#a8a29e' }}>Sin vacantes para los filtros seleccionados</p>
      </div>
    )
  }

  // ── Aggregate totals ──
  const totalByStatus = new Map<string, number>()
  let totalCandidates = 0
  for (const row of filteredRows) {
    for (const [status, count] of Object.entries(row.byStatus)) {
      totalByStatus.set(status, (totalByStatus.get(status) ?? 0) + count)
      totalCandidates += count
    }
  }

  // KPI values by group
  const groupTotals = STATUS_GROUPS.map(g => ({
    ...g,
    total: (g.statuses as readonly string[]).reduce((s, st) => s + (totalByStatus.get(st) ?? 0), 0),
  }))

  const positiveTotal = groupTotals.find(g => g.key === 'positive')?.total ?? 0
  const inProgressTotal = groupTotals.find(g => g.key === 'inprogress')?.total ?? 0
  const negativeTotal = groupTotals.find(g => g.key === 'negative')?.total ?? 0

  // Chart: top 12 statuses by count
  const chartData = [...totalByStatus.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([status, count]) => ({ status, count }))

  return (
    <div
      style={{
        border: '1px solid #e7e2d8',
        borderRadius: 12,
        padding: '18px 20px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Vacantes activas', value: filteredRows.length, color: '#1e4b9e', sub: 'en atracción' },
          { label: 'Candidatos totales', value: totalCandidates.toLocaleString('es-AR'), color: '#1c1917', sub: 'en pipeline' },
          { label: 'En entrevista', value: inProgressTotal.toLocaleString('es-AR'), color: '#3B82F6', sub: `${totalCandidates > 0 ? Math.round(inProgressTotal / totalCandidates * 100) : 0}% del pipeline` },
          { label: 'Positivos', value: positiveTotal.toLocaleString('es-AR'), color: '#059669', sub: `${totalCandidates > 0 ? Math.round(positiveTotal / totalCandidates * 100) : 0}% conversión` },
        ].map(kpi => (
          <div key={kpi.label} style={{ border: '1px solid #e7e2d8', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {kpi.label}
            </p>
            <p style={{ margin: '4px 0 2px', fontSize: '1.375rem', fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
              {kpi.value}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: '#c8c4bb' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Global pipeline bar (segmented) ── */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Pipeline global · {totalCandidates.toLocaleString('es-AR')} candidatos
          </span>
        </div>
        <SegmentedStatusBar
          byStatus={Object.fromEntries(totalByStatus)}
          height={14}
          showLabels
        />
      </div>

      {/* ── Two-column: chart + per-vacancy table ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Left: top statuses bar chart */}
        <div>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Top estados (ranking)
          </p>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#a8a29e', fontSize: 10 }}
                  axisLine={{ stroke: '#e7e2d8' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={175}
                  tick={{ fill: '#78716c', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  label={{
                    position: 'right',
                    fontSize: 10,
                    fill: '#a8a29e',
                    formatter: ((v: string | number | null | undefined) =>
                      (typeof v === 'number' && v > 0) ? v : '') as never,
                  }}
                >
                  {chartData.map(entry => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: per-vacancy mini bars */}
        <div>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Por vacante
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {filteredRows
              .map(row => {
                const total = Object.values(row.byStatus).reduce((s, n) => s + n, 0)
                const rowPositive = (STATUS_GROUPS.find(g => g.key === 'positive')!.statuses as readonly string[]).reduce(
                  (s, st) => s + (row.byStatus[st] ?? 0),
                  0,
                )
                const rowProgress = (STATUS_GROUPS.find(g => g.key === 'inprogress')!.statuses as readonly string[]).reduce(
                  (s, st) => s + (row.byStatus[st] ?? 0),
                  0,
                )
                return { ...row, total, rowPositive, rowProgress }
              })
              .sort((a, b) => b.total - a.total)
              .map(row => (
                <div
                  key={row.id}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #f0ece4',
                    borderRadius: 8,
                    background: '#faf9f7',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: '#1c1917',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '70%',
                      }}
                    >
                      {row.title.length > 35 ? row.title.slice(0, 35) + '…' : row.title}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#78716c' }}>
                        <strong style={{ color: '#1c1917' }}>{row.total}</strong>
                      </span>
                      {row.rowPositive > 0 && (
                        <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>
                          ✓ {row.rowPositive}
                        </span>
                      )}
                      {row.rowProgress > 0 && (
                        <span style={{ fontSize: 10, color: '#3B82F6' }}>
                          ● {row.rowProgress}
                        </span>
                      )}
                    </div>
                  </div>
                  <VacancyMiniBar byStatus={row.byStatus} />
                </div>
              ))}
          </div>

          {/* Compact legend */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {STATUS_GROUPS.map(g => (
              <span
                key={g.key}
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#a8a29e' }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: g.color,
                    display: 'inline-block',
                  }}
                />
                {g.label}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ── Status detail by group (accordion-style legend) ── */}
      <div style={{ borderTop: '1px solid #e7e2d8', paddingTop: 16 }}>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 11,
            fontWeight: 600,
            color: '#78716c',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Desglose por estado
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {STATUS_GROUPS.map(g => {
            const items = (g.statuses as readonly string[])
              .map(s => ({ status: s, count: totalByStatus.get(s) ?? 0 }))
              .filter(item => item.count > 0)
              .sort((a, b) => b.count - a.count)

            if (items.length === 0) return null

            const groupTotal = items.reduce((s, i) => s + i.count, 0)

            return (
              <div
                key={g.key}
                style={{
                  border: '1px solid #e7e2d8',
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: '#faf9f7',
                }}
              >
                {/* Group header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: `2px solid ${g.colorLight}`,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: g.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#78716c',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {g.label}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      fontWeight: 700,
                      color: g.color,
                    }}
                  >
                    {groupTotal}
                  </span>
                </div>

                {/* Status rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {items.map(item => (
                    <div
                      key={item.status}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '2px 4px',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: statusColor(item.status),
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            color: '#57534e',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#1c1917', flexShrink: 0 }}>
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tags chart ── */}
      {tagData.length > 0 && (
        <div style={{ borderTop: '1px solid #e7e2d8', paddingTop: 16 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Etiquetas de candidatos
          </p>
          {(() => {
            const TAG_CATS = [
              { prefix: 'FR',       label: 'Canal llegada CV',      color: '#6366f1' },
              { prefix: 'CP',       label: 'Cómo nos conocieron',   color: '#10b981' },
              { prefix: 'GW',       label: 'Reclutador',            color: '#a855f7' },
              { prefix: 'MODALIDAD',label: 'Modalidad',             color: '#f59e0b' },
            ] as const
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {TAG_CATS.map(cat => {
                  const rows = tagData
                    .filter(d => tagPrefix(d.tag) === cat.prefix)
                    .sort((a, b) => b.count - a.count)
                  if (rows.length === 0) return null
                  const max = rows[0].count
                  const total = rows.reduce((s, r) => s + r.count, 0)
                  return (
                    <div key={cat.prefix} style={{ background: '#faf9f7', border: '1px solid #e7e2d8', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cat.color }}>{cat.prefix} — {cat.label}</span>
                        <span style={{ fontSize: 10, color: '#a8a29e' }}>{total.toLocaleString('es-AR')} total</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {rows.map(row => (
                          <div key={row.tag} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 130, fontSize: 10, color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={row.tag}>
                              {row.tag}
                            </div>
                            <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#ede9e4', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.max(2, Math.round((row.count / max) * 100))}%`, borderRadius: 99, background: cat.color, transition: 'width 0.3s ease' }} />
                            </div>
                            <div style={{ width: 36, fontSize: 10, fontWeight: 700, color: '#1c1917', textAlign: 'right', flexShrink: 0 }}>
                              {row.count.toLocaleString('es-AR')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

    </div>
  )
}
