'use client'

import { useState, useEffect, useCallback } from 'react'
import RendimientoPromoCard from '@/components/rendimiento/RendimientoPromoCard'
import PerformanceDetail from '@/components/rendimiento/PerformanceDetail'
import PromoComparisonView from '@/components/rendimiento/PromoComparisonView'
import { getPerformancePromos, type PromoSummaryCard } from '@/lib/queries/performance'

type ViewMode = 'detail' | 'compare'

// Loading skeletons
function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <div className="mb-2 h-4 w-3/4 rounded bg-gray-700/50" />
      <div className="mb-3 h-3 w-1/2 rounded bg-gray-700/50" />
      <div className="mb-3 h-8 w-16 rounded bg-gray-700/50" />
      <div className="flex gap-3">
        <div className="h-4 w-16 rounded bg-gray-700/50" />
        <div className="h-4 w-16 rounded bg-gray-700/50" />
        <div className="h-4 w-16 rounded bg-gray-700/50" />
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-700/50" />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-6 w-2/3 rounded bg-gray-700/50" />
        <div className="mt-2 h-4 w-1/3 rounded bg-gray-700/50" />
      </div>
      <div className="flex gap-1 rounded-lg bg-gray-800/80 p-1">
        <div className="h-8 flex-1 rounded-md bg-gray-700/50" />
        <div className="h-8 flex-1 rounded-md bg-gray-700/50" />
        <div className="h-8 flex-1 rounded-md bg-gray-700/50" />
      </div>
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
        <div className="mb-4 h-4 w-1/3 rounded bg-gray-700/50" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-gray-700/50" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RendimientoPage() {
  const [promos, setPromos] = useState<PromoSummaryCard[]>([])
  const [selectedPromo, setSelectedPromo] = useState<string | null>(null)
  const [checkedPromos, setCheckedPromos] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [loading, setLoading] = useState(true)

  const loadPromos = useCallback(async () => {
    try {
      const data = await getPerformancePromos()
      setPromos(data)
    } catch (err) {
      console.error('Error loading performance promos:', err)
    }
  }, [])

  useEffect(() => {
    loadPromos().finally(() => setLoading(false))
  }, [loadPromos])

  // Select a single promo (click)
  const handleSelect = (promocion: string) => {
    setSelectedPromo(promocion)
    setViewMode('detail')
  }

  // Toggle checkbox for multi-select
  const handleToggleCheck = (promocion: string) => {
    setCheckedPromos((prev) => {
      const next = new Set(prev)
      if (next.has(promocion)) {
        next.delete(promocion)
      } else {
        // Max 3 selected
        if (next.size >= 3) return prev
        next.add(promocion)
      }
      return next
    })
  }

  // Switch to comparison view
  const handleCompare = () => {
    if (checkedPromos.size >= 2) {
      setViewMode('compare')
    }
  }

  // Back to detail view
  const handleBackToDetail = () => {
    setViewMode('detail')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-7 w-48 animate-pulse rounded bg-gray-700/50" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-700/50" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="lg:col-span-2">
            <DetailSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Rendimiento</h1>
          <p className="mt-1 text-gray-400">
            Rendimiento de promociones: estudiantes, bajas y conversion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checkedPromos.size >= 2 && viewMode === 'detail' && (
            <button
              type="button"
              onClick={handleCompare}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Comparar ({checkedPromos.size})
            </button>
          )}
          {viewMode === 'compare' && (
            <button
              type="button"
              onClick={handleBackToDetail}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
            >
              Volver a detalle
            </button>
          )}
        </div>
      </div>

      {promos.length === 0 ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-400">
            No hay promos con datos
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Los datos aparecen cuando hay candidatos con promocion_nombre asignado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left panel: Promo cards */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Promociones ({promos.length})
              </h2>
              {checkedPromos.size > 0 && (
                <button
                  type="button"
                  onClick={() => setCheckedPromos(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Limpiar seleccion
                </button>
              )}
            </div>
            <div className="space-y-3">
              {promos.map((promo) => (
                <RendimientoPromoCard
                  key={promo.promocion}
                  promo={promo}
                  isSelected={selectedPromo === promo.promocion}
                  isChecked={checkedPromos.has(promo.promocion)}
                  onSelect={handleSelect}
                  onToggleCheck={handleToggleCheck}
                />
              ))}
            </div>
          </div>

          {/* Right panel: Detail or Comparison */}
          <div className="lg:col-span-2">
            {viewMode === 'compare' && checkedPromos.size >= 2 ? (
              <PromoComparisonView
                promociones={Array.from(checkedPromos)}
              />
            ) : selectedPromo ? (
              <PerformanceDetail promocion={selectedPromo} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/50">
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">
                    Selecciona una promocion para ver el detalle
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Usa los checkboxes para comparar 2-3 promos
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
