'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
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
  'Offer Withdrawn': '#F59E0B',
  'Offer Declined': '#FB923C',
  Expelled: '#EF4444',
  Transferred: '#8B5CF6',
  'To Place': '#06B6D4',
  Assigned: '#22C55E',
  'Stand-by': '#6B7280',
  'Training Finished': '#14B8A6',
  'No Show': '#DC2626',
  'Next Project': '#A78BFA',
  'Approved by client': '#34D399',
  'Rejected by client': '#F87171',
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
  Yes: '#10B981',
  No: '#EF4444',
  'Does not know': '#F59E0B',
  'Sin dato': '#6B7280',
}

function stateColor(s: string) { return STATE_COLORS[s] ?? '#6B7280' }
function prefColor(s: string) { return PREF_COLORS[s] ?? '#6B7280' }
function interestColor(s: string) { return INTEREST_COLORS[s] ?? '#6B7280' }

// ─── Custom pie tooltip ───────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const name   = item.name  as string
  const value  = item.value as number
  const pct    = (item.payload?.percentage as number | undefined) ?? null
  const color  = item.payload?.fill ?? item.fill ?? '#6B7280'
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{name}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#111827' }}>
        {value.toLocaleString('es-AR')} candidatos
        {pct !== null && (
          <span style={{ marginLeft: 6, fontWeight: 600, color: '#111827' }}>{pct}%</span>
        )}
      </p>
    </div>
  )
}

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
            <div className="mb-4 h-4 w-36 animate-pulse rounded bg-gray-700" />
            <div className="h-56 animate-pulse rounded-lg bg-gray-700/40" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 animate-pulse rounded bg-gray-700/50" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-5">
        <div className="mb-4 h-4 w-44 animate-pulse rounded bg-gray-700" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-700/40" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-52 animate-pulse rounded-lg bg-gray-700/40" />
          <div className="h-52 animate-pulse rounded-lg bg-gray-700/40" />
        </div>
      </div>
    </div>
  )
}

// ─── Compact pill legend ──────────────────────────────────────────────────────

interface LegendPillItem {
  label: string
  count: number
  percentage: number
  color: string
}

