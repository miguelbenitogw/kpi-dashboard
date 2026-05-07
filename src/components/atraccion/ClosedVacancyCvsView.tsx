'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import {
  getClosedVacanciesUnified,
  type ClosedVacancyUnified,
  type ClosedVacanciesUnifiedData,
} from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'
import { type TipoProfesional, deriveProfesionTipo } from '@/lib/utils/vacancy-profession'

// ─── constants ────────────────────────────────────────────────────────────────

const VACANCY_COLORS = [
  '#1e4b9e',
  '#e55a2b',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0284c7',
  '#be185d',
]

const CHANNEL_COLORS = {
  FR: '#1e4b9e',
  CP: '#16a34a',
  GW: '#e55a2b',
  Otras: '#9333ea',
}

const STACKED_OTHER_COLOR = '#d6d3d1'

type WeeksWindow = 26 | 52
type SortKey = 'title' | 'year' | 'totalCandidates' | 'hiredCount' | 'successRate' | 'peakWeekLabel'
type SortDir = 'asc' | 'desc'

// ─── helpers ──────────────────────────────────────────────────────────────────

function rateColor(rate: number | null): string {
  if (rate === null) return '#a8a29e'
  if (rate > 0.2) return '#16a34a'
  if (rate >= 0.1) return '#ca8a04'
  return '#dc2626'
}

function rateColorByPct(pct: number | null): string {
  if (pct === null) return '#a8a29e'
  if (pct >= 20) return '#16a34a'
  if (pct >= 10) return '#d97706'
  return '#dc2626'
}

function truncateTitle(title: string, maxLength = 38): string {
  return title.length <= maxLength ? title : `${title.slice(0, maxLength - 1)}…`
}

function xAxisTickFormatter(value: string, index: number): string {
  return index % 4 === 0 ? value : ''
}

type ChartDataPoint = {
  weekLabel: string
  [vacancyId: string]: string | number
}

function buildChartData(
  vacancies: ClosedVacancyUnified[],
  window: WeeksWindow,
): ChartDataPoint[] {
  if (vacancies.length === 0) return []
  const allPoints = vacancies[0].series
  const sliced = allPoints.slice(-window)

  return sliced.map((point) => {
    const row: ChartDataPoint = { weekLabel: point.weekLabel }
    for (const v of vacancies) {
      const match = v.series.find((p) => p.weekStart === point.weekStart)
      row[v.id] = match?.count ?? 0
    }
    return row
  })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? '#ffffff' : '#78716c',
        background: active ? '#1e4b9e' : '#f7f4ef',
        border: `1px solid ${active ? '#1e4b9e' : '#e7e2d8'}`,
        borderRadius: 99,
        cursor: 'pointer',
        lineHeight: 1.4,
      }}
    >
      {children}
    </button>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = 'right',
  minWidth,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
  minWidth?: number
}) {
  const active = currentKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: '7px 12px',
        textAlign: align,
        color: active ? '#1e4b9e' : '#78716c',
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        minWidth,
      }}
    >
      {label}{' '}
      {active ? (currentDir === 'desc' ? '↓' : '↑') : <span style={{ color: '#e7e2d8' }}>↕</span>}
    </th>
  )
}

// ─── section A: KPI strip ─────────────────────────────────────────────────────

