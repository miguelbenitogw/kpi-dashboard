'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { tagPrefix } from '@/lib/utils/tags'
import type { TagCount } from '@/lib/queries/etiquetas'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip the "FR ", "CP ", or "GW " prefix from a tag name for chart display. */
function stripPrefixLabel(tag: string): string {
  const stripped = tag.replace(/^(FR|CP|GW)\s*/i, '').trim()
  return stripped || tag
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PREFIX_CONFIG = [
  {
    prefix: 'FR' as const,
    title: 'Canal llegada CV',
    subtitle: 'Vía por la que llegó el candidato',
    color: '#6366f1',
    borderClass: 'border-indigo-500/30',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-400',
  },
  {
    prefix: 'CP' as const,
    title: 'Cómo nos conocieron',
    subtitle: 'Cómo supo de GlobalWorking',
    color: '#10b981',
    borderClass: 'border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
  },
  {
    prefix: 'GW' as const,
    title: 'Reclutador GW',
    subtitle: 'Reclutador asignado al candidato',
    color: '#a855f7',
    borderClass: 'border-purple-500/30',
    dotClass: 'bg-purple-500',
    textClass: 'text-purple-400',
  },
]

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

// ─── Custom bar label ─────────────────────────────────────────────────────────

function BarValueLabel(props: any) {
  const { x, y, width, height, value } = props
  if (!value) return null
  return (
    <text
      x={x + width + 5}
      y={y + height / 2}
      fill="#6B7280"
      fontSize={10}
      dominantBaseline="middle"
    >
      {typeof value === 'number' ? value.toLocaleString('es-AR') : value}
    </text>
  )
}

// ─── Single prefix card ───────────────────────────────────────────────────────

interface PrefixChartCardProps {
  title: string
  subtitle: string
  color: string
  borderClass: string
  dotClass: string
  textClass: string
  data: Array<{ label: string; count: number }>
}

function PrefixChartCard({
  title,
  subtitle,
  color,
  borderClass,
  dotClass,
  textClass,
  data,
}: PrefixChartCardProps) {
  const total = data.reduce((acc, d) => acc + d.count, 0)
  // Dynamic height: 36px per item, bounded [120, 340]
  const chartHeight = Math.min(Math.max(120, data.length * 36), 340)

  return (
    <div className={`rounded-xl border ${borderClass} bg-gray-800/50 p-5`}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <div>
            <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {data.length > 0 && (
          <span className={`shrink-0 text-xs tabular-nums ${textClass}`}>
            {total.toLocaleString('es-AR')} total
          </span>
        )}
      </div>

      {/* Chart or empty state */}
      {data.length === 0 ? (
        <div className="flex h-24 items-center justify-center">
          <p className="text-xs text-gray-600">Sin etiquetas de este tipo</p>
        </div>
      ) : (
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 4, right: 40, top: 2, bottom: 2 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: '#D1D5DB', fontSize: 11 }}
                width={95}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={
                  ((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as never
                }
              />
              <Bar
                dataKey="count"
                fill={color}
                radius={[0, 4, 4, 0]}
                label={<BarValueLabel />}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface TagPrefixChartsProps {
  allTags: TagCount[]
}

export default function TagPrefixCharts({ allTags }: TagPrefixChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {PREFIX_CONFIG.map((cfg) => {
        const data = allTags
          .filter((t) => tagPrefix(t.tag) === cfg.prefix)
          .map((t) => ({ label: stripPrefixLabel(t.tag), count: t.count }))
          .sort((a, b) => b.count - a.count)

        return (
          <PrefixChartCard
            key={cfg.prefix}
            title={cfg.title}
            subtitle={cfg.subtitle}
            color={cfg.color}
            borderClass={cfg.borderClass}
            dotClass={cfg.dotClass}
            textClass={cfg.textClass}
            data={data}
          />
        )
      })}
    </div>
  )
}
