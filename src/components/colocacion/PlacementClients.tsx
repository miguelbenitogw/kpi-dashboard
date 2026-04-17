'use client'

import { useEffect, useState } from 'react'
import {
  getPlacementClients,
  type PlacementClient,
} from '@/lib/queries/colocacion'

export default function PlacementClients() {
  const [data, setData] = useState<PlacementClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getPlacementClients()
      setData(result)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <h3 className="text-sm font-semibold text-gray-200">
        Clientes de Placement
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        BQ3: distribución de candidatos por cliente
      </p>

      {loading ? (
        <div className="mt-4 flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 flex h-48 flex-col items-center justify-center text-center">
          <p className="text-sm text-gray-400">Sin datos</p>
          <p className="text-xs text-gray-500">
            Esperando datos de clientes de placement
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="pb-2 text-left text-xs font-medium text-gray-400">
                  Cliente
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">
                  Candidatos
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr
                  key={item.client}
                  className="border-b border-gray-700/30"
                >
                  <td className="py-2 text-gray-200">{item.client}</td>
                  <td className="py-2 text-right tabular-nums text-gray-300">
                    {item.candidateCount.toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
