'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getWeeklyCVCount, type WeeklyCVData } from '@/lib/queries/atraccion'
import { brandColors, chartTheme } from '@/lib/theme'

export default function WeeklyCVChart() {
  const [data, setData] = useState<WeeklyCVData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getWeeklyCVCount()
      setData(result)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="h-[350px] animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60" />
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-xl border border-surface-700/60 bg-surface-850/60">
        <p className="text-sm text-gray-400">Sin datos de CVs semanales</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-850/60 p-5">
      <h2 className="mb-4 text-lg font-semibold text-gray-100">
        CVs Recibidos por Semana
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <XAxis
            dataKey="week"
            tick={chartTheme.axis.tick}
            axisLine={chartTheme.axis.axisLine}
            tickLine={false}
          />
          <YAxis
            tick={chartTheme.axis.tick}
            axisLine={chartTheme.axis.axisLine}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={chartTheme.tooltip.contentStyle}
            labelStyle={chartTheme.tooltip.labelStyle}
            formatter={(value) => [
              Number(value).toLocaleString('es-AR'),
              'CVs',
            ]}
          />
          <Bar
            dataKey="count"
            fill={brandColors.brand[500]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
