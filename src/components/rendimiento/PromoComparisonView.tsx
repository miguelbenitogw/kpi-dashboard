'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getPromoComparison, type PromoComparisonItem } from '@/lib/queries/performance'

interface PromoComparisonViewProps {
  promociones: string[]
}

const PROMO_COLORS = ['#3B82F6', '#10B981', '#F59E0B']

export default function PromoComparisonView({ promociones }: PromoComparisonViewProps) {
  const [items, setItems] = useState<PromoComparisonItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getPromoComparison(promociones)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((err) => {
        if (!cancelled) console.error('Error loading comparison:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [promociones])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-64 rounded-xl bg-gray-800/50" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-800/50" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
        <p className="text-sm text-gray-500">No hay datos para comparar</p>
      </div>
    )
  }

  // Chart data for grouped comparison
  const chartData = [
    {
      metric: 'Total',
      ...Object.fromEntries(items.map((item) => [item.promocion, item.total])),
    },
    {
      metric: 'Hired',
      ...Object.fromEntries(items.map((item) => [item.promocion, item.hired])),
    },
    {
      metric: 'Bajas',
      ...Object.fromEntries(items.map((item) => [item.promocion, item.dropouts])),
    },
  ]

  // Find best/worst for highlighting
  const bestConversion = items.reduce((a, b) => (a.conversionPct > b.conversionPct ? a : b))
  const worstDropout = items.reduce((a, b) => (a.dropoutRate > b.dropoutRate ? a : b))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-100">Comparacion de Promos</h2>
        <p className="text-sm text-gray-500">
          {items.map((i) => i.promocion).join(' vs ')}
        </p>
      </div>

      {/* Grouped bar chart */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="metric" tick={{ fill: '#D1D5DB', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#F3F4F6' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#D1D5DB' }} />
            {items.map((item, i) => (
              <Bar
                key={item.promocion}
                dataKey={item.promocion}
                fill={PROMO_COLORS[i % PROMO_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side cards */}
      <div className={`grid gap-3 ${items.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {items.map((item, i) => {
          const isBestConversion = item.promocion === bestConversion.promocion
          const isWorstDropout = item.promocion === worstDropout.promocion && items.length > 1

          return (
            <div
              key={item.promocion}
              className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4"
            >
              {/* Header with color indicator */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: PROMO_COLORS[i % PROMO_COLORS.length] }}
                />
                <h3 className="text-sm font-semibold text-gray-100 truncate">
                  {item.promocion}
                </h3>
              </div>

              {item.coordinador && (
                <p className="mb-3 text-xs text-gray-500">{item.coordinador}</p>
              )}

              <div className="space-y-3">
                {/* Total */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total</span>
                  <span className="font-semibold tabular-nums text-gray-200">
                    {item.total}
                  </span>
                </div>

                {/* Hired */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Hired</span>
                  <span className="font-semibold tabular-nums text-green-400">
                    {item.hired}
                  </span>
                </div>

                {/* Conversion % */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Conversion</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      isBestConversion ? 'text-green-400' : 'text-gray-300'
                    }`}
                  >
                    {item.conversionPct}%
                    {isBestConversion && items.length > 1 && (
                      <span className="ml-1 text-[10px] text-green-500">mejor</span>
                    )}
                  </span>
                </div>

                {/* Dropouts */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Bajas</span>
                  <span className="font-semibold tabular-nums text-red-400">
                    {item.dropouts}
                  </span>
                </div>

                {/* Dropout rate */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tasa abandono</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      isWorstDropout ? 'text-red-400' : 'text-gray-300'
                    }`}
                  >
                    {item.dropoutRate}%
                    {isWorstDropout && items.length > 1 && (
                      <span className="ml-1 text-[10px] text-red-500">peor</span>
                    )}
                  </span>
                </div>

                {/* Objectives from target if available */}
                {item.target && (
                  <div className="mt-2 border-t border-gray-700/50 pt-2">
                    <p className="mb-1 text-[10px] font-medium uppercase text-gray-500">
                      Objetivos
                    </p>
                    {item.target.objetivo_atraccion != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Atraccion</span>
                        <span className="tabular-nums text-gray-400">
                          {item.target.objetivo_atraccion}
                        </span>
                      </div>
                    )}
                    {item.target.contratos_firmados != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Contratos</span>
                        <span className="tabular-nums text-gray-400">
                          {item.target.contratos_firmados}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
