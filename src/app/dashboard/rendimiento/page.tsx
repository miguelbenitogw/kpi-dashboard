'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronDown, X, Loader2 } from 'lucide-react'
import PerformanceDetail from '@/components/rendimiento/PerformanceDetail'
import PromoComparisonView from '@/components/rendimiento/PromoComparisonView'
import GlobalDropoutAnalysis from '@/components/rendimiento/GlobalDropoutAnalysis'
import {
  getPerformancePromos,
  getPromoStudentList,
  type PromoSummaryCard,
  type StudentListResult,
} from '@/lib/queries/performance'
import type { Candidate } from '@/lib/supabase/types'

type ViewMode = 'detail' | 'compare'
type ActiveTab = 'rendimiento' | 'estudiantes' | 'bajas-globales'

// ---------------------------------------------------------------------------
// Status dot colour map (same palette as CandidatosFormacionView)
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  'In Training': '#3b82f6',
  'Hired': '#22c55e',
  'Offer-Withdrawn': '#ef4444',
  'Expelled': '#ef4444',
  'Stand-by': '#eab308',
  'Transferred': '#a855f7',
  'To Place': '#f97316',
  'Assigned': '#06b6d4',
  'Training Finished': '#6366f1',
}

function statusDotColor(status: string | null): string {
  if (!status) return '#6b7280'
  return STATUS_COLORS[status] ?? '#6b7280'
}

