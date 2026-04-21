'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import {
  getFormacionStates,
  getFormacionPreferences,
  getDropoutAnalysis,
  type FormacionStateRow,
  type PreferenceRow,
  type DropoutAnalysisData,
} from '@/lib/queries/formacion'

// ─── Color palettes ──────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  Hired: '#10B981',
  'In Training': '#3B82F6',
  'Offer-Withdrawn': '#F59E0B',
  Expelled: '#EF4444',
  Transferred: '#8B5CF6',
  'To Place': '#06B6D4',
  Assigned: '#22C55E',
  'Stand-by': '#6B7280',
  'Training Finished': '#14B8A6',
}

const PREF_COLORS: Record<string, string> = {
  Kommuner: '#3B82F6',
  'Vikar and Kommuner': '#10B981',
  'Training + Vikar': '#8B5CF6',
  'Training + Komunner Fast': '#F59E0B',
  'Only Vikar': '#06B6D4',
  'No feedback': '#6B7280',
}

const REASON_PALETTE = [
  '#EF4444', '#F59E0B', '#8B5CF6', '#3B82F6',
  '#EC4899', '#06B6D4', '#F97316', '#6B7280',
]

const LEVEL_PALETTE = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280',
]

const INTEREST_COLORS: Record<string, string> = {
  'Yes': '#10B981',
  'No': '#EF4444',
  'Does not know': '#F59E0B',
  'Sin dato': '#6B7280',
}

function stateColor(s: string) { return STATE_COLORS[s] ?? '#6B7280' }
function prefColor(s: string) { return PREF_COLORS[s] ?? '#6B7280' }
function interestColor(s: string) { return INTEREST_COLORS[s] ?? '#6B7280' }

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1F2937',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    fontSize: '12px',
    color: '#F3F4F6',
  },
  labelStyle: { color: '#F3F4F6' },
  itemStyle: { color: '#D1D5DB' },
}

// ─── Slides config ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'estados',
    label: 'Estados',
    subtitle: 'Distribución de candidatos por estado post-contrato',
    dot: 'bg-blue-400',
  },
  {
    id: 'preferencias',
    label: 'Preferencias de Colocación',
    subtitle: 'Tipo de trabajo al que están abiertos los candidatos en formación',
    dot: 'bg-emerald-400',
  },
  {
    id: 'abandonos',
    label: 'Análisis de Abandonos',
    subtitle: 'Causas, duración, asistencia e interés en proyectos futuros',
    dot: 'bg-red-400',
  },
] as const

// ─── Shared skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-6">
      <div className="mb-4 flex justify-end">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-700" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-gray-700/50" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-700/50" />
      </div>
      <div className="mt-4 h-32 animate-pulse rounded-lg bg-gray-700/30" />
    </div>
  )
}

// ─── Shared legend table ──────────────────────────────────────────────────────

interface LegendRow {
  label: string
  count: number
  percentage: number
  color: string
}

