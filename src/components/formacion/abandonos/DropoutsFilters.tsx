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
  modalities: string[]
}

export const EMPTY_FILTERS: DropoutFilters = {
  search: '',
  promos: [],
  reasons: [],
  languageLevels: [],
  interests: [],
  tags: [],
  nationalities: [],
  modalities: [],
}

interface Options {
  promos: FilterOption[]
  reasons: FilterOption[]
  languageLevels: FilterOption[]
  interests: FilterOption[]
  tags: FilterOption[]
  nationalities: FilterOption[]
  modalities: FilterOption[]
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
    <details style={{ position: 'relative' }}>
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 8,
          border: '1px solid #e7e2d8',
          background: selected.length > 0 ? '#f5f1ea' : '#ffffff',
          color: '#44403c',
          fontSize: 12,
          userSelect: 'none',
        }}
      >
        {label}
        {selected.length > 0 && (
          <span
            style={{
              borderRadius: 999,
              background: '#1e4b9e',
              color: '#ffffff',
              padding: '0 6px',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {selected.length}
          </span>
        )}
      </summary>
      <div
        style={{
          position: 'absolute',
          zIndex: 20,
          marginTop: 4,
          width: 220,
          borderRadius: 10,
          border: '1px solid #e7e2d8',
          background: '#ffffff',
          padding: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {opts.length === 0 ? (
          <p style={{ padding: '4px 8px', fontSize: 12, color: '#a8a29e', margin: 0 }}>Sin opciones</p>
        ) : (
          opts.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                cursor: 'pointer',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 12,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#faf9f7')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                style={{ accentColor: '#1e4b9e' }}
              />
              <span style={{ flex: 1, color: '#44403c' }}>{opt.label}</span>
              <span style={{ color: '#a8a29e', fontVariantNumeric: 'tabular-nums' }}>{opt.count}</span>
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
    filters.nationalities.length > 0 ||
    filters.modalities.length > 0

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <svg
          style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#a8a29e', pointerEvents: 'none' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar nombre o email..."
          style={{
            borderRadius: 8,
            border: '1px solid #e7e2d8',
            background: '#ffffff',
            paddingLeft: 28,
            paddingRight: 12,
            paddingTop: 5,
            paddingBottom: 5,
            fontSize: 12,
            color: '#1c1917',
            outline: 'none',
            width: 192,
          }}
        />
      </div>

      <MultiSelect label="Promoción" opts={options.promos} selected={filters.promos} onToggle={(v) => onChange({ ...filters, promos: toggle(filters.promos, v) })} />
      <MultiSelect label="Motivo" opts={options.reasons} selected={filters.reasons} onToggle={(v) => onChange({ ...filters, reasons: toggle(filters.reasons, v) })} />
      <MultiSelect label="Nivel idioma" opts={options.languageLevels} selected={filters.languageLevels} onToggle={(v) => onChange({ ...filters, languageLevels: toggle(filters.languageLevels, v) })} />
      <MultiSelect label="Interés futuro" opts={options.interests} selected={filters.interests} onToggle={(v) => onChange({ ...filters, interests: toggle(filters.interests, v) })} />
      <MultiSelect label="Etiqueta" opts={options.tags} selected={filters.tags} onToggle={(v) => onChange({ ...filters, tags: toggle(filters.tags, v) })} />
      <MultiSelect label="Nacionalidad" opts={options.nationalities} selected={filters.nationalities} onToggle={(v) => onChange({ ...filters, nationalities: toggle(filters.nationalities, v) })} />
      <MultiSelect label="Modalidad" opts={options.modalities} selected={filters.modalities} onToggle={(v) => onChange({ ...filters, modalities: toggle(filters.modalities, v) })} />

      {hasActive && (
        <button
          onClick={onClear}
          style={{
            borderRadius: 8,
            border: '1px solid #fecdd3',
            background: '#fff1f2',
            padding: '5px 12px',
            fontSize: 12,
            color: '#be123c',
            cursor: 'pointer',
          }}
        >
          Limpiar todo
        </button>
      )}
    </div>
  )
}
