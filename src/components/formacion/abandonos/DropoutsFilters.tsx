'use client'

export interface FilterOption { value: string; label: string; count: number }

export interface DropoutFilters {
  search: string
  promos: string[]
  reasons: string[]
  languageLevels: string[]
  interests: string[]
  tags: string[]
  nationalities: string[]
}

export const EMPTY_FILTERS: DropoutFilters = {
  search: '',
  promos: [],
  reasons: [],
  languageLevels: [],
  interests: [],
  tags: [],
  nationalities: [],
}

interface Options {
  promos: FilterOption[]
  reasons: FilterOption[]
  languageLevels: FilterOption[]
  interests: FilterOption[]
  tags: FilterOption[]
  nationalities: FilterOption[]
}

interface Props {
  filters: DropoutFilters
  options: Options
  onChange: (f: DropoutFilters) => void
  onClear: () => void
}

function MultiSelect({
  label,
  opts,
  selected,
  onToggle,
}: {
  label: string
  opts: FilterOption[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-gray-700/50 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-600 flex items-center gap-1.5 select-none">
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-indigo-500/30 px-1.5 text-[10px] text-indigo-300">
            {selected.length}
          </span>
        )}
      </summary>
      <div className="absolute z-20 mt-1 w-56 rounded-xl border border-gray-700/50 bg-gray-800 p-2 shadow-xl max-h-60 overflow-y-auto space-y-0.5">
        {opts.length === 0 ? (
          <p className="px-2 py-1 text-xs text-gray-600">Sin opciones</p>
        ) : (
          opts.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-700/50"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="accent-indigo-500"
              />
              <span className="flex-1 text-gray-300">{opt.label}</span>
              <span className="text-gray-600 tabular-nums">{opt.count}</span>
            </label>
          ))
        )}
      </div>
    </details>
  )
}

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export default function DropoutsFilters({ filters, options, onChange, onClear }: Props) {
  const hasActive =
    filters.search ||
    filters.promos.length > 0 ||
    filters.reasons.length > 0 ||
    filters.languageLevels.length > 0 ||
    filters.interests.length > 0 ||
    filters.tags.length > 0 ||
    filters.nationalities.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar nombre o email..."
          className="rounded-lg border border-gray-700/50 bg-gray-800/60 pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors w-48"
        />
      </div>

      <MultiSelect label="Promoción" opts={options.promos} selected={filters.promos} onToggle={(v) => onChange({ ...filters, promos: toggle(filters.promos, v) })} />
      <MultiSelect label="Motivo" opts={options.reasons} selected={filters.reasons} onToggle={(v) => onChange({ ...filters, reasons: toggle(filters.reasons, v) })} />
      <MultiSelect label="Nivel idioma" opts={options.languageLevels} selected={filters.languageLevels} onToggle={(v) => onChange({ ...filters, languageLevels: toggle(filters.languageLevels, v) })} />
      <MultiSelect label="Interés futuro" opts={options.interests} selected={filters.interests} onToggle={(v) => onChange({ ...filters, interests: toggle(filters.interests, v) })} />
      <MultiSelect label="Etiqueta" opts={options.tags} selected={filters.tags} onToggle={(v) => onChange({ ...filters, tags: toggle(filters.tags, v) })} />
      <MultiSelect label="Nacionalidad" opts={options.nationalities} selected={filters.nationalities} onToggle={(v) => onChange({ ...filters, nationalities: toggle(filters.nationalities, v) })} />

      {hasActive && (
        <button
          onClick={onClear}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Limpiar todo
        </button>
      )}
    </div>
  )
}
