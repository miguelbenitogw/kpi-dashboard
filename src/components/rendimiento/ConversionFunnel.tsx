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
  Cell,
  LabelList,
} from 'recharts'
import { getPromoConversionMetrics, type ConversionMetrics } from '@/lib/queries/performance'

interface ConversionFunnelProps {
  promocion: string
}

interface FunnelStage {
  name: string
  actual: number
  objective: number | null
  pctAchieved: number
  color: string
}

export default function ConversionFunnel({ promocion }: ConversionFunnelProps) {
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getPromoConversionMetrics(promocion)
      .then((data) => {
        if (!cancelled) setMetrics(data)
      })
      .catch((err) => {
        if (!cancelled) console.error('Error loading conversion metrics:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [promocion])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-64 rounded-xl bg-gray-800/50" />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-800/50" />
          ))}
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-8 text-center">
        <p className="text-sm text-gray-500">No se pudieron cargar las metricas</p>
      </div>
    )
  }

  const target = metrics.target
  const actual = metrics.actual

  const stages: FunnelStage[] = [
    {
      name: 'Obj. Atraccion',
      actual: actual.totalCandidates,
      objective: target?.objetivo_atraccion ?? null,
      pctAchieved: target?.objetivo_atraccion
        ? Math.round((actual.totalCandidates / target.objetivo_atraccion) * 100)
        : 100,
      color: '#6366F1',
    },
    {
      name: 'Aceptados',
      actual: actual.accepted,
      objective: target?.total_aceptados ?? null,
      pctAchieved: target?.total_aceptados
        ? Math.round((actual.accepted / target.total_aceptados) * 100)
        : 100,
      color: '#3B82F6',
    },
    {
      name: 'Comienzan',
      actual: actual.startedProgram,
      objective: target?.objetivo_programa ?? null,
      pctAchieved: target?.objetivo_programa
        ? Math.round((actual.startedProgram / target.objetivo_programa) * 100)
        : 100,
      color: '#06B6D4',
    },
    {
      name: 'Finalizan',
      actual: actual.finishedTraining,
      objective: target?.expectativa_finalizan ?? null,
      pctAchieved: target?.expectativa_finalizan
        ? Math.round((actual.finishedTraining / target.expectativa_finalizan) * 100)
        : 100,
      color: '#10B981',
    },
    {
      name: 'Hired',
      actual: actual.hired,
      objective: target?.contratos_firmados ?? null,
      pctAchieved: target?.contratos_firmados
        ? Math.round((actual.hired / target.contratos_firmados) * 100)
        : 100,
      color: '#22C55E',
    },
  ]

  const chartData = stages.map((s) => ({
    name: s.name,
    actual: s.actual,
    objective: s.objective ?? 0,
  }))

  return (
    <div className="space-y-5">
      {/* Funnel bar chart */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
          Funnel de Conversion
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#D1D5DB', fontSize: 11 }}
            />
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
            <Bar dataKey="objective" fill="#374151" radius={[4, 4, 0, 0]} name="Objetivo" />
            <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="Actual">
              {stages.map((stage, i) => (
                <Cell key={`cell-${i}`} fill={stage.color} />
              ))}
              <LabelList
                dataKey="actual"
                position="top"
                style={{ fill: '#E5E7EB', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stages.map((stage) => {
          const meetsObjective = stage.objective !== null ? stage.pctAchieved >= 100 : true
          return (
            <div
              key={stage.name}
              className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-3"
            >
              <p className="text-[11px] font-medium text-gray-400 truncate">
                {stage.name}
              </p>
              <p
                className="mt-1 text-xl font-bold tabular-nums"
                style={{ color: stage.color }}
              >
                {stage.actual}
              </p>
              {stage.objective !== null && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[11px] tabular-nums text-gray-500">
                    obj: {stage.objective}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                      meetsObjective
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {stage.pctAchieved}%
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Dropout indicator */}
      <div className="flex items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div>
          <p className="text-xs text-gray-500">Bajas totales</p>
          <p className="text-xl font-bold tabular-nums text-red-400">
            {actual.dropouts}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tasa de abandono</p>
          <p className="text-xl font-bold tabular-nums text-red-400">
            {metrics.rates.dropoutPct}%
          </p>
        </div>
      </div>
    </div>
  )
}
