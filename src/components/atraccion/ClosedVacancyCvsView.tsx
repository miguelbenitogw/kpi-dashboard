'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getClosedVacancyCvsHistoryByVacancy,
  type ClosedVacancyBySeries,
} from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'
import { type TipoProfesional, deriveProfesionTipo } from '@/lib/utils/vacancy-profession'

// ─── constants ────────────────────────────────────────────────────────────────

/** 12 branded colors — enough for top-12 vacancies */
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

type WeeksWindow = 26 | 52

// ─── types ────────────────────────────────────────────────────────────────────

type ChartDataPoint = {
  weekLabel: string
  [vacancyId: string]: string | number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildChartData(
  vacancies: ClosedVacancyBySeries[],
  window: WeeksWindow,
): ChartDataPoint[] {
  if (vacancies.length === 0) return []

  // All vacancies share the same week series — use the first as reference
  const allPoints = vacancies[0].points
  const sliced = allPoints.slice(-window)

  return sliced.map((point) => {
    const row: ChartDataPoint = { weekLabel: point.weekLabel }
    for (const v of vacancies) {
      const match = v.points.find((p) => p.weekStart === point.weekStart)
      row[v.vacancyId] = match?.count ?? 0
    }
    return row
  })
}

/** Show every 4th tick to avoid crowding */
function xAxisTickFormatter(value: string, index: number): string {
  return index % 4 === 0 ? value : ''
}

/** Truncate long vacancy titles for the legend */
function truncateTitle(title: string, maxLength = 38): string {
  return title.length <= maxLength ? title : `${title.slice(0, maxLength - 1)}…`
}

// ─── pill button ─────────────────────────────────────────────────────────────

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
        transition: 'all 0.15s',
        lineHeight: 1.4,
      }}
    >
      {children}
    </button>
  )
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e7e2d8' }}>
        <div
          style={{ width: 280, height: 18, background: '#f0ece4', borderRadius: 6 }}
          className="animate-pulse"
        />
        <div
          style={{ width: 180, height: 13, background: '#f7f4ef', borderRadius: 6, marginTop: 6 }}
          className="animate-pulse"
        />
      </div>
      <div style={{ padding: 20 }}>
        <div
          style={{ height: 320, background: '#faf8f5', borderRadius: 8 }}
          className="animate-pulse"
        />
      </div>
    </div>
  )
}

// ─── line chart ───────────────────────────────────────────────────────────────

function VacancyLineChart({
  vacancies,
  window,
}: {
  vacancies: ClosedVacancyBySeries[]
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
        Sin datos históricos — ejecutá el sync de vacantes cerradas
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
            const v = vacancies.find((vac) => vac.vacancyId === value)
            return truncateTitle(v?.title ?? value)
          }}
        />
        {vacancies.map((v, i) => (
          <Line
            key={v.vacancyId}
            type="monotone"
            dataKey={v.vacancyId}
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

// ─── summary table ────────────────────────────────────────────────────────────

function VacancySummaryTable({ vacancies }: { vacancies: ClosedVacancyBySeries[] }) {
  if (vacancies.length === 0) return null

  return (
    <div
      className="overflow-x-auto"
      style={{ borderTop: '1px solid #e7e2d8', marginTop: 8 }}
    >
      <table className="w-full" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f7f4ef', borderBottom: '1px solid #e7e2d8' }}>
            <th
              style={{
                padding: '7px 12px',
                textAlign: 'left',
                color: '#78716c',
                fontWeight: 500,
                minWidth: 260,
              }}
            >
              Vacante
            </th>
            <th
              style={{
                padding: '7px 12px',
                textAlign: 'left',
                color: '#78716c',
                fontWeight: 500,
                minWidth: 80,
              }}
            >
              País
            </th>
            <th
              style={{
                padding: '7px 12px',
                textAlign: 'right',
                color: '#78716c',
                fontWeight: 500,
              }}
            >
              Total CVs
            </th>
            <th
              style={{
                padding: '7px 12px',
                textAlign: 'right',
                color: '#78716c',
                fontWeight: 500,
                minWidth: 100,
              }}
            >
              Semana pico
            </th>
          </tr>
        </thead>
        <tbody>
          {vacancies.map((v, index) => {
            const country = getVacancyCountry(v.title)
            const c = COUNTRY_COLORS[country]
            const rowBg = index % 2 === 0 ? '#ffffff' : '#faf8f5'
            const dotColor = VACANCY_COLORS[index % VACANCY_COLORS.length]

            return (
              <tr
                key={v.vacancyId}
                style={{ background: rowBg, borderBottom: '1px solid #f0ece4' }}
              >
                <td style={{ padding: '7px 12px', color: '#1c1917', fontWeight: 500 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    {v.title}
                  </span>
                </td>
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
                <td
                  style={{
                    padding: '7px 12px',
                    textAlign: 'right',
                    color: '#1c1917',
                    fontWeight: 600,
                  }}
                  className="tabular-nums"
                >
                  {v.totalCandidates.toLocaleString('es-AR')}
                </td>
                <td
                  style={{
                    padding: '7px 12px',
                    textAlign: 'right',
                    color: '#78716c',
                  }}
                >
                  {v.peakWeekLabel ?? <span style={{ color: '#a8a29e' }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
  const [allVacancies, setAllVacancies] = useState<ClosedVacancyBySeries[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const data = await getClosedVacancyCvsHistoryByVacancy(52)
      if (!cancelled) {
        setAllVacancies(data)
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  // Apply profesion filter — keep vacancies whose title matches the selected type
  const vacancies =
    profesionFilter === 'todos'
      ? allVacancies
      : allVacancies.filter((v) => deriveProfesionTipo(v.title) === profesionFilter)

  if (loading) return <LoadingSkeleton />

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
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            CVs históricos por vacante cerrada
          </p>
          <p style={{ fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
            Top 12 vacantes · Datos de Zoho backfilleados
          </p>
        </div>

        {/* Weeks toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          <PillButton active={weeksWindow === 26} onClick={() => setWeeksWindow(26)}>
            Últ. 26 sem.
          </PillButton>
          <PillButton active={weeksWindow === 52} onClick={() => setWeeksWindow(52)}>
            52 sem.
          </PillButton>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '16px 20px 8px' }}>
        <VacancyLineChart vacancies={vacancies} window={weeksWindow} />
      </div>

      {/* Summary table */}
      <VacancySummaryTable vacancies={vacancies} />
    </div>
  )
}
