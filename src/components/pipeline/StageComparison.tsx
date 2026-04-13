'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { StageAvgTime } from '@/lib/queries/pipeline'

interface StageComparisonProps {
  vacancy: StageAvgTime[]
  global: StageAvgTime[]
}

export default function StageComparison({
  vacancy,
  global,
}: StageComparisonProps) {
  // Merge both datasets by stage
  const stageSet = new Set([
    ...vacancy.map((v) => v.stage),
    ...global.map((g) => g.stage),
  ])

  const vacMap = new Map(vacancy.map((v) => [v.stage, v.avgDays]))
  const globMap = new Map(global.map((g) => [g.stage, g.avgDays]))

  const chartData = Array.from(stageSet)
    .map((stage) => ({
      stage,
      vacancy: vacMap.get(stage) ?? 0,
      global: globMap.get(stage) ?? 0,
    }))
    .filter((d) => d.vacancy > 0 || d.global > 0)
    .sort((a, b) => b.vacancy - a.vacancy)
    .slice(0, 15) // Top 15 stages for readability

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-gray-500">
        No stage history data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          axisLine={{ stroke: '#4b5563' }}
          tickLine={{ stroke: '#4b5563' }}
          label={{
            value: 'Avg Days',
            position: 'insideBottomRight',
            offset: -5,
            fill: '#6b7280',
            fontSize: 11,
          }}
        />
        <YAxis
          type="category"
          dataKey="stage"
          width={160}
          tick={{ fill: '#d1d5db', fontSize: 12 }}
          axisLine={{ stroke: '#4b5563' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#f3f4f6',
            fontSize: '13px',
          }}
          formatter={((value: number, name: string) => [
            `${value} days`,
            name === 'vacancy' ? 'This vacancy' : 'Global avg',
          ]) as any}
        />
        <Legend
          formatter={(value: string) =>
            value === 'vacancy' ? 'This Vacancy' : 'Global Average'
          }
          wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }}
        />
        <Bar
          dataKey="vacancy"
          fill="#3b82f6"
          radius={[0, 4, 4, 0]}
          barSize={14}
        />
        <Bar
          dataKey="global"
          fill="#6b7280"
          radius={[0, 4, 4, 0]}
          barSize={14}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
