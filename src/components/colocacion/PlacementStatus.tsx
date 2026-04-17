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
import {
  getPlacementStatusCounts,
  type PlacementStatusCount,
} from '@/lib/queries/colocacion'

const STATUS_DEFINITIONS: Record<string, string> = {
  'Not ready to present': 'Candidato no listo para presentar a empleadores',
  'Working on it': 'En proceso de preparación de documentación',
  'Interview in process': 'En entrevista con empleador noruego',
  'Out/on boarding job': 'Incorporándose al puesto de trabajo',
  'Hired by Kommuner Fast': 'Contratado directamente por municipio',
  'Hired by Kommuner temporary': 'Contratado por municipio (temporal)',
  'Hired by agency': 'Contratado a través de agencia',
  Resign: 'Renuncia tras colocación',
  'Registration ready': 'Registro HPR completado, listo para trabajar',
  'Presented to an Agency': 'Presentado a una agencia de empleo',
}

function getStatusColor(status: string): string {
  if (status.startsWith('Hired')) return '#10b981' // emerald
  if (status === 'Resign') return '#ef4444' // red
  if (
    status === 'Interview in process' ||
    status === 'Working on it' ||
    status === 'Out/on boarding job'
  )
    return '#f59e0b' // amber
  return '#6366f1' // indigo
}

export default function PlacementStatus() {
  const [data, setData] = useState<PlacementStatusCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getPlacementStatusCounts()
      setData(result)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <h3 className="text-sm font-semibold text-gray-200">
        Status de Placement
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Distribución BG3-BP3: estado de colocación por candidato
      </p>

      {loading ? (
        <div className="mt-4 flex h-80 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-80 flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400">Sin datos</p>
          <p className="text-xs text-gray-500">
            Esperando datos de status de placement
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
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
                  dataKey="status"
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
                  formatter={((value: number) => [
                    `${value.toLocaleString('es-AR')} candidatos`,
                    'Cantidad',
                  ]) as any}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={getStatusColor(entry.status)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Data table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="pb-2 text-left text-xs font-medium text-gray-400">
                    Status
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
                {data.map((item) => (
                  <tr
                    key={item.status}
                    className="border-b border-gray-700/30"
                  >
                    <td className="flex items-center gap-2 py-2 text-gray-200">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: getStatusColor(item.status),
                        }}
                      />
                      {item.status}
                      <span
                        title={STATUS_DEFINITIONS[item.status] ?? ''}
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
