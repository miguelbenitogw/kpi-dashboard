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
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import {
  getFormacionStates,
  type FormacionStateRow,
} from '@/lib/queries/formacion'

const STATE_COLORS: Record<string, string> = {
  'Hired': '#10B981',
  'In Training': '#3B82F6',
  'Offer-Withdrawn': '#F59E0B',
  'Expelled': '#EF4444',
  'Transferred': '#8B5CF6',
  'To Place': '#06B6D4',
  'Assigned': '#22C55E',
  'Stand-by': '#6B7280',
  'Training Finished': '#14B8A6',
}

function getStateColor(status: string): string {
  return STATE_COLORS[status] ?? '#6B7280'
}

export default function FormacionStates() {
  const [data, setData] = useState<FormacionStateRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const states = await getFormacionStates()
      setData(states)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-700" />
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-gray-700/50" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
        <p className="text-sm text-gray-400">Sin datos de estados</p>
        <p className="text-xs text-gray-500">
          No hay candidatos en estados de formacion
        </p>
      </div>
    )
  }

  const total = data.reduce((acc, d) => acc + d.count, 0)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">
            Estados de Formacion
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Distribucion de candidatos por estado post-contrato
          </p>
        </div>
        <p className="text-sm tabular-nums text-gray-400">
          {total.toLocaleString('es-AR')} total
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="status"
                tick={{ fill: '#D1D5DB', fontSize: 11 }}
                width={120}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#F3F4F6',
                }}
                labelStyle={{ color: '#F3F4F6' }}
                itemStyle={{ color: '#D1D5DB' }}
                formatter={((value: number) => [
                  value.toLocaleString('es-AR'),
                  'Candidatos',
                ]) as any}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={getStateColor(entry.status)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                label={({ payload }: any) =>
                  `${payload.status}: ${payload.percentage}%`
                }
                labelLine={{ stroke: '#4B5563' }}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={getStateColor(entry.status)}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#F3F4F6',
                }}
                formatter={((value: number) => [
                  value.toLocaleString('es-AR'),
                  'Candidatos',
                ]) as any}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5 text-right">Cantidad</th>
              <th className="px-3 py-2.5 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {data.map((row) => (
              <tr key={row.status} className="transition hover:bg-gray-700/20">
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: getStateColor(row.status) }}
                    />
                    <span className="text-gray-200">{row.status}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-100">
                  {row.count.toLocaleString('es-AR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-400">
                  {row.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
