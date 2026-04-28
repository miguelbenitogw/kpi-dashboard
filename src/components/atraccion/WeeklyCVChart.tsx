'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  getWeeklyCVCountFromWeeklyTable,
  type WeeklyCVData,
} from '@/lib/queries/atraccion'

export default function WeeklyCVChart() {
  const [data, setData] = useState<WeeklyCVData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getWeeklyCVCountFromWeeklyTable(12)
      setData(result)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div
        style={{
          height: 320,
          borderRadius: 14,
          border: '1px solid #e7e2d8',
          background: '#ffffff',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    )
  }

  const hasData = data.some((d) => d.count > 0)

  if (!hasData) {
    return (
      <div
        style={{
          height: 320,
          borderRadius: 14,
          border: '1px solid #e7e2d8',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 28 }}>📭</span>
        <p style={{ fontSize: 13, color: '#a8a29e', margin: 0 }}>
          Sin datos de CVs semanales
        </p>
        <p style={{ fontSize: 11, color: '#c4b9a8', margin: 0 }}>
          Ejecutá el sync en /api/admin/sync-vacancy-cvs
        </p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.count, 0)
  const maxCount = Math.max(...data.map((d) => d.count))

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid #e7e2d8',
        background: '#ffffff',
        padding: '20px 20px 16px',
        boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#a8a29e',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            Últimas 12 semanas
          </p>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1c1917',
              margin: '3px 0 0',
              letterSpacing: '-0.01em',
            }}
          >
            CVs Recibidos por Semana
          </h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1e4b9e',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {total.toLocaleString('es-AR')}
          </span>
          <p style={{ fontSize: 11, color: '#a8a29e', margin: '2px 0 0' }}>
            total período
          </p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="#e7e2d8"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="week"
            tick={{ fill: '#a8a29e', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#a8a29e', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(28,25,23,0.08)',
              fontSize: 13,
            }}
            labelStyle={{ color: '#1c1917', fontWeight: 600 }}
            formatter={(value) => [
              Number(value).toLocaleString('es-AR'),
              'CVs',
            ]}
          />
          <Bar
            dataKey="count"
            fill="#1e4b9e"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Footer: peak week */}
      {maxCount > 0 && (
        <p
          style={{
            fontSize: 11,
            color: '#a8a29e',
            margin: '8px 0 0',
            textAlign: 'right',
          }}
        >
          Pico: {maxCount.toLocaleString('es-AR')} CVs
        </p>
      )}
    </div>
  )
}
