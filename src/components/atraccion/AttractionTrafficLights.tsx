'use client'

import { useEffect, useState } from 'react'
import {
  getActivePromotions,
  getAttractionTrafficLight,
  type ActivePromotion,
  type TrafficLight,
} from '@/lib/queries/atraccion'

interface PromoWithLight {
  promo: ActivePromotion
  light: TrafficLight
}

const lightColors: Record<'good' | 'warning' | 'danger', string> = {
  good: 'bg-ok-500',
  warning: 'bg-warn-500',
  danger: 'bg-danger-500',
}

const lightGlow: Record<'good' | 'warning' | 'danger', string> = {
  good: 'shadow-ok-500/40',
  warning: 'shadow-warn-500/40',
  danger: 'shadow-danger-500/40',
}

export default function AttractionTrafficLights() {
  const [items, setItems] = useState<PromoWithLight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const promos = await getActivePromotions()

      const results = await Promise.all(
        promos.map(async (promo) => {
          const light = await getAttractionTrafficLight(promo.id)
          return { promo, light }
        }),
      )

      setItems(results)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-surface-700/60 bg-surface-850/60 p-5">
        <div className="h-5 w-40 rounded bg-surface-700/50" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-700/30" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-surface-700/60 bg-surface-850/60 p-5">
        <p className="text-sm text-gray-400">Sin promociones activas</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-850/60 p-5">
      <h2 className="mb-4 text-lg font-semibold text-gray-100">
        Semáforo Atracción
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Verde = objetivo cumplido · Amarillo = -10% · Rojo = -20% o peor
      </p>
      <div className="space-y-3">
        {items.map(({ promo, light }) => (
          <div
            key={promo.id}
            className="flex items-center gap-3 rounded-lg border border-surface-700/50 bg-surface-900 p-3 transition-colors hover:bg-surface-800/70"
          >
            {/* Traffic light circle */}
            <div
              className={`
                h-4 w-4 flex-shrink-0 rounded-full shadow-md
                ${lightColors[light.status]} ${lightGlow[light.status]}
              `}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-100">
                {promo.nombre}
              </p>
              <p className="text-xs text-gray-500">
                {light.current}/{light.target} aceptados
                {light.status !== 'good' && (
                  <span className="text-gray-400">
                    {' '}
                    &middot; {light.weeksLeft} sem, {light.requiredPerWeek}/sem
                    necesarios
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