function KpiStrip({ kpis }: { kpis: ClosedVacanciesUnifiedData['kpis'] | undefined }) {
  const avgPct = kpis?.avgSuccessRate != null ? kpis.avgSuccessRate * 100 : null
  const successColor = rateColor(kpis?.avgSuccessRate ?? null)

  const items = [
    {
      label: 'Total vacantes cerradas',
      value: kpis ? kpis.totalVacancies.toLocaleString('es-AR') : '—',
      color: '#1c1917',
    },
    {
      label: '% Éxito promedio',
      value: avgPct !== null ? `${avgPct.toFixed(1)}%` : '—',
      color: successColor,
    },
    {
      label: 'Total CVs históricos',
      value: kpis ? kpis.totalCVsHistorical.toLocaleString('es-AR') : '—',
      color: '#1c1917',
    },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            flex: '1 1 160px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 12,
            padding: '14px 20px',
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: '#78716c',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 500,
              margin: 0,
              marginBottom: 6,
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: item.color,
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── section B: CVs por año — stacked bar chart ───────────────────────────────

type YearBarDatum = { year: string; [key: string]: string | number }

function CvsByYearChart({ byYear }: { byYear: ClosedVacanciesUnifiedData['byYear'] }) {
  // Identify global top-8 vacancies across all years
  const globalTotals = new Map<string, number>()
  for (const yr of Object.values(byYear)) {
    for (const v of yr.top) {
      globalTotals.set(v.title, (globalTotals.get(v.title) ?? 0) + v.cvs)
    }
  }
  const top8Titles = Array.from(globalTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([title]) => title)

  // Build dataset: one row per year
  const data: YearBarDatum[] = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, yrData]) => {
      const row: YearBarDatum = { year }
      let othersTotal = yrData.totalCVs
      for (const title of top8Titles) {
        const found = yrData.top.find((v) => v.title === title)
        const cvs = found?.cvs ?? 0
        row[title] = cvs
        othersTotal -= cvs
      }
      row['Otras'] = Math.max(0, othersTotal)
      return row
    })

  const hasData = data.length > 0

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e7e2d8',
          background: '#faf8f5',
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
          CVs recibidos por año
        </p>
        <p style={{ fontSize: 11, color: '#a8a29e', margin: '2px 0 0' }}>
          Top 8 vacantes · apilado
        </p>
      </div>
      <div style={{ padding: '16px 20px 8px' }}>
        {!hasData ? (
          <div
            style={{
              height: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a8a29e',
              fontSize: 13,
            }}
          >
            Sin datos anuales disponibles
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} width={44} />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e7e2d8',
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: '#1c1917', fontWeight: 600 }}
                formatter={((value: unknown, name: string) => [
                  typeof value === 'number' ? value.toLocaleString('es-AR') : String(value ?? ''),
                  truncateTitle(name, 40),
                ]) as never}
              />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                formatter={(value: string) => (
                  <span style={{ color: '#78716c' }}>{truncateTitle(value, 32)}</span>
                )}
              />
              {top8Titles.map((title, i) => (
                <Bar
                  key={title}
                  dataKey={title}
                  stackId="a"
                  fill={VACANCY_COLORS[i % VACANCY_COLORS.length]}
                  radius={i === top8Titles.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
              <Bar
                dataKey="Otras"
                stackId="a"
                fill={STACKED_OTHER_COLOR}
                radius={top8Titles.length === 0 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── section C-left: line chart ───────────────────────────────────────────────

function VacancyLineChart({
  vacancies,
  window,
}: {
  vacancies: ClosedVacancyUnified[]
  window: WeeksWindow
}) {
  const data = buildChartData(vacancies, window)

  if (data.length === 0) {
    return (
      <div
        style={{
          height: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#a8a29e',
          fontSize: 13,
        }}
      >
        Sin datos históricos
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" />
        <XAxis
          dataKey="weekLabel"
          tickFormatter={xAxisTickFormatter}
          tick={{ fontSize: 11, fill: '#78716c' }}
          interval={0}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} width={32} />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#1c1917', fontWeight: 600, marginBottom: 4 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          formatter={(value: string) => {
            const v = vacancies.find((vac) => vac.id === value)
            return (
              <span style={{ color: '#78716c' }}>{truncateTitle(v?.title ?? value)}</span>
            )
          }}
        />
        {vacancies.map((v, i) => (
          <Line
            key={v.id}
            type="monotone"
            dataKey={v.id}
            stroke={VACANCY_COLORS[i % VACANCY_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── section C-right: channel donut ──────────────────────────────────────────

function ChannelDonut({
  channelSummary,
}: {
  channelSummary: ClosedVacanciesUnifiedData['channelSummary'] | undefined
}) {
  const summary = channelSummary ?? { fr: 0, cp: 0, gw: 0, other: 0 }
  const total = summary.fr + summary.cp + summary.gw + summary.other
  const allZero = total === 0

  const pieData = [
    { name: 'FR (Fuente)', value: summary.fr, color: CHANNEL_COLORS.FR },
    { name: 'CP (Cómo llegó)', value: summary.cp, color: CHANNEL_COLORS.CP },
    { name: 'GW (Recruiter)', value: summary.gw, color: CHANNEL_COLORS.GW },
    { name: 'Otras', value: summary.other, color: CHANNEL_COLORS.Otras },
  ]

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e7e2d8',
          background: '#faf8f5',
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
          Canales de captación
        </p>
      </div>
      <div
        style={{
          flex: 1,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 280,
        }}
      >
        {allZero ? (
          <p style={{ color: '#a8a29e', fontSize: 13 }}>Sin datos de etiquetas</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e7e2d8',
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={((value: unknown, name: string) => {
                  const n = typeof value === 'number' ? value : 0
                  return [`${n.toLocaleString('es-AR')} (${total > 0 ? ((n / total) * 100).toFixed(1) : 0}%)`, name]
                }) as never}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string) => {
                  const entry = pieData.find((d) => d.name === value)
                  const pct =
                    total > 0 && entry
                      ? ` ${((entry.value / total) * 100).toFixed(1)}%`
                      : ''
                  return <span style={{ color: '#78716c' }}>{value}{pct}</span>
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── section C: two columns ───────────────────────────────────────────────────

function TwoColumnSection({
  vacancies,
  channelSummary,
  weeksWindow,
  onSetWeeks,
}: {
  vacancies: ClosedVacancyUnified[]
  channelSummary: ClosedVacanciesUnifiedData['channelSummary'] | undefined
  weeksWindow: WeeksWindow
  onSetWeeks: (w: WeeksWindow) => void
}) {
  const top12 = useMemo(
    () => [...vacancies].sort((a, b) => b.totalCandidates - a.totalCandidates).slice(0, 12),
    [vacancies],
  )

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {/* Left: line chart — 60% */}
      <div style={{ flex: '3 1 340px', minWidth: 0 }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e7e2d8',
              background: '#faf8f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
                Evolución semanal de CVs
              </p>
              <p style={{ fontSize: 12, color: '#a8a29e', margin: '2px 0 0' }}>
                Top 12 vacantes · últimas {weeksWindow} semanas
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <PillButton active={weeksWindow === 26} onClick={() => onSetWeeks(26)}>
                Últ. 26 sem.
              </PillButton>
              <PillButton active={weeksWindow === 52} onClick={() => onSetWeeks(52)}>
                52 sem.
              </PillButton>
            </div>
          </div>
          <div style={{ padding: '16px 20px 8px' }}>
            <VacancyLineChart vacancies={top12} window={weeksWindow} />
          </div>
        </div>
      </div>

      {/* Right: channel donut — 40% */}
      <div style={{ flex: '2 1 220px', minWidth: 0 }}>
        <ChannelDonut channelSummary={channelSummary} />
      </div>
    </div>
  )
}

// ─── section D: vacancy table ─────────────────────────────────────────────────

function SuccessRateBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <span style={{ color: '#a8a29e', fontSize: 12 }}>—</span>
  }
  const pct = rate * 100
  const color = rateColorByPct(pct)
  const bgColor = pct >= 20 ? '#dcfce7' : pct >= 10 ? '#fef3c7' : '#fee2e2'

  return (
    <div
      style={{
        position: 'relative',
        background: '#f7f4ef',
        borderRadius: 4,
        overflow: 'hidden',
        height: 20,
        minWidth: 64,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          background: bgColor,
          width: `${Math.min(100, pct)}%`,
          borderRadius: 4,
        }}
      />
      <span
        style={{
          position: 'relative',
          fontSize: 11,
          fontWeight: 600,
          color,
          padding: '0 6px',
          lineHeight: '20px',
          display: 'block',
          textAlign: 'center',
        }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function VacancyTable({
  vacancies,
  profesionFilter,
}: {
  vacancies: ClosedVacancyUnified[]
  profesionFilter: TipoProfesional | 'todos'
}) {
  const [sortKey, setSortKey] = useState<SortKey>('totalCandidates')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAll, setShowAll] = useState(false)
  const PAGE = 20

  const filtered = useMemo(
    () =>
      profesionFilter === 'todos'
        ? vacancies
        : vacancies.filter((v) => deriveProfesionTipo(v.title) === profesionFilter),
    [vacancies, profesionFilter],
  )

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number | null
      let vb: string | number | null

      switch (sortKey) {
        case 'title':
          va = a.title.toLowerCase()
          vb = b.title.toLowerCase()
          break
        case 'year':
          va = a.year ?? 0
          vb = b.year ?? 0
          break
        case 'totalCandidates':
          va = a.totalCandidates
          vb = b.totalCandidates
          break
        case 'hiredCount':
          va = a.hiredCount
          vb = b.hiredCount
          break
        case 'successRate':
          va = a.successRate ?? -1
          vb = b.successRate ?? -1
          break
        case 'peakWeekLabel':
          va = a.peakWeekLabel ?? ''
          vb = b.peakWeekLabel ?? ''
          break
        default:
          va = 0
          vb = 0
      }

      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const displayed = showAll ? sorted : sorted.slice(0, PAGE)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e7e2d8',
          background: '#faf8f5',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
          Detalle por vacante
        </p>
        <span
          style={{
            background: '#e7e2d8',
            color: '#78716c',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 99,
          }}
        >
          {filtered.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f4ef', borderBottom: '1px solid #e7e2d8' }}>
              <SortableHeader
                label="Vacante"
                sortKey="title"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                align="left"
                minWidth={240}
              />
              <th
                style={{
                  padding: '7px 12px',
                  textAlign: 'left',
                  color: '#78716c',
                  fontWeight: 500,
                  minWidth: 80,
                  whiteSpace: 'nowrap',
                }}
              >
                País
              </th>
              <SortableHeader
                label="Año"
                sortKey="year"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={60}
              />
              <SortableHeader
                label="CVs"
                sortKey="totalCandidates"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={80}
              />
              <SortableHeader
                label="Contratados"
                sortKey="hiredCount"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={90}
              />
              <SortableHeader
                label="% Éxito"
                sortKey="successRate"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={100}
              />
              <SortableHeader
                label="Pico"
                sortKey="peakWeekLabel"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                minWidth={90}
              />
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#a8a29e',
                    fontSize: 13,
                  }}
                >
                  Sin vacantes para el filtro seleccionado
                </td>
              </tr>
            ) : (
              displayed.map((v, index) => {
                const country = getVacancyCountry(v.title)
                const c = COUNTRY_COLORS[country]
                const rowBg = index % 2 === 0 ? '#ffffff' : '#faf8f5'

                return (
                  <tr
                    key={v.id}
                    style={{ background: rowBg, borderBottom: '1px solid #f0ece4' }}
                  >
                    {/* Vacante */}
                    <td
                      style={{
                        padding: '7px 12px',
                        color: '#1c1917',
                        fontWeight: 500,
                        maxWidth: 320,
                      }}
                    >
                      <span
                        title={v.title}
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.title}
                      </span>
                    </td>

                    {/* País */}
                    <td style={{ padding: '7px 12px' }}>
                      <span
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {country}
                      </span>
                    </td>

                    {/* Año */}
                    <td
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#78716c',
                      }}
                    >
                      {v.year ?? <span style={{ color: '#a8a29e' }}>—</span>}
                    </td>

                    {/* CVs */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#1c1917',
                        fontWeight: 600,
                      }}
                    >
                      {v.totalCandidates.toLocaleString('es-AR')}
                    </td>

                    {/* Contratados */}
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#1c1917',
                      }}
                    >
                      {v.hiredCount.toLocaleString('es-AR')}
                    </td>

                    {/* % Éxito */}
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      <SuccessRateBar rate={v.successRate} />
                    </td>

                    {/* Pico */}
                    <td
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color: '#78716c',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.peakWeekLabel ?? <span style={{ color: '#a8a29e' }}>—</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Ver más */}
      {!showAll && sorted.length > PAGE && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e7e2d8',
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              fontSize: 12,
              color: '#1e4b9e',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Ver las {sorted.length - PAGE} vacantes restantes ↓
          </button>
        </div>
      )}
    </div>
  )
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: '1 1 160px',
              background: '#ffffff',
              border: '1px solid #e7e2d8',
              borderRadius: 12,
              padding: '14px 20px',
              boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
            }}
          >
            <div
              style={{ width: 120, height: 12, background: '#f0ece4', borderRadius: 4 }}
              className="animate-pulse"
            />
            <div
              style={{
                width: 80,
                height: 28,
                background: '#f0ece4',
                borderRadius: 4,
                marginTop: 8,
              }}
              className="animate-pulse"
            />
          </div>
        ))}
      </div>

      {/* Bar chart placeholder */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        }}
      >
        <div
          style={{ height: 220, background: '#faf8f5', borderRadius: 8 }}
          className="animate-pulse"
        />
      </div>

      {/* Two columns */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div
          style={{
            flex: '3 1 340px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          <div
            style={{ height: 360, background: '#faf8f5', borderRadius: 8 }}
            className="animate-pulse"
          />
        </div>
        <div
          style={{
            flex: '2 1 220px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
          }}
        >
          <div
            style={{ height: 300, background: '#faf8f5', borderRadius: 8 }}
            className="animate-pulse"
          />
        </div>
      </div>

      {/* Table placeholder */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e7e2d8',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
        }}
      >
        <div
          style={{ height: 280, background: '#faf8f5', borderRadius: 8 }}
          className="animate-pulse"
        />
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  profesionFilter?: TipoProfesional | 'todos'
}

export default function ClosedVacancyCvsView({ profesionFilter = 'todos' }: Props) {
  const [weeksWindow, setWeeksWindow] = useState<WeeksWindow>(26)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ClosedVacanciesUnifiedData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const result = await getClosedVacanciesUnified(52)
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data) return null

  // Apply profesion filter for the table and line chart
  const filteredVacancies =
    profesionFilter === 'todos'
      ? data.vacancies
      : data.vacancies.filter((v) => deriveProfesionTipo(v.title) === profesionFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* A — KPI strip */}
      <KpiStrip kpis={data.kpis} />

      {/* B — CVs por año (stacked) */}
      <CvsByYearChart byYear={data.byYear} />

      {/* C — two columns: line chart + donut */}
      <TwoColumnSection
        vacancies={filteredVacancies}
        channelSummary={data.channelSummary}
        weeksWindow={weeksWindow}
        onSetWeeks={setWeeksWindow}
      />

      {/* D — vacancy table */}
      <VacancyTable vacancies={data.vacancies} profesionFilter={profesionFilter} />
    </div>
  )
}
