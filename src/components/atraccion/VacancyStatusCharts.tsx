'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { getVacancyRecruitmentStats, getVacancyTagCountsMap, type VacancyRecruitmentStats } from '@/lib/queries/atraccion'
import { tagColor, TAG_LEGEND } from '@/lib/utils/tags'

// ---------------------------------------------------------------------------
// Status colour + stage grouping
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  'Hired':                       '#10B981',
  'Approved by client':          '#34D399',
  'Interview in Progress':       '#3B82F6',
  'Interview-Scheduled':         '#60A5FA',
  'Interview to be Scheduled':   '#93C5FD',
  'First Call':                  '#8B5CF6',
  'Second Call':                 '#A78BFA',
  'Check Interest':              '#C4B5FD',
  'Associated':                  '#9CA3AF',
  'No Answer':                   '#EF4444',
  'Rejected':                    '#F87171',
  'Rejected by client':          '#DC2626',
  'On Hold':                     '#F59E0B',
  'Not Valid':                   '#6B7280',
  'Waiting for Evaluation':      '#7C3AED',
  'Offer-Declined':              '#F97316',
  'Offer-Withdrawn':             '#EA580C',
  'Next Project':                '#06B6D4',
  'In Training out of GW':       '#14B8A6',
  'Expelled':                    '#991B1B',
  'To Place':                    '#0EA5E9',
}

// Stages for the stacked mini-bar per vacancy
const STAGE_GROUPS = [
  { key: 'hired',    label: 'Contratado',  color: '#10B981', statuses: ['Hired', 'Approved by client'] },
  { key: 'active',  label: 'En proceso',  color: '#3B82F6', statuses: ['Interview in Progress', 'Interview-Scheduled', 'Interview to be Scheduled', 'First Call', 'Second Call', 'Check Interest', 'Waiting for Evaluation'] },
  { key: 'hold',    label: 'En espera',   color: '#F59E0B', statuses: ['On Hold', 'Next Project', 'Associated', 'To Place'] },
  { key: 'ko',      label: 'Descartado',  color: '#EF4444', statuses: ['Rejected', 'Rejected by client', 'No Answer', 'Not Valid', 'Offer-Declined', 'Offer-Withdrawn', 'Expelled', 'No Show', 'In Training out of GW'] },
]

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? '#6B7280'
}

