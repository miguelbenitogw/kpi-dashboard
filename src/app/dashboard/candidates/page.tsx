'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, TrendingUp, XCircle, Search, ChevronDown, Star } from 'lucide-react'
import CandidateDetailTable from '@/components/candidates/CandidateDetailTable'
import {
  getCandidateStats,
  getAttractionVacancies,
  type CandidateStats,
  type AttractionVacancy,
} from '@/lib/queries/candidates'
import { TERMINAL_STATUSES } from '@/lib/zoho/transform'

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
  bgClass: string
}) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgClass}`}
        >
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-gray-100">
            {value.toLocaleString('es-AR')}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

function TopStatusList({
  statuses,
  title,
}: {
  statuses: { status: string; count: number }[]
  title: string
}) {
  const top5 = statuses.slice(0, 5)
  const total = statuses.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
        {title}
      </h3>
      <div className="space-y-2">
        {top5.map((s) => {
          const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : '0'
          return (
            <div key={s.status} className="flex items-center justify-between text-sm">
              <span className="truncate text-gray-300">{s.status}</span>
              <span className="ml-2 shrink-0 tabular-nums text-gray-500">
                {s.count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vacancy Selector
// ---------------------------------------------------------------------------

const ALL_VACANCIES_VALUE = '__all__'

interface VacancySelectorProps {
  vacancies: AttractionVacancy[]
  selectedId: string
  onSelect: (id: string) => void
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
}

function VacancySelector({
  vacancies,
  selectedId,
  onSelect,
  favoriteIds,
  onToggleFavorite,
}: VacancySelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Sort: favorites first, then by candidate_count desc
  const sortedVacancies = [...vacancies].sort((a, b) => {
    const aFav = favoriteIds.has(a.id) ? 1 : 0
    const bFav = favoriteIds.has(b.id) ? 1 : 0
    if (aFav !== bFav) return bFav - aFav
    return b.candidate_count - a.candidate_count
  })

  const filtered = sortedVacancies.filter(
    (v) =>
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.client_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedVacancy =
    selectedId === ALL_VACANCIES_VALUE
      ? null
      : vacancies.find((v) => v.id === selectedId)

  const handleSelect = (id: string) => {
    onSelect(id)
    setDropdownOpen(false)
    setSearchQuery('')
  }

  return (
    <div ref={dropdownRef} className="relative flex-1 max-w-md">
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-left text-sm transition hover:border-gray-600"
      >
        <span className={selectedVacancy ? 'text-gray-100' : 'text-gray-400'}>
          {selectedVacancy ? (
            <span>
              {favoriteIds.has(selectedVacancy.id) && (
                <Star className="mr-1.5 inline h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              )}
              <span className="font-medium">{selectedVacancy.title}</span>
              <span className="ml-2 text-gray-500">
                {selectedVacancy.candidate_count} candidatos
                {selectedVacancy.client_name && ` · ${selectedVacancy.client_name}`}
              </span>
            </span>
          ) : (
            'Todas las vacantes'
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition ${dropdownOpen ? 'rotate-180' : ''}`}
        />
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
                placeholder="Buscar vacante..."
                className="w-full rounded-md border border-gray-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          {/* Options list */}
          <div className="max-h-72 overflow-y-auto py-1">
            {/* "Todas las vacantes" option */}
            <button
              type="button"
              onClick={() => handleSelect(ALL_VACANCIES_VALUE)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-gray-700/50 ${
                selectedId === ALL_VACANCIES_VALUE
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'text-gray-300'
              }`}
            >
              <span className="font-medium">Todas las vacantes</span>
              <span className="text-xs text-gray-400">
                {vacancies.reduce((sum, v) => sum + v.candidate_count, 0)} candidatos
              </span>
            </button>

            {/* Separator */}
            <div className="my-1 border-t border-gray-700/50" />

            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No se encontraron vacantes
              </div>
            ) : (
              filtered.map((vacancy) => {
                const isFav = favoriteIds.has(vacancy.id)
                return (
                  <button
                    key={vacancy.id}
                    type="button"
                    onClick={() => handleSelect(vacancy.id)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-gray-700/50 ${
                      selectedId === vacancy.id
                        ? 'bg-blue-600/10 text-blue-400'
                        : 'text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(vacancy.id)
                        }}
                        className="shrink-0 p-0.5 transition hover:scale-110"
                        title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            isFav
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                        />
                      </button>
                      <span className="truncate font-medium">{vacancy.title}</span>
                      {vacancy.client_name && (
                        <span className="truncate text-xs text-gray-500">
                          {vacancy.client_name}
                        </span>
                      )}
                    </div>
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-gray-400">
                      {vacancy.candidate_count} candidatos
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CandidatesPage() {
  const [stats, setStats] = useState<CandidateStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Vacancy selector
  const [vacancies, setVacancies] = useState<AttractionVacancy[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(ALL_VACANCIES_VALUE)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  // Load vacancies + favorites
  const loadVacancies = useCallback(async () => {
    try {
      const [data, favRes] = await Promise.all([
        getAttractionVacancies(),
        fetch('/api/preferences/favorites?type=vacancies').then((r) => r.json()),
      ])
      setVacancies(data)
      if (Array.isArray(favRes?.ids)) {
        setFavoriteIds(new Set(favRes.ids))
      }
    } catch (err) {
      console.error('Error loading vacancies:', err)
    }
  }, [])

  useEffect(() => {
    loadVacancies().finally(() => setLoadingVacancies(false))
  }, [loadVacancies])

  useEffect(() => {
    getCandidateStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false))
  }, [])

  // Toggle favorite
  const handleToggleFavorite = useCallback(
    async (id: string) => {
      const isFav = favoriteIds.has(id)
      const action = isFav ? 'remove' : 'add'

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (isFav) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })

      try {
        const res = await fetch('/api/preferences/favorites?type=vacancies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_opening_id: id, action }),
        })
        const data = await res.json()
        if (Array.isArray(data?.ids)) {
          setFavoriteIds(new Set(data.ids))
        }
      } catch (err) {
        console.error('Error toggling favorite:', err)
        // Revert optimistic update
        setFavoriteIds((prev) => {
          const next = new Set(prev)
          if (isFav) {
            next.add(id)
          } else {
            next.delete(id)
          }
          return next
        })
      }
    },
    [favoriteIds]
  )

  // Prepare filter options from stats
  const statusOptions = (stats?.byStatus ?? []).map((s) => ({
    value: s.status,
    count: s.count,
  }))

  const nationalityOptions = (stats?.byNationality ?? []).map((n) => ({
    value: n.nationality,
    count: n.count,
  }))

  const sourceOptions = (stats?.bySources ?? []).map((s) => ({
    value: s.source,
    count: s.count,
  }))

  // Top 5 active and terminal statuses
  const activeStatuses = (stats?.byStatus ?? []).filter(
    (s) => !TERMINAL_STATUSES.includes(s.status)
  )
  const terminalStatuses = (stats?.byStatus ?? []).filter((s) =>
    TERMINAL_STATUSES.includes(s.status)
  )

  // Derive the jobOpeningId for the table
  const tableJobOpeningId =
    selectedVacancyId === ALL_VACANCIES_VALUE ? undefined : selectedVacancyId

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Atraccion</h1>
        <p className="mt-1 text-gray-400">
          Vacantes de atraccion y sus candidatos.
        </p>
      </div>

      {/* Vacancy selector */}
      {loadingVacancies ? (
        <div className="h-11 w-full max-w-md animate-pulse rounded-lg bg-gray-800/50" />
      ) : (
        <VacancySelector
          vacancies={vacancies}
          selectedId={selectedVacancyId}
          onSelect={setSelectedVacancyId}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Stats cards */}
      {loadingStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-gray-700/50 bg-gray-800/50"
            />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Candidatos"
              value={stats.total}
              icon={Users}
              colorClass="text-blue-400"
              bgClass="bg-blue-500/20"
            />
            <StatCard
              label="En Proceso"
              value={stats.activeCount}
              icon={TrendingUp}
              colorClass="text-emerald-400"
              bgClass="bg-emerald-500/20"
            />
            <StatCard
              label="Finalizados"
              value={stats.terminalCount}
              icon={XCircle}
              colorClass="text-gray-400"
              bgClass="bg-gray-500/20"
            />
          </div>

          {/* Status breakdowns */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TopStatusList
              statuses={activeStatuses}
              title="Top 5 Status Activos"
            />
            <TopStatusList
              statuses={terminalStatuses}
              title="Top 5 Status Finalizados"
            />
          </div>
        </>
      ) : null}

      {/* Table */}
      <CandidateDetailTable
        key={tableJobOpeningId ?? 'all'}
        jobOpeningId={tableJobOpeningId}
        initialStatusOptions={statusOptions}
        initialNationalityOptions={nationalityOptions}
        initialSourceOptions={sourceOptions}
      />
    </div>
  )
}
