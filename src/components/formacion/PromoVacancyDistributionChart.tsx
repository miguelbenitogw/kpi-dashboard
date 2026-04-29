'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getVacancyDistributionByPromo,
  type VacancyDistributionRow,
} from '@/lib/queries/formacion'
import {
  COUNTRY_COLORS,
  getVacancyCountry,
} from '@/lib/utils/vacancy-country'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #e7e2d8',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#1c1917',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  labelStyle: { color: '#1c1917', fontWeight: 600 },
  itemStyle: { color: '#44403c' },
}

/** Truncate a label to n chars, appending ellipsis if needed. */
function truncate(str: string, n: number): string {
  return str.length <= n ? str : str.slice(0, n - 1) + '…'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div
        style={{
          height: '16px',
          width: '220px',
          background: '#e7e2d8',
          borderRadius: '6px',
          marginBottom: '18px',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: '240px',
          background: '#f5f1ea',
          borderRadius: '10px',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty() {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: '14px',
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '13px', color: '#78716c' }}>
        No hay datos de vacantes de atracción para esta promoción.
      </p>
    </div>
  )
}

// ─── Custom Y-axis tick ───────────────────────────────────────────────────────

function CustomYTick(props: any) {
  const { x, y, payload } = props
  const label = truncate(payload.value, 35)
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#44403c"
        fontSize={11}
      >
        {label}
      </text>
    </g>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  promoNombre: string
}

export default function PromoVacancyDistributionChart({ promoNombre }: Props) {
  const [data, setData] = useState<VacancyDistributionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!promoNombre) return
    setLoading(true)
    getVacancyDistributionByPromo(promoNombre).then((rows) => {
      setData(rows)
      setLoading(false)
    })
  }, [promoNombre])

  if (loading) return <Skeleton />
  if (data.length === 0) return <Empty />

  // Derive country for bar color, falling back to title-based detection when
  // pais_destino is not stored in job_openings_kpi.
  function barColor(row: VacancyDistributionRow): string {
    const country = getVacancyCountry(row.pais_destino ?? row.vacancyTitle)
    return COUNTRY_COLORS[country].text
  }

  function barBg(row: VacancyDistributionRow): string {
    const country = getVacancyCountry(row.pais_destino ?? row.vacancyTitle)
    return COUNTRY_COLORS[country].bg
  }

  // Height: at least 200px, 44px per row
  const chartHeight = Math.max(200, data.length * 44)

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e2d8',
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#1c1917',
            margin: 0,
          }}
        >
          Vacantes de Atracción
        </h3>
        <p style={{ fontSize: '12px', color: '#78716c', margin: '2px 0 0' }}>
          Alumnos de <strong>{promoNombre}</strong> por vacante de atracción
        </p>
      </div>

      {/* Horizontal bar chart */}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 28, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e7e2d8"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: '#78716c', fontSize: 11 }}
              axisLine={{ stroke: '#e7e2d8' }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="vacancyTitle"
              width={200}
              axisLine={false}
              tickLine={false}
              tick={<CustomYTick />}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number) => [
                v.toLocaleString('es-AR') + ' alumno' + (v !== 1 ? 's' : ''),
                'Total',
              ]}
              labelFormatter={(label: string) => truncate(label, 50)}
            />
            <Bar dataKey="studentCount" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {data.map((row, i) => (
                <Cell key={i} fill={barBg(row)} stroke={barColor(row)} strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div style={{ marginTop: '20px' }}>
        <p
          style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#78716c',
            marginBottom: '8px',
          }}
        >
          Detalle
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              color: '#1c1917',
            }}
          >
            <thead>
              <tr>
                {['Vacante', 'País', 'Alumnos'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === 'Alumnos' ? 'right' : 'left',
                      padding: '4px 8px',
                      borderBottom: '1px solid #e7e2d8',
                      fontWeight: 600,
                      color: '#78716c',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const country = getVacancyCountry(
                  row.pais_destino ?? row.vacancyTitle,
                )
                const colors = COUNTRY_COLORS[country]
                return (
                  <tr
                    key={row.vacancyId}
                    style={{
                      background: i % 2 === 0 ? '#ffffff' : '#fafaf9',
                    }}
                  >
                    <td
                      style={{
                        padding: '5px 8px',
                        maxWidth: '280px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.vacancyTitle}
                    >
                      {row.vacancyTitle}
                    </td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '1px 7px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {row.pais_destino ?? country}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                      }}
                    >
                      {row.studentCount.toLocaleString('es-AR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
