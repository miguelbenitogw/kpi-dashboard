'use client'

import { useEffect, useState } from 'react'
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
} from 'recharts'
import {
  getDropoutAnalysis,
  type DropoutAnalysisData,
} from '@/lib/queries/formacion'

const REASON_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#8B5CF6',
  '#3B82F6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#6B7280',
]

const LEVEL_COLORS = [
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
]

const tooltipStyle = {
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: '#F3F4F6',
}

interface Props {
  promoNombres?: string[]
}

export default function DropoutAnalysis({ promoNombres }: Props) {
  const [data, setData] = useState<DropoutAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const filter = promoNombres && promoNombres.length > 0 ? promoNombres : undefined
    getDropoutAnalysis(filter).then((result) => {
      setData(result)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(promoNombres)])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.totalDropouts === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
        <p className="text-sm text-gray-400">Sin datos de abandonos</p>
        <p className="text-xs text-gray-500">
          No hay bajas registradas en formacion
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <h3 className="text-sm font-semibold text-gray-200">
          Analisis de Abandonos
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500">Total bajas</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-400">
              {data.totalDropouts.toLocaleString('es-AR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tasa de abandono</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-orange-400">
              {data.dropoutRate}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.byWeek.length > 0 && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Bajas por Semana
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.byWeek}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                    label={{
                      value: 'Semana',
                      position: 'insideBottom',
                      offset: -2,
                      fill: '#6B7280',
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={((value: number) => [
                      value.toLocaleString('es-AR'),
                      'Bajas',
                    ]) as any}
                    labelFormatter={(label) => `Semana ${label}`}
                  />
                  <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.byMonth.length > 0 && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Bajas por Mes
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.byMonth}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={((value: number) => [
                      value.toLocaleString('es-AR'),
                      'Bajas',
                    ]) as any}
                  />
                  <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.byLanguageLevel.length > 0 && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Bajas por Nivel de Idioma
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byLanguageLevel}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                    paddingAngle={2}
                    label={({ payload }: any) => `${payload.level} (${payload.count})`}
                    labelLine={{ stroke: '#4B5563' }}
                  >
                    {data.byLanguageLevel.map((_, i) => (
                      <Cell
                        key={i}
                        fill={LEVEL_COLORS[i % LEVEL_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={((value: number) => [
                      value.toLocaleString('es-AR'),
                      'Bajas',
                    ]) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.byReason.length > 0 && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Bajas por Motivo
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.byReason}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
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
                    dataKey="reason"
                    tick={{ fill: '#D1D5DB', fontSize: 10 }}
                    width={130}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#F3F4F6' }}
                    formatter={((value: number) => [
                      value.toLocaleString('es-AR'),
                      'Bajas',
                    ]) as any}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.byReason.map((_, i) => (
                      <Cell
                        key={i}
                        fill={REASON_COLORS[i % REASON_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
