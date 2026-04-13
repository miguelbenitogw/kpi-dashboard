'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PipelineStatusCount } from '@/lib/queries/pipeline'

const PHASES: Record<string, { statuses: string[]; color: string; label: string }> = {
  prospecting: {
    label: 'Prospecting',
    color: '#3b82f6',
    statuses: ['Associated', 'Check Interest', 'First Call', 'Second Call', 'No Answer', 'No Show'],
  },
  interview: {
    label: 'Interview',
    color: '#8b5cf6',
    statuses: [
      'Interview to be Scheduled',
      'Interview-Scheduled',
      'Interview in Progress',
      'Waiting for Evaluation',
      'Waiting for Consensus',
    ],
  },
  decision: {
    label: 'Decision',
    color: '#f59e0b',
    statuses: ['Approved by client', 'Hired', 'Rejected', 'Offer Declined', 'Offer Withdrawn'],
  },
  training: {
    label: 'Training',
    color: '#10b981',
    statuses: ['In Training', 'In Training out of GW', 'Training Finished'],
  },
  placement: {
    label: 'Placement',
    color: '#06b6d4',
    statuses: ['To Place', 'Assigned', 'Transferred'],
  },
  other: {
    label: 'Other',
    color: '#6b7280',
    statuses: ['On Hold', 'Next Project', 'Stand By', 'Expelled'],
  },
}

function getPhaseForStatus(status: string): string {
  for (const [key, phase] of Object.entries(PHASES)) {
    if (phase.statuses.includes(status)) return key
  }
  return 'other'
}

interface PipelineChartProps {
  data: PipelineStatusCount[]
}

export default function PipelineChart({ data }: PipelineChartProps) {
  // Build a single row with phase keys as fields
  const phaseCounts: Record<string, number> = {}
  for (const phaseKey of Object.keys(PHASES)) {
    phaseCounts[phaseKey] = 0
  }
  for (const item of data) {
    const phase = getPhaseForStatus(item.status)
    phaseCounts[phase] = (phaseCounts[phase] ?? 0) + item.count
  }

  const chartData = [{ name: 'Pipeline', ...phaseCounts }]

  const total = data.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-gray-500">
        No candidates in this vacancy
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-100">{total}</span>
        <span className="text-sm text-gray-400">total candidates</span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={chartData} layout="vertical" barCategoryGap={0}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f3f4f6',
              fontSize: '13px',
            }}
            formatter={((value: number, name: string) => {
              const phase = PHASES[name as keyof typeof PHASES]
              return [value, phase?.label ?? name]
            }) as any}
          />
          {Object.entries(PHASES).map(([key, phase]) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="pipeline"
              fill={phase.color}
              radius={0}
              name={key}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Phase legend with breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(PHASES).map(([key, phase]) => {
          const count = phaseCounts[key] ?? 0
          if (count === 0) return null
          const statusBreakdown = data.filter(
            (d) => getPhaseForStatus(d.status) === key
          )
          return (
            <div key={key} className="group relative">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: phase.color }}
                />
                <span className="text-xs font-medium text-gray-300">
                  {phase.label}
                </span>
                <span className="text-xs font-semibold text-gray-100">
                  {count}
                </span>
              </div>
              {/* Hover tooltip with status breakdown */}
              <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden rounded-lg border border-gray-700 bg-gray-800 p-2 shadow-xl group-hover:block">
                {statusBreakdown.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center justify-between gap-4 whitespace-nowrap py-0.5 text-xs"
                  >
                    <span className="text-gray-400">{s.status}</span>
                    <span className="font-medium text-gray-200">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