// ---------------------------------------------------------------------------
// Estudiantes tab inner component
// ---------------------------------------------------------------------------
function EstudiantesTab({ promocion }: { promocion: string | null }) {
  const [result, setResult] = useState<StudentListResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  useEffect(() => {
    if (!promocion) {
      setResult(null)
      setPage(1)
      return
    }
    let cancelled = false
    setLoading(true)
    getPromoStudentList(promocion, { page, perPage: PER_PAGE })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [promocion, page])

  // Reset page when promo changes
  useEffect(() => { setPage(1) }, [promocion])

  if (!promocion) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/50">
        <p className="text-sm text-gray-500">Selecciona una promoción para ver sus estudiantes</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Table card */}
      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700/60 bg-gray-800/60">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Nombre
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Coordinador
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando estudiantes…</span>
                    </div>
                  </td>
                </tr>
              ) : !result || result.data.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 italic">
                    Sin estudiantes para esta promoción
                  </td>
                </tr>
              ) : (
                result.data.map((candidate: Candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-200 font-medium">
                      {candidate.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: statusDotColor(candidate.current_status) }}
                        />
                        <span className="text-gray-300 text-xs whitespace-nowrap">
                          {candidate.current_status ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {candidate.coordinador ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500">
            {result.total} estudiantes · página {result.page} de {result.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= result.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RendimientoPage() {
  const [promos, setPromos] = useState<PromoSummaryCard[]>([])
  const [selectedPromo, setSelectedPromo] = useState<string | null>(null)
  const [checkedPromos, setCheckedPromos] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [activeTab, setActiveTab] = useState<ActiveTab>('rendimiento')
  const [loading, setLoading] = useState(true)

  // Select dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadPromos = useCallback(async () => {
    try {
      const data = await getPerformancePromos()
      setPromos(data)
      // Auto-select first promo
      if (data.length > 0) {
        setSelectedPromo(data[0].promocion)
      }
    } catch (err) {
      console.error('Error loading performance promos:', err)
    }
  }, [])

  useEffect(() => {
    loadPromos().finally(() => setLoading(false))
  }, [loadPromos])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredPromos = promos.filter((p) =>
    p.promocion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.coordinador ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedPromoData = promos.find((p) => p.promocion === selectedPromo)

  const handleSelect = (promocion: string) => {
    setSelectedPromo(promocion)
    setViewMode('detail')
    setDropdownOpen(false)
    setSearchQuery('')
  }

  const handleToggleCheck = (promocion: string) => {
    setCheckedPromos((prev) => {
      const next = new Set(prev)
      if (next.has(promocion)) {
        next.delete(promocion)
      } else {
        if (next.size >= 3) return prev
        next.add(promocion)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-700/50" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-gray-800/50" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-gray-700/30" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row: title + actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Rendimiento</h1>
        <div className="flex items-center gap-2">
          {checkedPromos.size >= 2 && viewMode === 'detail' && (
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Comparar ({checkedPromos.size})
            </button>
          )}
          {viewMode === 'compare' && (
            <button
              type="button"
              onClick={() => setViewMode('detail')}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
            >
              Volver
            </button>
          )}
        </div>
      </div>

      {/* Promo selector bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Searchable select dropdown */}
        <div ref={dropdownRef} className="relative flex-1 max-w-md">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-left text-sm transition hover:border-gray-600"
          >
            <span className={selectedPromoData ? 'text-gray-100' : 'text-gray-500'}>
              {selectedPromoData ? (
                <span>
                  <span className="font-medium">{selectedPromoData.promocion}</span>
                  <span className="ml-2 text-gray-500">
                    {selectedPromoData.total} alumnos
                    {selectedPromoData.coordinador && ` · ${selectedPromoData.coordinador}`}
                  </span>
                </span>
              ) : (
                'Seleccionar promocion...'
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
              {/* Search input */}
              <div className="border-b border-gray-700 p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar promocion..."
                    className="w-full rounded-md border border-gray-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              {/* Options list */}
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredPromos.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No se encontraron promos</div>
                ) : (
                  filteredPromos.map((promo) => (
                    <button
                      key={promo.promocion}
                      type="button"
                      onClick={() => handleSelect(promo.promocion)}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-gray-700/50 ${
                        selectedPromo === promo.promocion ? 'bg-blue-600/10 text-blue-400' : 'text-gray-300'
                      }`}
                    >
                      <div>
                        <span className="font-medium">{promo.promocion}</span>
                        {promo.coordinador && (
                          <span className="ml-2 text-xs text-gray-500">{promo.coordinador}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400">{promo.total} alumnos</span>
                        <span className="text-green-400">{promo.hiredCount} hired</span>
                        <span className="text-red-400">{promo.dropoutCount} bajas</span>
                        {/* Checkbox for comparison */}
                        <input
                          type="checkbox"
                          checked={checkedPromos.has(promo.promocion)}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleToggleCheck(promo.promocion)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                          title="Seleccionar para comparar"
                        />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Checked promos chips */}
        {checkedPromos.size > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Comparar:</span>
            {Array.from(checkedPromos).map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs text-blue-400"
              >
                {p}
                <button
                  type="button"
                  onClick={() => handleToggleCheck(p)}
                  className="hover:text-blue-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('rendimiento')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'rendimiento'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Rendimiento
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('estudiantes')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'estudiantes'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Estudiantes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bajas-globales')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'bajas-globales'
              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
              : 'border border-gray-600/50 bg-gray-700/40 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Bajas globales
        </button>
      </div>

      {/* Content area — full width */}
      {activeTab === 'bajas-globales' ? (
        <GlobalDropoutAnalysis />
      ) : activeTab === 'estudiantes' ? (
        <EstudiantesTab promocion={selectedPromo} />
      ) : promos.length === 0 ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-12 text-center">
          <p className="text-lg font-medium text-gray-400">No hay promos con datos</p>
          <p className="mt-1 text-sm text-gray-500">
            Importa el Excel madre para ver los datos de rendimiento.
          </p>
        </div>
      ) : viewMode === 'compare' && checkedPromos.size >= 2 ? (
        <PromoComparisonView promociones={Array.from(checkedPromos)} />
      ) : selectedPromo ? (
        <PerformanceDetail promocion={selectedPromo} />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/50">
          <p className="text-sm text-gray-500">Selecciona una promocion para ver el detalle</p>
        </div>
      )}
    </div>
  )
}
