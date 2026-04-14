'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { STATUS_COLORS } from '@/components/promos/StatusBreakdown'

interface FilterOption {
  value: string
  count?: number
}

interface CandidateFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  selectedStatuses: string[]
  onStatusChange: (statuses: string[]) => void
  statusOptions: FilterOption[]
  selectedNationalities: string[]
  onNationalityChange: (nationalities: string[]) => void
  nationalityOptions: FilterOption[]
  selectedSources: string[]
  onSourceChange: (sources: string[]) => void
  sourceOptions: FilterOption[]
  onClearAll: () => void
  hasActiveFilters: boolean
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  renderDot,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  renderDot?: (value: string) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition
          ${
            selected.length > 0
              ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
              : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
          }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-blue-500/30 px-1.5 text-[10px] font-semibold tabular-nums text-blue-300">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 p-1 shadow-xl">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded px-2 py-1.5 text-left text-[11px] text-gray-500 hover:bg-gray-700/50 hover:text-gray-300"
            >
              Limpiar seleccion
            </button>
          )}
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition
                  ${isSelected ? 'bg-blue-500/15 text-blue-300' : 'text-gray-300 hover:bg-gray-700/50'}`}
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px]
                    ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-600'}`}
                >
                  {isSelected && '✓'}
                </span>
                {renderDot?.(opt.value)}
                <span className="flex-1 truncate">{opt.value}</span>
                {opt.count != null && (
                  <span className="text-[10px] tabular-nums text-gray-500">
                    {opt.count}
                  </span>
                )}
              </button>
            )
          })}
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-gray-500">
              Sin opciones
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CandidateFilters({
  search,
  onSearchChange,
  selectedStatuses,
  onStatusChange,
  statusOptions,
  selectedNationalities,
  onNationalityChange,
  nationalityOptions,
  selectedSources,
  onSourceChange,
  sourceOptions,
  onClearAll,
  hasActiveFilters,
}: CandidateFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search + Dropdowns row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar nombre o email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 py-2 pl-9 pr-3 text-xs text-gray-200 placeholder-gray-500 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <MultiSelectDropdown
          label="Status"
          options={statusOptions}
          selected={selectedStatuses}
          onChange={onStatusChange}
          renderDot={(value) => {
            const color = STATUS_COLORS[value] ?? '#6B7280'
            return (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
            )
          }}
        />

        <MultiSelectDropdown
          label="Nacionalidad"
          options={nationalityOptions}
          selected={selectedNationalities}
          onChange={onNationalityChange}
        />

        <MultiSelectDropdown
          label="Fuente"
          options={sourceOptions}
          selected={selectedSources}
          onChange={onSourceChange}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {selectedStatuses.map((s) => (
            <span
              key={`status-${s}`}
              className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-300"
            >
              {s}
              <button
                type="button"
                onClick={() =>
                  onStatusChange(selectedStatuses.filter((v) => v !== s))
                }
                className="rounded-full p-0.5 hover:bg-blue-500/30"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {selectedNationalities.map((n) => (
            <span
              key={`nat-${n}`}
              className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] text-purple-300"
            >
              {n}
              <button
                type="button"
                onClick={() =>
                  onNationalityChange(
                    selectedNationalities.filter((v) => v !== n)
                  )
                }
                className="rounded-full p-0.5 hover:bg-purple-500/30"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {selectedSources.map((s) => (
            <span
              key={`src-${s}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300"
            >
              {s}
              <button
                type="button"
                onClick={() =>
                  onSourceChange(selectedSources.filter((v) => v !== s))
                }
                className="rounded-full p-0.5 hover:bg-emerald-500/30"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
