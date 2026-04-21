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

const trafficLightRing: Record<string, string> = {
  good: 'ring-emerald-500',
  warning: 'ring-amber-500',
  danger: 'ring-red-500',
}

const trafficLightBorder: Record<string, string> = {
  good: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
}

interface Props {
  selectedPromos: string[]
  onToggle: (nombre: string) => void
  onSelectAll: () => void
}

export default function RetentionOverview({
  selectedPromos,
  onToggle,
  onSelectAll,
}: Props) {
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

  // Compute aggregates for summary bar (based on selection or all)
  const visiblePromos =
    selectedPromos.length > 0
      ? promos.filter((p) => selectedPromos.includes(p.nombre))
      : promos

  const totalObjetivo = visiblePromos.reduce((acc, p) => acc + p.objetivo, 0)
  const totalActual = visiblePromos.reduce((acc, p) => acc + p.actual, 0)
  const totalDropouts = visiblePromos.reduce((acc, p) => acc + p.dropouts, 0)
  const overallRatio = totalObjetivo > 0 ? totalActual / totalObjetivo : 0
  const overallPct = Math.round(overallRatio * 100)

  const hasSelection = selectedPromos.length > 0

  return (
    <div className="space-y-4">
      {/* ── Summary bar ── */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">
            Retención Global
            {hasSelection && (
              <span className="ml-2 text-xs font-normal text-blue-400">
                ({selectedPromos.length} promo{selectedPromos.length !== 1 ? 's' : ''} seleccionada{selectedPromos.length !== 1 ? 's' : ''})
              </span>
            )}
          </h3>

          {hasSelection && (
            <button
              onClick={onSelectAll}
              className="text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline transition-colors"
            >
              Ver todas
            </button>
          )}
        </div>

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

      {/* ── Promo cards (selectable) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {promos.map((promo) => {
          const pct =
            promo.objetivo > 0
              ? Math.round((promo.actual / promo.objetivo) * 100)
              : 0
          const isSelected = selectedPromos.includes(promo.nombre)
          const isDimmed = hasSelection && !isSelected

          return (
            <button
              key={promo.id}
              onClick={() => onToggle(promo.nombre)}
              className={[
                'text-left rounded-xl border bg-gray-800/50 p-5 border-l-4 transition-all duration-200 cursor-pointer',
                trafficLightBorder[promo.trafficLight],
                isSelected
                  ? `ring-2 ${trafficLightRing[promo.trafficLight]} ring-offset-1 ring-offset-gray-900 brightness-110`
                  : 'border-gray-700/50',
                isDimmed ? 'opacity-40' : '',
                'hover:brightness-105 hover:border-gray-600/50',
              ]
                .filter(Boolean)
                .join(' ')}
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
                <div className="flex items-center gap-2">
                  {/* Selection indicator */}
                  {isSelected && (
                    <svg
                      className="h-3.5 w-3.5 text-blue-400 flex-shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <div
                    className={`h-3 w-3 flex-shrink-0 rounded-full ${trafficLightColor[promo.trafficLight]}`}
                  />
                </div>
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
            </button>
          )
        })}
      </div>
    </div>
  )
}
