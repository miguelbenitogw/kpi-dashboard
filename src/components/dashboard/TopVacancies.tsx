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
  approved_count: number
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
    <div
      className="rounded-xl p-4"
      style={{
        border: '1px solid #e7e2d8',
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04)',
      }}
    >
      <h3 className="text-sm font-semibold" style={{ color: '#1c1917' }}>
        Top 5 Vacantes por Volumen
      </h3>
      <p className="mt-1 text-xs" style={{ color: '#78716c' }}>
        Vacantes activas con mas candidatos
      </p>

      {loading ? (
        <div className="mt-3 flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#1e4b9e', borderTopColor: 'transparent' }} />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-64 flex-col items-center justify-center text-center">
          <p className="text-sm" style={{ color: '#57534e' }}>Sin datos</p>
          <p className="text-xs" style={{ color: '#78716c' }}>
            Esperando sincronizacion de vacantes
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e7e2d8"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  axisLine={{ stroke: '#e7e2d8' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#57534e' }}
                  axisLine={false}
                  tickLine={false}
                  width={160}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e7e2d8',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#1c1917',
                    boxShadow: '0 4px 12px rgba(28,25,23,0.08)',
                  }}
                  labelStyle={{ color: '#1c1917', fontWeight: 600 }}
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
          <div className="mt-3" style={{ borderTop: '1px solid #e7e2d8' }}>
            {data.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between py-2 text-xs"
                style={{ borderBottom: '1px solid #f0ece4' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ color: '#1c1917' }}>{v.title}</p>
                  <p style={{ color: '#78716c' }}>{v.client_name ?? '—'}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <p className="font-medium tabular-nums" style={{ color: '#1c1917' }}>
                      {v.total_candidates ?? 0}
                    </p>
                    <p style={{ color: '#78716c' }}>candidatos</p>
                  </div>
                  <div>
                    <p className="font-medium tabular-nums" style={{ color: '#16a34a' }}>
                      {v.hired_count ?? 0}
                    </p>
                    <p style={{ color: '#78716c' }}>hired</p>
                  </div>
                  {(() => {
                    const total = v.total_candidates ?? 0
                    if (total === 0) return null
                    const success = (v.hired_count ?? 0) + v.approved_count
                    const rate = Math.round((success / total) * 1000) / 10
                    const color = rate >= 15 ? '#16a34a' : rate >= 8 ? '#d97706' : '#9ca3af'
                    return (
                      <div>
                        <p className="font-medium tabular-nums" style={{ color }}>
                          {rate.toLocaleString('es-AR')}%
                        </p>
                        <p style={{ color: '#78716c' }}>éxito</p>
                      </div>
                    )
                  })()}
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
