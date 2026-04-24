'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import type { DropoutRow } from '@/lib/queries/dropouts'

interface Props {
  rows: DropoutRow[]
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

const INTEREST_COLORS: Record<string, string> = {
  Yes: '#10B981',
  No: '#EF4444',
  'Does not know': '#F59E0B',
  'Sin dato': '#6B7280',
}

const REASON_PALETTE = [
  '#EF4444',
  '#F59E0B',
  '#8B5CF6',
  '#3B82F6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#6B7280',
]

const LEVEL_PALETTE = [
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
]

const PROMO_COLOR = '#6366f1'

const TAG_COLORS: Record<string, string> = {
  FR: '#6366f1',
  CP: '#10b981',
  GW: '#a855f7',
}

function tagColor(tag: string): string {
  for (const [prefix, color] of Object.entries(TAG_COLORS)) {
    if (tag.startsWith(prefix)) return color
  }
  return '#6B7280'
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <p className="mb-3 text-xs font-semibold text-gray-300">{title}</p>
      {children}
    </div>
  )
}

export default function DropoutsCharts({ rows }: Props) {
  // 1. Motivos de baja
  const byReason = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.dropout_reason ?? 'Sin motivo'
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [rows])

  // 2. Nivel de idioma (donut)
  const byLevel = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.dropout_language_level ?? 'Sin dato'
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [rows])

  // 3. Interés futuro (donut)
  const byInterest = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.dropout_interest_future ?? 'Sin dato'
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [rows])

  // 4. Abandonos por promoción
  const byPromo = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = r.promocion_nombre ?? 'Sin promo'
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
        return numA - numB
      })
      .map(([name, count]) => ({ name, count }))
  }, [rows])

  // 5. Etiquetas
  const byTag = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      for (const tag of r.tags) {
        if (tag) map.set(tag, (map.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))
  }, [rows])

  // 6. StackedBar: nivel × motivo
  const { stackData, top5Reasons, reasonPaletteMap } = useMemo(() => {
    const reasonCounts = new Map<string, number>()
    for (const r of rows) {
      const k = r.dropout_reason ?? 'Sin motivo'
      reasonCounts.set(k, (reasonCounts.get(k) ?? 0) + 1)
    }
    const top5 = Array.from(reasonCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([r]) => r)

    const levelKeys = new Set<string>()
    for (const r of rows) levelKeys.add(r.dropout_language_level ?? 'Sin dato')

    const data = Array.from(levelKeys).map((level) => {
      const obj: Record<string, any> = { level }
      for (const reason of top5) {
        obj[reason] = rows.filter(
          (r) =>
            (r.dropout_language_level ?? 'Sin dato') === level &&
            (r.dropout_reason ?? 'Sin motivo') === reason
        ).length
      }
      obj['Otros'] = rows.filter(
        (r) =>
          (r.dropout_language_level ?? 'Sin dato') === level &&
          !top5.includes(r.dropout_reason ?? 'Sin motivo')
      ).length
      return obj
    })

    const allReasons = [...top5, 'Otros']
    const paletteMap: Record<string, string> = {}
    allReasons.forEach((r, i) => {
      paletteMap[r] = REASON_PALETTE[i % REASON_PALETTE.length]
    })

    return { stackData: data, top5Reasons: allReasons, reasonPaletteMap: paletteMap }
  }, [rows])

  const reasonHeight = Math.min(Math.max(120, byReason.length * 36), 280)
  const tagHeight = Math.min(Math.max(120, byTag.length * 36), 320)

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Sin datos para mostrar gráficos.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 1. Motivos de baja */}
      <ChartCard title="Motivos de baja">
        <ResponsiveContainer width="100%" height={reasonHeight}>
          <BarChart data={byReason} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {byReason.map((_, i) => (
                <Cell key={i} fill={REASON_PALETTE[i % REASON_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Nivel de idioma */}
      <ChartCard title="Nivel de idioma al abandonar">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={byLevel}
              dataKey="value"
              nameKey="name"
              outerRadius={80}
              innerRadius={42}
              label={({ name, percent }) =>
                `${name} ${Math.round((percent ?? 0) * 100)}%`
              }
              labelLine={false}
            >
              {byLevel.map((_, i) => (
                <Cell key={i} fill={LEVEL_PALETTE[i % LEVEL_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend
              formatter={(value) => (
                <span style={{ color: '#D1D5DB', fontSize: 11 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. Interés en proyectos futuros */}
      <ChartCard title="Interés en proyectos futuros">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={byInterest}
              dataKey="value"
              nameKey="name"
              outerRadius={80}
              innerRadius={42}
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {byInterest.map((entry, i) => (
                <Cell
                  key={i}
                  fill={INTEREST_COLORS[entry.name] ?? LEVEL_PALETTE[i % LEVEL_PALETTE.length]}
                />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend
              formatter={(value) => (
                <span style={{ color: '#D1D5DB', fontSize: 11 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. Abandonos por promoción */}
      <ChartCard title="Abandonos por promoción">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byPromo} margin={{ left: 0, right: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9CA3AF', fontSize: 9 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="count" fill={PROMO_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5. Etiquetas */}
      <ChartCard title="Etiquetas de los que abandonan">
        <ResponsiveContainer width="100%" height={tagHeight}>
          <BarChart data={byTag} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="tag"
              width={100}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {byTag.map((entry, i) => (
                <Cell key={i} fill={tagColor(entry.tag)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 6. Nivel de idioma × Motivo (stacked) */}
      <ChartCard title="Nivel de idioma × Motivo de baja">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stackData} margin={{ left: 0, right: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="level"
              tick={{ fill: '#9CA3AF', fontSize: 9 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend
              formatter={(value) => (
                <span style={{ color: '#D1D5DB', fontSize: 10 }}>{value}</span>
              )}
            />
            {top5Reasons.map((reason) => (
              <Bar
                key={reason}
                dataKey={reason}
                stackId="a"
                fill={reasonPaletteMap[reason]}
                radius={
                  reason === top5Reasons[top5Reasons.length - 1]
                    ? [3, 3, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