function LegendTable({ rows, countLabel = 'Candidatos' }: { rows: LegendRow[]; countLabel?: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-700/50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700/50 bg-gray-800/80 text-[11px] uppercase tracking-wider text-gray-400">
            <th className="px-3 py-2.5">Etiqueta</th>
            <th className="px-3 py-2.5 text-right">{countLabel}</th>
            <th className="px-3 py-2.5 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {rows.map((row) => (
            <tr key={row.label} className="transition hover:bg-gray-700/20">
              <td className="whitespace-nowrap px-3 py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="text-gray-200">{row.label}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-100">
                {row.count.toLocaleString('es-AR')}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-400">
                {total > 0 ? Math.round((row.count / total) * 100) : row.percentage}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Slide 1: Estados ─────────────────────────────────────────────────────────

function EstadosSlide({ data }: { data: FormacionStateRow[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0)

  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-400">Sin datos de estados</p>
        <p className="mt-1 text-xs text-gray-500">No hay candidatos en estados de formación</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <p className="mb-4 text-right text-xs tabular-nums text-gray-400">
        {total.toLocaleString('es-AR')} candidatos en total
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="status"
                tick={{ fill: '#D1D5DB', fontSize: 11 }}
                width={120}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as any}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((e) => (
                  <Cell key={e.status} fill={stateColor(e.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                label={({ payload }: any) => `${payload.status}: ${payload.percentage}%`}
                labelLine={{ stroke: '#4B5563' }}
              >
                {data.map((e) => (
                  <Cell key={e.status} fill={stateColor(e.status)} />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={((v: number) => [v.toLocaleString('es-AR'), 'Candidatos']) as any}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <LegendTable
        rows={data.map((d) => ({
          label: d.status,
          count: d.count,
          percentage: d.percentage,
          color: stateColor(d.status),
        }))}
      />
    </div>
  )
}

// ─── Slide 2: Preferencias ────────────────────────────────────────────────────

function PreferenciasSlide({ data }: { data: PreferenceRow[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0)

  if (data.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-400">Sin datos de preferencias</p>
        <p className="mt-1 text-xs text-gray-500">
          La columna "gp_open_to" está vacía en la base de datos
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <p className="mb-4 text-right text-xs tabular-nums text-gray-400">
        {total.toLocaleString('es-AR')} menciones registradas
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="preference"
                tick={{ fill: '#D1D5DB', fontSize: 10 }}
                width={155}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={((v: number) => [v.toLocaleString('es-AR'), 'Menciones']) as any}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((e) => (
                  <Cell key={e.preference} fill={prefColor(e.preference)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="preference"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                label={({ payload }: any) => `${payload.percentage}%`}
                labelLine={{ stroke: '#4B5563' }}
              >
                {data.map((e) => (
                  <Cell key={e.preference} fill={prefColor(e.preference)} />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={((v: number, name: string) => [
                  v.toLocaleString('es-AR'),
                  name,
                ]) as any}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <LegendTable
        rows={data.map((d) => ({
          label: d.preference,
          count: d.count,
          percentage: d.percentage,
          color: prefColor(d.preference),
        }))}
      />
    </div>
  )
}

// ─── Slide 3: Abandonos ───────────────────────────────────────────────────────

function AbandonosSlide({ data }: { data: DropoutAnalysisData | null }) {
  if (!data || data.totalDropouts === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-400">Sin datos de abandonos</p>
        <p className="mt-1 text-xs text-gray-500">No hay bajas registradas en formación</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── KPI summary ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Total bajas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-400">
            {data.totalDropouts.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Tasa abandono</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-orange-400">
            {data.dropoutRate}%
          </p>
        </div>
        {data.avgWeeksOfTraining !== null && (
          <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Media semanas</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-blue-400">
              {data.avgWeeksOfTraining}
            </p>
          </div>
        )}
        {data.avgAttendancePct !== null && (
          <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Media asistencia</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-violet-400">
              {data.avgAttendancePct}%
            </p>
          </div>
        )}
      </div>

      {/* ── Row 1: Motivos + Nivel de idioma ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.byReason.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Motivos de baja
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byReason} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="reason"
                    tick={{ fill: '#D1D5DB', fontSize: 9 }}
                    width={145}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={((v: number) => [v.toLocaleString('es-AR'), 'Bajas']) as any}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.byReason.map((_, i) => (
                      <Cell key={i} fill={REASON_PALETTE[i % REASON_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.byLanguageLevel.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Nivel de idioma
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byLanguageLevel}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={42}
                    paddingAngle={2}
                    label={({ payload }: any) => `${payload.level} (${payload.count})`}
                    labelLine={{ stroke: '#4B5563' }}
                  >
                    {data.byLanguageLevel.map((_, i) => (
                      <Cell key={i} fill={LEVEL_PALETTE[i % LEVEL_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={((v: number) => [v.toLocaleString('es-AR'), 'Bajas']) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 2: Por mes + Interés futuro ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.byMonth.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Bajas por mes
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byMonth} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={((v: number) => [v.toLocaleString('es-AR'), 'Bajas']) as any}
                  />
                  <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {data.byInterest.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Interés en proyectos futuros
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byInterest}
                    dataKey="count"
                    nameKey="interest"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={36}
                    paddingAngle={2}
                    label={({ payload }: any) => `${payload.interest} (${payload.count})`}
                    labelLine={{ stroke: '#4B5563' }}
                  >
                    {data.byInterest.map((e, i) => (
                      <Cell key={i} fill={interestColor(e.interest)} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={((v: number) => [v.toLocaleString('es-AR'), 'Bajas']) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend table: motivos ── */}
      {data.byReason.length > 0 && (
        <LegendTable
          countLabel="Bajas"
          rows={data.byReason.map((d, i) => ({
            label: d.reason,
            count: d.count,
            percentage: 0,
            color: REASON_PALETTE[i % REASON_PALETTE.length],
          }))}
        />
      )}
    </div>
  )
}

// ─── Main carousel ────────────────────────────────────────────────────────────

interface Props {
  promoNombres?: string[]
}

export default function FormacionGraficos({ promoNombres }: Props) {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)
  const [statesData, setStatesData] = useState<FormacionStateRow[]>([])
  const [prefsData, setPrefsData] = useState<PreferenceRow[]>([])
  const [dropoutData, setDropoutData] = useState<DropoutAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLoading(true)
    const filter = promoNombres && promoNombres.length > 0 ? promoNombres : undefined
    Promise.all([
      getFormacionStates(filter),
      getFormacionPreferences(filter),
      getDropoutAnalysis(filter),
    ]).then(([states, prefs, dropouts]) => {
      setStatesData(states)
      setPrefsData(prefs)
      setDropoutData(dropouts)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(promoNombres)])

  function goTo(idx: number) {
    if (idx === current) return
    setVisible(false)
    setTimeout(() => {
      setCurrent(idx)
      setVisible(true)
    }, 150)
  }

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length)
  const next = () => goTo((current + 1) % SLIDES.length)

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-gray-700/50 px-5 py-4">
        <button
          onClick={prev}
          aria-label="Gráfico anterior"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-400 transition-all hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 flex-col items-center gap-1">
          <h3 className="text-sm font-semibold text-gray-200">
            {SLIDES[current].label}
          </h3>
          <p className="text-center text-xs text-gray-500">
            {SLIDES[current].subtitle}
          </p>

          <div className="mt-1 flex items-center gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => goTo(i)}
                aria-label={`Ver ${slide.label}`}
                className={[
                  'rounded-full transition-all duration-300',
                  i === current
                    ? `h-1.5 w-5 ${slide.dot}`
                    : 'h-1.5 w-1.5 bg-gray-600 hover:bg-gray-400',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        <button
          onClick={next}
          aria-label="Siguiente gráfico"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-600/50 bg-gray-700/40 text-gray-400 transition-all hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 active:scale-90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Slide content ── */}
      {loading ? (
        <Skeleton />
      ) : (
        <div
          className="transition-opacity duration-150"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {current === 0 && <EstadosSlide data={statesData} />}
          {current === 1 && <PreferenciasSlide data={prefsData} />}
          {current === 2 && <AbandonosSlide data={dropoutData} />}
        </div>
      )}
    </div>
  )
}
