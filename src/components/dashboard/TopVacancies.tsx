'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { getTopVacancies } from '@/lib/queries/dashboard'

interface Vacancy {
  id: string
  title: string
  total_candidates: number | null
  hired_count: number | null
  client_name: string | null
  status: string | null
}

const BAR_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd']

export default function TopVacancies() {
  const [data, setData] = useState<Vacancy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const vacancies = await getTopVacancies(5)
      setData(vacancies)
      setLoading(false)
    }
    load()
  }, [])

  const chartData = data.map((v) => ({
    name: truncate(v.title, 25),
    fullTitle: v.title,
    candidatos: v.total_candidates ?? 0,
    contratados: v.hired_count ?? 0,
    cliente: v.client_name ?? '—',
  }))

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <h3 className="text-sm font-semibold text-gray-200">
        Top 5 Vacantes por Volumen
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Vacantes activas con mas candidatos
      </p>

      {loading ? (
        <div className="mt-4 flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-64 flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400">Sin datos</p>
          <p className="text-xs text-gray-500">
            Esperando sincronizacion de vacantes
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#374151"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={160}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f3f4f6',
                  }}
                  labelStyle={{ color: '#d1d5db', fontWeight: 600 }}
                  formatter={((value: number, name: string) => [
                    value,
                    name === 'candidatos' ? 'Candidatos' : 'Contratados',
                  ]) as any}
                  labelFormatter={((label: string, payload: any) => {
                    const item = payload?.[0]?.payload
                    return item?.fullTitle ?? label
                  }) as any}
                />
                <Bar
                  dataKey="candidatos"
                  name="candidatos"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mini table below chart */}
          <div className="mt-4 divide-y divide-gray-700/30">
            {data.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-gray-300 truncate">{v.title}</p>
                  <p className="text-gray-500">{v.client_name ?? '—'}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <p className="font-medium text-gray-200 tabular-nums">
                      {v.total_candidates ?? 0}
                    </p>
                    <p className="text-gray-500">candidatos</p>
                  </div>
                  <div>
                    <p className="font-medium text-emerald-400 tabular-nums">
                      {v.hired_count ?? 0}
                    </p>
                    <p className="text-gray-500">hired</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}
