'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import {
  getPlacementPreferenceCounts,
  type PlacementPreferenceCount,
} from '@/lib/queries/colocacion'

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

const PREFERENCE_DEFINITIONS: Record<string, string> = {
  Kommuner: 'Prefiere empleo fijo en municipios noruegos',
  Vikar: 'Prefiere empleo temporal (vikariato)',
  Vikar_Kommuner: 'Abierto a temporal y fijo',
  No_feedback: 'Sin respuesta sobre preferencia',
  Training_Vikar: 'Primero formación, luego temporal',
  Training_Kommuner_Fast: 'Formación rápida + municipios',
}

export default function PlacementPreference() {
  const [data, setData] = useState<PlacementPreferenceCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getPlacementPreferenceCounts()
      setData(result)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <h3 className="text-sm font-semibold text-gray-200">
        Preferencia de Colocación
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Distribución BA3-BF3: preferencia de placement por candidato
      </p>

      {loading ? (
        <div className="mt-4 flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-64 flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400">Sin datos</p>
          <p className="text-xs text-gray-500">
            Esperando datos de preferencia de placement
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="preference"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f3f4f6',
                  }}
                  formatter={((value: number, name: string) => [
                    `${value.toLocaleString('es-AR')} candidatos`,
                    name,
                  ]) as any}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Data table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="pb-2 text-left text-xs font-medium text-gray-400">
                    Preferencia
                  </th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-400">
                    Cantidad
                  </th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-400">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr
                    key={item.preference}
                    className="border-b border-gray-700/30"
                  >
                    <td className="flex items-center gap-2 py-2 text-gray-200">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      {item.preference}
                      <span
                        title={PREFERENCE_DEFINITIONS[item.preference] ?? ''}
                        className="cursor-help text-gray-500"
                      >
                        ℹ️
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-300">
                      {item.count.toLocaleString('es-AR')}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-400">
                      {item.percentage.toLocaleString('es-AR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
