'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import { getVacancyRecruitmentStats, getVacancyTagCountsMap, type VacancyRecruitmentStats } from '@/lib/queries/atraccion'
import { tagColor, TAG_LEGEND } from '@/lib/utils/tags'

const STATUS_COLORS: Record<string, string> = {
  'Hired': '#10B981',
  'Approved by client': '#34D399',
  'Interview in Progress': '#3B82F6',
  'Interview-Scheduled': '#60A5FA',
  'Interview to be Scheduled': '#93C5FD',
  'First Call': '#8B5CF6',
  'Second Call': '#A78BFA',
  'Check Interest': '#C4B5FD',
  'Associated': '#9CA3AF',
  'No Answer': '#EF4444',
  'Rejected': '#F87171',
  'Rejected by client': '#DC2626',
  'On Hold': '#F59E0B',
  'Not Valid': '#6B7280',
  'Waiting for Evaluation': '#7C3AED',
  'Offer-Declined': '#F97316',
  'Offer-Withdrawn': '#EA580C',
  'Next Project': '#06B6D4',
  'In Training out of GW': '#14B8A6',
  'Expelled': '#991B1B',
  'To Place': '#0EA5E9',
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem', fontSize: '11px', color: '#F3F4F6' },
  labelStyle: { color: '#F3F4F6', fontWeight: 600 as const },
  itemStyle: { color: '#D1D5DB' },
}

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? '#6B7280'
}

export default function VacancyStatusCharts() {
  const [data, setData] = useState<VacancyRecruitmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tagData, setTagData] = useState<{ tag: string; count: number }[]>([])

  useEffect(() => {
    getVacancyRecruitmentStats().then(async (d) => {
      setData(d)
      // Fetch tag counts for active vacancies
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

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-4 h-4 w-48 animate-pulse rounded bg-gray-700" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg bg-gray-700/40" />
          <div className="h-72 animate-pulse rounded-lg bg-gray-700/40" />
        </div>
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5 text-center">
        <p className="text-sm text-gray-500">Sin vacantes activas</p>
      </div>
    )
  }

  // Aggregate total per status across all vacancies
  const totalByStatus = new Map<string, number>()
  for (const row of data.rows) {
    for (const [status, count] of Object.entries(row.byStatus)) {
      totalByStatus.set(status, (totalByStatus.get(status) ?? 0) + count)
    }
  }

  // Chart A data: top 12 statuses sorted desc
  const chartAData = [...totalByStatus.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([status, count]) => ({ status, count }))

  // Top 8 statuses for stacked chart
  const top8 = [...totalByStatus.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([s]) => s)

  // Chart B data: per vacancy, with only top8 statuses
  const chartBData = data.rows.map(row => {
    const entry: Record<string, string | number> = {
      title: row.title.length > 30 ? row.title.slice(0, 30) + '…' : row.title
    }
    for (const s of top8) entry[s] = row.byStatus[s] ?? 0
    return entry
  })

  const chartBHeight = Math.max(300, data.rows.length * 50)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-200">Distribución de estados</h2>
      <p className="mb-3 text-xs text-gray-500">Candidatos activos en procesos de atracción</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Chart A: Global distribution */}
        <div>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">Global</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAData} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#374151' }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="status" width={180} tick={{ fill: '#D1D5DB', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartAData.map(entry => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Per vacancy stacked */}
        <div>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">Por vacante</h3>
          <div style={{ height: chartBHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBData} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#374151' }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="title" width={220} tick={{ fill: '#D1D5DB', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#9CA3AF', paddingTop: '12px' }} />
                {top8.map(status => (
                  <Bar key={status} dataKey={status} stackId="a" fill={statusColor(status)} radius={undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart C: Tag distribution for active vacancies */}
      {tagData.length > 0 && (
        <div className="mt-5 border-t border-gray-700/50 pt-4">
          <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Etiquetas de candidatos
          </h3>
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
          <p className="mb-3 text-xs text-gray-600">
            Total de candidatos con cada etiqueta en vacantes activas
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tagData} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#374151' }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="tag" width={180} tick={{ fill: '#D1D5DB', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
