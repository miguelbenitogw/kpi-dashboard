'use client'

import { useEffect, useState } from 'react'
import {
  getPromotionsFormacionOverview,
  type PromotionFormacionOverview,
} from '@/lib/queries/formacion'

const trafficLightColor: Record<string, string> = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

const trafficLightBorder: Record<string, string> = {
  good: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
}

export default function RetentionOverview() {
  const [promos, setPromos] = useState<PromotionFormacionOverview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getPromotionsFormacionOverview()
      setPromos(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
            />
          ))}
        </div>
      </div>
    )
  }

  if (promos.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6 text-center">
        <p className="text-sm text-gray-400">Sin promociones activas</p>
        <p className="text-xs text-gray-500">
          No hay datos de retencion disponibles
        </p>
      </div>
    )
  }

  const totalObjetivo = promos.reduce((acc, p) => acc + p.objetivo, 0)
  const totalActual = promos.reduce((acc, p) => acc + p.actual, 0)
  const totalDropouts = promos.reduce((acc, p) => acc + p.dropouts, 0)
  const overallRatio = totalObjetivo > 0 ? totalActual / totalObjetivo : 0
  const overallPct = Math.round(overallRatio * 100)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <h3 className="text-sm font-semibold text-gray-200">
          Retencion Global
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500">Objetivo total</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-50">
              {totalObjetivo.toLocaleString('es-AR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Retenidos</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">
              {totalActual.toLocaleString('es-AR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Bajas</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-400">
              {totalDropouts.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Cumplimiento</span>
            <span className="tabular-nums">{overallPct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-700">
            <div
              className={`h-full rounded-full transition-all ${
                overallRatio >= 1.0
                  ? 'bg-emerald-500'
                  : overallRatio >= 0.9
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {promos.map((promo) => {
          const pct =
            promo.objetivo > 0
              ? Math.round((promo.actual / promo.objetivo) * 100)
              : 0

          return (
            <div
              key={promo.id}
              className={`rounded-xl border border-gray-700/50 bg-gray-800/50 p-5 border-l-4 ${trafficLightBorder[promo.trafficLight]}`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-200">
                    {promo.nombre}
                  </p>
                  {promo.season && (
                    <p className="text-xs text-gray-500">{promo.season}</p>
                  )}
                </div>
                <div
                  className={`h-3 w-3 flex-shrink-0 rounded-full ${trafficLightColor[promo.trafficLight]}`}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Obj
                  </p>
                  <p className="text-sm font-bold tabular-nums text-gray-100">
                    {promo.objetivo.toLocaleString('es-AR')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Actual
                  </p>
                  <p className="text-sm font-bold tabular-nums text-emerald-400">
                    {promo.actual.toLocaleString('es-AR')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Bajas
                  </p>
                  <p className="text-sm font-bold tabular-nums text-red-400">
                    {promo.dropouts.toLocaleString('es-AR')}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className={`h-full rounded-full ${trafficLightColor[promo.trafficLight]}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] tabular-nums text-gray-500">
                  {pct}%
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