function stageForStatus(status: string): typeof STAGE_GROUPS[number] | null {
  return STAGE_GROUPS.find(g => g.statuses.includes(status)) ?? null
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
// Mini proportional bar per vacancy
// ---------------------------------------------------------------------------

function VacancyMiniBar({ byStatus }: { byStatus: Record<string, number> }) {
  const stageTotals = STAGE_GROUPS.map(g => ({
    ...g,
    total: g.statuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0),
  }))
  const grand = stageTotals.reduce((s, g) => s + g.total, 0)
  if (grand === 0) return <span style={{ fontSize: 10, color: '#c8c4bb' }}>—</span>

  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', width: '100%', background: '#f0ece4' }}>
      {stageTotals.filter(g => g.total > 0).map(g => (
        <div
          key={g.key}
          title={`${g.label}: ${g.total}`}
          style={{
            width: `${(g.total / grand) * 100}%`,
            background: g.color,
            transition: 'width 400ms ease',
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VacancyStatusCharts() {
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

  // ── Aggregate ──
  const totalByStatus = new Map<string, number>()
  let totalCandidates = 0
  for (const row of data.rows) {
    for (const [status, count] of Object.entries(row.byStatus)) {
      totalByStatus.set(status, (totalByStatus.get(status) ?? 0) + count)
      totalCandidates += count
    }
  }

  // KPI: hired, in-process, discarded
  const hired      = STAGE_GROUPS.find(g => g.key === 'hired')!.statuses.reduce((s, st) => s + (totalByStatus.get(st) ?? 0), 0)
  const active     = STAGE_GROUPS.find(g => g.key === 'active')!.statuses.reduce((s, st) => s + (totalByStatus.get(st) ?? 0), 0)
  const discarded  = STAGE_GROUPS.find(g => g.key === 'ko')!.statuses.reduce((s, st) => s + (totalByStatus.get(st) ?? 0), 0)

  // Chart A: top 12 statuses
  const chartAData = [...totalByStatus.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([status, count]) => ({ status, count }))

  return (
    <div style={{ border: '1px solid #e7e2d8', borderRadius: 12, padding: '18px 20px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Vacantes activas', value: data.rows.length, color: '#1e4b9e', sub: 'en atracción' },
          { label: 'Candidatos totales', value: totalCandidates.toLocaleString('es-AR'), color: '#1c1917', sub: 'en pipeline' },
          { label: 'En proceso', value: active.toLocaleString('es-AR'), color: '#3B82F6', sub: `${totalCandidates > 0 ? Math.round(active/totalCandidates*100) : 0}% del pipeline` },
          { label: 'Contratados', value: hired.toLocaleString('es-AR'), color: '#10B981', sub: `${totalCandidates > 0 ? Math.round(hired/totalCandidates*100) : 0}% conversión` },
        ].map(kpi => (
          <div key={kpi.label} style={{ border: '1px solid #e7e2d8', borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
            <p style={{ margin: '4px 0 2px', fontSize: '1.375rem', fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
            <p style={{ margin: 0, fontSize: 10, color: '#c8c4bb' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Etapas del pipeline (proporción global) ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline global</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {STAGE_GROUPS.map(g => {
              const tot = g.statuses.reduce((s, st) => s + (totalByStatus.get(st) ?? 0), 0)
              return (
                <span key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#78716c' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, display: 'inline-block' }} />
                  {g.label} · <strong>{tot}</strong>
                </span>
              )
            })}
          </div>
        </div>
        {/* Global proportional bar */}
        {(() => {
          const grand = STAGE_GROUPS.reduce((s, g) => s + g.statuses.reduce((ss, st) => ss + (totalByStatus.get(st) ?? 0), 0), 0)
          return (
            <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: '#f0ece4' }}>
              {STAGE_GROUPS.map(g => {
                const tot = g.statuses.reduce((s, st) => s + (totalByStatus.get(st) ?? 0), 0)
                return tot > 0 ? (
                  <div
                    key={g.key}
                    title={`${g.label}: ${tot}`}
                    style={{ width: `${(tot / grand) * 100}%`, background: g.color }}
                  />
                ) : null
              })}
            </div>
          )
        })()}
      </div>

      {/* ── Two-column: Chart A + Per-vacancy table ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Chart A: distribución por estado */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Por estado
          </p>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
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
                  width={170}
                  tick={{ fill: '#78716c', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#a8a29e', formatter: (v: number) => v > 0 ? v : '' }}>
                  {chartAData.map(entry => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-vacancy mini table */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Por vacante
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {data.rows
              .map(row => {
                const total = Object.values(row.byStatus).reduce((s, n) => s + n, 0)
                const rowHired   = STAGE_GROUPS.find(g => g.key === 'hired')!.statuses.reduce((s, st) => s + (row.byStatus[st] ?? 0), 0)
                const rowActive  = STAGE_GROUPS.find(g => g.key === 'active')!.statuses.reduce((s, st) => s + (row.byStatus[st] ?? 0), 0)
                return { ...row, total, rowHired, rowActive }
              })
              .sort((a, b) => b.total - a.total)
              .map(row => (
                <div key={row.id} style={{ padding: '8px 10px', border: '1px solid #f0ece4', borderRadius: 8, background: '#faf9f7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#1c1917', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {row.title.length > 35 ? row.title.slice(0, 35) + '…' : row.title}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#78716c' }}>
                        <strong style={{ color: '#1c1917' }}>{row.total}</strong> total
                      </span>
                      {row.rowHired > 0 && (
                        <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>✓ {row.rowHired}</span>
                      )}
                      {row.rowActive > 0 && (
                        <span style={{ fontSize: 10, color: '#3B82F6' }}>● {row.rowActive}</span>
                      )}
                    </div>
                  </div>
                  <VacancyMiniBar byStatus={row.byStatus} />
                </div>
              ))
            }
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {STAGE_GROUPS.map(g => (
              <span key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#a8a29e' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, display: 'inline-block' }} />
                {g.label}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ── Chart C: Tags ── */}
      {tagData.length > 0 && (
        <div style={{ borderTop: '1px solid #e7e2d8', paddingTop: 16 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Etiquetas de candidatos
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 10 }}>
            {TAG_LEGEND.map((l) => (
              <span key={l.prefix} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#78716c' }}>
                <span className={`h-2 w-2 rounded-full ${l.dotColor}`} />
                <span className={l.color} style={{ fontSize: 10 }}>{l.prefix}</span>
                <span style={{ fontSize: 10, color: '#a8a29e' }}>{l.label}</span>
              </span>
            ))}
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tagData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
                <XAxis type="number" tick={{ fill: '#a8a29e', fontSize: 10 }} axisLine={{ stroke: '#e7e2d8' }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="tag" width={180} tick={{ fill: '#78716c', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#a8a29e', formatter: (v: number) => v > 0 ? v : '' }}>
                  {tagData.map((entry) => (
                    <Cell key={entry.tag} fill={tagColor(entry.tag)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
