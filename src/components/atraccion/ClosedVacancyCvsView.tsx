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
  getClosedVacancyCvsHistory,
  getClosedVacancyCvsByPromo,
  type ClosedVacancyCvsEntry,
  type ClosedVacancyPromoSummary,
} from '@/lib/queries/atraccion'
import { getVacancyCountry, COUNTRY_COLORS } from '@/lib/utils/vacancy-country'
import { type TipoProfesional, deriveProfesionTipo } from '@/lib/utils/vacancy-profession'

// ─── constants ────────────────────────────────────────────────────────────────

const PROMO_COLORS = [
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
]

type SubView = 'promo' | 'vacante'
type WeeksWindow = 26 | 52

// ─── types ────────────────────────────────────────────────────────────────────

type ChartDataPoint = {
  weekLabel: string
  [promoName: string]: string | number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildChartData(
  promos: ClosedVacancyPromoSummary[],
  window: WeeksWindow,
): ChartDataPoint[] {
  if (promos.length === 0) return []

  const allPoints = promos[0].history
  const sliced = allPoints.slice(-window)

  return sliced.map((point) => {
    const row: ChartDataPoint = { weekLabel: point.weekLabel }
    for (const promo of promos) {
      const match = promo.history.find((p) => p.weekStart === point.weekStart)
      row[promo.promoName] = match?.count ?? 0
    }
    return row
  })
}

// Show every 4th tick to avoid crowding
function xAxisTickFormatter(value: string, index: number): string {
  return index % 4 === 0 ? value : ''
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
          style={{ width: 260, height: 18, background: '#f0ece4', borderRadius: 6 }}
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

// ─── promo line chart view ────────────────────────────────────────────────────

function PromoLineChart({
  promos,
  window,
}: {
  promos: ClosedVacancyPromoSummary[]
  window: WeeksWindow
}) {
  const top10 = promos.slice(0, 10)
  const data = buildChartData(top10, window)

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
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        {top10.map((promo, i) => (
          <Line
            key={promo.promoName}
            type="monotone"
            dataKey={promo.promoName}
            stroke={PROMO_COLORS[i % PROMO_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── vacancy table view ───────────────────────────────────────────────────────

function VacancyTable({
  entries,
  profesionFilter = 'todos',
}: {
  entries: ClosedVacancyCvsEntry[]
  profesionFilter?: TipoProfesional | 'todos'
}) {
  const rows = (
    profesionFilter === 'todos'
      ? entries
      : entries.filter((e) => deriveProfesionTipo(e.title) === profesionFilter)
  ).slice(0, 50)

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: '#a8a29e',
          fontSize: 13,
        }}
      >
        Sin datos históricos — ejecutá el sync de vacantes cerradas
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f7f4ef', borderBottom: '1px solid #e7e2d8' }}>
            <th
              style={{
                padding: '8px 12px',
                textAlign: 'left',
                color: '#78716c',
                fontWeight: 500,
                fontSize: 12,
                minWidth: 280,
              }}
            >
              Vacante
            </th>
            <th
              style={{
                padding: '8px 12px',
                textAlign: 'left',
                color: '#78716c',
                fontWeight: 500,
                fontSize: 12,
                minWidth: 140,
              }}
            >
              Promo
            </th>
            <th
              style={{
                padding: '8px 12px',
                textAlign: 'right',
                color: '#78716c',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              Total CVs
            </th>
            <th
              style={{
                padding: '8px 12px',
                textAlign: 'right',
                color: '#78716c',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              Contratados
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry, index) => {
            const country = getVacancyCountry(entry.title)
            const c = COUNTRY_COLORS[country]
            const rowBg = index % 2 === 0 ? '#ffffff' : '#faf8f5'

            return (
              <tr
                key={entry.vacancyId}
                style={{ background: rowBg, borderBottom: '1px solid #f0ece4' }}
              >
                <td style={{ padding: '8px 12px', color: '#1c1917', fontWeight: 500 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {entry.title}
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
                        flexShrink: 0,
                      }}
                    >
                      {country}
                    </span>
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: '#78716c' }}>
                  {entry.promoName ?? (
                    <span style={{ color: '#a8a29e', fontStyle: 'italic' }}>Sin promo</span>
                  )}
                </td>
                <td
                  style={{ padding: '8px 12px', textAlign: 'right', color: '#1c1917', fontWeight: 600 }}
                  className="tabular-nums"
                >
                  {entry.totalCandidates.toLocaleString('es-AR')}
                </td>
                <td
                  style={{ padding: '8px 12px', textAlign: 'right', color: '#78716c' }}
                  className="tabular-nums"
                >
                  {entry.hiredCount}
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

export default function ClosedVacancyCvsView({
  profesionFilter = 'todos',
}: {
  profesionFilter?: TipoProfesional | 'todos'
}) {
  const [subView, setSubView] = useState<SubView>('promo')
  const [weeksWindow, setWeeksWindow] = useState<WeeksWindow>(26)
  const [loading, setLoading] = useState(true)
  const [promos, setPromos] = useState<ClosedVacancyPromoSummary[]>([])
  const [entries, setEntries] = useState<ClosedVacancyCvsEntry[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [promosData, entriesData] = await Promise.all([
        getClosedVacancyCvsByPromo(52),
        getClosedVacancyCvsHistory(52),
      ])
      if (!cancelled) {
        setPromos(promosData)
        setEntries(entriesData)
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

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
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1c1917', margin: 0 }}>
            CVs históricos — Vacantes cerradas
          </p>
          <p style={{ fontSize: 12, color: '#a8a29e', marginTop: 2 }}>
            Datos de Zoho backfilleados
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Sub-view toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            <PillButton active={subView === 'promo'} onClick={() => setSubView('promo')}>
              Por promo
            </PillButton>
            <PillButton active={subView === 'vacante'} onClick={() => setSubView('vacante')}>
              Por vacante
            </PillButton>
          </div>

          {/* Weeks toggle — only relevant for chart */}
          {subView === 'promo' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <PillButton active={weeksWindow === 26} onClick={() => setWeeksWindow(26)}>
                Últ. 26 sem.
              </PillButton>
              <PillButton active={weeksWindow === 52} onClick={() => setWeeksWindow(52)}>
                52 sem.
              </PillButton>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: subView === 'promo' ? '16px 20px' : 0 }}>
        {subView === 'promo' ? (
          <PromoLineChart promos={promos} window={weeksWindow} />
        ) : (
          <VacancyTable entries={entries} profesionFilter={profesionFilter} />
        )}
      </div>
    </div>
  )
}
