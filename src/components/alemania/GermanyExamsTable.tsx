'use client'

import { useState } from 'react'
import type { GermanyExamRow } from '@/lib/queries/germany'

interface Props {
  rows: GermanyExamRow[]
  selectedPromo?: number | null
  onPromoClick?: (promo: number | null) => void
}

const PAGE_SIZE = 5

function Badge({
  value,
  bg,
  color,
}: {
  value: number
  bg: string
  color: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px',
        padding: '2px 8px',
        borderRadius: '99px',
        fontSize: '12px',
        fontWeight: 600,
        background: bg,
        color,
      }}
    >
      {value}
    </span>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const bg =
    clamped >= 75
      ? '#16a34a'
      : clamped >= 50
      ? '#d97706'
      : '#dc2626'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          background: '#e7e2d8',
          borderRadius: '99px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            background: bg,
            borderRadius: '99px',
            transition: 'width 600ms ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: bg,
          minWidth: '36px',
          textAlign: 'right',
        }}
      >
        {Math.round(clamped)}%
      </span>
    </div>
  )
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#78716c',
  borderBottom: '1px solid #e7e2d8',
  whiteSpace: 'nowrap',
}

const TD_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: '#1c1917',
  borderBottom: '1px solid #e7e2d8',
  verticalAlign: 'middle',
}

export default function GermanyExamsTable({ rows, selectedPromo, onPromoClick }: Props) {
  const [page, setPage] = useState(0)

  if (rows.length === 0) {
    return (
      <p style={{ color: '#78716c', fontSize: '13px', margin: 0 }}>
        No hay datos de exámenes disponibles.
      </p>
    )
  }

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const firstPromo = visible[0]?.promo_numero
  const lastPromo = visible[visible.length - 1]?.promo_numero

  function handleRowClick(promo: number) {
    if (!onPromoClick) return
    onPromoClick(selectedPromo === promo ? null : promo)
  }

  return (
    <div>
      {/* Header de paginación */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#78716c',
            letterSpacing: '0.03em',
          }}
        >
          {firstPromo != null && lastPromo != null
            ? `Promos #${firstPromo} – #${lastPromo}`
            : ''}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            style={{
              background: '#f5f1ea',
              border: '1px solid #e7e2d8',
              borderRadius: '8px',
              padding: '4px 10px',
              color: '#1c1917',
              fontSize: '13px',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              opacity: page === 0 ? 0.4 : 1,
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            style={{
              background: '#f5f1ea',
              border: '1px solid #e7e2d8',
              borderRadius: '8px',
              padding: '4px 10px',
              color: '#1c1917',
              fontSize: '13px',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages - 1 ? 0.4 : 1,
              lineHeight: 1,
            }}
          >
            →
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f7f4' }}>
              <th style={TH_STYLE}>Promo #</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>Total</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>In Training</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>To Place</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>Hired</th>
              <th style={{ ...TH_STYLE, minWidth: '160px' }}>% Colocación</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>B1 ✓</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>B2 ✓</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>IQZ</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>Berlín</th>
              <th style={{ ...TH_STYLE, textAlign: 'center' }}>Stand By</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isSelected = selectedPromo === row.promo_numero
              const isClickable = !!onPromoClick

              return (
                <tr
                  key={row.promo_numero}
                  onClick={() => handleRowClick(row.promo_numero)}
                  style={{
                    transition: 'background 150ms',
                    background: isSelected ? '#fff7ed' : 'transparent',
                    borderLeft: isSelected ? '3px solid #e55a2b' : '3px solid transparent',
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = '#faf9f7'
                    }
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLTableRowElement).style.background =
                      isSelected ? '#fff7ed' : 'transparent'
                  }}
                >
                  <td style={TD_STYLE}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#1e4b9e',
                        fontSize: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      {isSelected && (
                        <span style={{ color: '#e55a2b', fontSize: '10px', lineHeight: 1 }}>
                          ●
                        </span>
                      )}
                      #{row.promo_numero}
                    </span>
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{row.num_total ?? 0}</span>
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    <Badge
                      value={
                        (row.num_in_training ?? 0) > 9999 ? 0 : (row.num_in_training ?? 0)
                      }
                      bg="#dbeafe"
                      color="#1d4ed8"
                    />
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    <Badge
                      value={row.num_to_place ?? 0}
                      bg="#fef3c7"
                      color="#d97706"
                    />
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    <Badge
                      value={row.estado_hired ?? 0}
                      bg="#dcfce7"
                      color="#16a34a"
                    />
                  </td>
                  <td style={{ ...TD_STYLE, minWidth: '160px' }}>
                    <ProgressBar pct={row.pct_colocacion ?? 0} />
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>
                      {(row.b1_aprobados_1a ?? 0) + (row.b1_aprobados_2a ?? 0)}
                    </span>
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#1e4b9e' }}>
                      {row.b2_aprobados_1a ?? 0}
                    </span>
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    {row.estado_iqz ?? 0}
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    {row.estado_berlin ?? 0}
                  </td>
                  <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                    {row.estado_standby ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