function PillLegend({ items }: { items: LegendPillItem[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-gray-300">{item.label}</span>
          <span className="text-xs tabular-nums text-gray-500">
            {item.count.toLocaleString('es-AR')}
          </span>
          <span className="text-[10px] tabular-nums text-gray-600">
            ({item.percentage}%)
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Donut card ───────────────────────────────────────────────────────────────

interface DonutCardProps {
  title: string
  subtitle: string
  total: number
  totalLabel: string
  borderClass: string
  dotClass: string
  children: ReactNode
  legend: LegendPillItem[]
  empty?: boolean
  emptyMessage?: string
}

function DonutCard({
  title,
  subtitle,
  total,
  totalLabel,
  borderClass,
  dotClass,
  children,
  legend,
  empty,
  emptyMessage,
}: DonutCardProps) {
  return (
    <div className={`rounded-xl border ${borderClass} bg-gray-800/50 p-5`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <div>
            <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {!empty && (
          <span className="shrink-0 text-xs tabular-nums text-gray-400">
            {total.toLocaleString('es-AR')} {totalLabel}
          </span>
        )}
      </div>

      {empty ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-xs text-gray-600">{emptyMessage ?? 'Sin datos'}</p>
        </div>
      ) : (
        <>
          <div className="h-56">{children}</div>
          <PillLegend items={legend} />
        </>
      )}
    </div>
  )
}

// ─── Abandonos section ────────────────────────────────────────────────────────

function AbandonosSection({ data }: { data: DropoutAnalysisData | null }) {
  if (!data || data.totalDropouts === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-gray-500">Sin bajas registradas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Motivos + Nivel de idioma */}
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
              Nivel de idioma al abandonar
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byLanguageLevel}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={48}
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

      {/* Bajas por mes + Interés en proyectos futuros */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.byMonth.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Bajas por mes
            </p>
            {/* Legend for promo start lines */}
            {data.promoStartDates.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
                {data.promoStartDates.map((p) => (
                  <span key={p.nombre} className="flex items-center gap-1 text-[10px] text-blue-400">
                    <span className="inline-block h-3 w-px bg-blue-400 opacity-70" />
                    {p.nombre}
                    <span className="text-gray-500">
                      ({new Date(p.fecha_inicio).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })})
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byMonth} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
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
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const entry = payload[0].payload as { count: number; promos?: string[] }
                      // Promos that start this month
                      const startingHere = data.promoStartDates.filter((p) => p.monthKey === label)
                      return (
                        <div style={{
                          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                          padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', minWidth: 150,
                        }}>
                          <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                            {label}
                          </p>
                          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#111827' }}>
                            <strong>{entry.count}</strong> baja{entry.count !== 1 ? 's' : ''}
                          </p>
                          {entry.promos && entry.promos.length > 0 && (
                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 6, marginBottom: startingHere.length > 0 ? 6 : 0 }}>
                              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Promos con bajas
                              </p>
                              {entry.promos.map((p) => (
                                <p key={p} style={{ margin: '1px 0', fontSize: 11, color: '#374151', fontWeight: 500 }}>{p}</p>
                              ))}
                            </div>
                          )}
                          {startingHere.length > 0 && (
                            <div style={{ borderTop: '1px solid #dbeafe', paddingTop: 6 }}>
                              <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                🟦 Inicio de promo
                              </p>
                              {startingHere.map((p) => (
                                <p key={p.nombre} style={{ margin: '1px 0', fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>{p.nombre}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  {/* Reference lines for promo start dates */}
                  {data.promoStartDates.map((p) => (
                    <ReferenceLine
                      key={p.nombre}
                      x={p.monthKey}
                      stroke="#3B82F6"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      strokeOpacity={0.7}
                      label={{
                        value: p.nombre.match(/\d+$/)?.[0] ?? p.nombre.slice(0, 6),
                        position: 'top',
                        fontSize: 9,
                        fill: '#60A5FA',
                        fontWeight: 600,
                      }}
                    />
                  ))}
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
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byInterest}
                    dataKey="count"
                    nameKey="interest"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={48}
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
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  promoNombres?: string[]
}

export default function FormacionGraficos({ promoNombres }: Props) {
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

  if (loading) return <Skeleton />

  const statesTotal = statesData.reduce((acc, d) => acc + d.count, 0)
  const prefsTotal = prefsData.reduce((acc, d) => acc + d.count, 0)

  return (
    <div className="space-y-6">
      {/* ── Top row: Estados + Preferencias donuts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Estados */}
        <DonutCard
          title="Estados"
          subtitle="Distribución de candidatos por estado post-contrato"
          total={statesTotal}
          totalLabel="candidatos"
          borderClass="border-blue-500/30"
          dotClass="bg-blue-500"
          empty={statesData.length === 0}
          emptyMessage="Sin datos de estados"
          legend={statesData.map((d) => ({
            label: d.status,
            count: d.count,
            percentage: d.percentage,
            color: stateColor(d.status),
          }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statesData.map((d) => ({ ...d, fill: stateColor(d.status) }))}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={52}
                paddingAngle={2}
              >
                {statesData.map((e) => (
                  <Cell key={e.status} fill={stateColor(e.status)} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </DonutCard>

        {/* Preferencias de Colocación */}
        <DonutCard
          title="Preferencias de Colocación"
          subtitle="Tipo de trabajo al que están abiertos los candidatos"
          total={prefsTotal}
          totalLabel="menciones"
          borderClass="border-emerald-500/30"
          dotClass="bg-emerald-500"
          empty={prefsData.length === 0}
          emptyMessage='Sin datos — columna "gp_open_to" vacía'
          legend={prefsData.map((d) => ({
            label: d.preference,
            count: d.count,
            percentage: d.percentage,
            color: prefColor(d.preference),
          }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={prefsData.map((d) => ({ ...d, fill: prefColor(d.preference) }))}
                dataKey="count"
                nameKey="preference"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={52}
                paddingAngle={2}
              >
                {prefsData.map((e) => (
                  <Cell key={e.preference} fill={prefColor(e.preference)} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </DonutCard>
      </div>

      {/* ── Abandonos ── */}
      <div className="rounded-xl border border-red-500/20 bg-gray-800/50">
        <div className="flex items-center gap-2 border-b border-gray-700/50 px-5 py-4">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Análisis de Abandonos</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Causas, duración, nivel de idioma e interés en proyectos futuros
            </p>
          </div>
          {dropoutData && dropoutData.totalDropouts > 0 && (
            <span className="ml-auto text-xs tabular-nums text-red-400">
              {dropoutData.totalDropouts.toLocaleString('es-AR')} bajas
            </span>
          )}
        </div>
        <AbandonosSection data={dropoutData} />
      </div>
    </div>
  )
}
