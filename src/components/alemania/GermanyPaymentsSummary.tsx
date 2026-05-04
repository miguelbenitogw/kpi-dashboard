'use client'

import type { GermanyPaymentsSummary as PaymentsSummary } from '@/lib/queries/germany'

interface Props {
  summary: PaymentsSummary
}

function fmt(amount: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const TD_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13px',
  color: '#1c1917',
  borderBottom: '1px solid #e7e2d8',
  verticalAlign: 'middle',
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#78716c',
  borderBottom: '1px solid #e7e2d8',
  background: '#f9f7f4',
  whiteSpace: 'nowrap' as const,
}

export default function GermanyPaymentsSummary({ summary }: Props) {
  const { total_facturado, total_pendiente, rows } = summary
  const cobrado = total_facturado - total_pendiente
  const pctCobrado =
    total_facturado > 0
      ? Math.round((cobrado / total_facturado) * 100)
      : 0

  return (
    <div>
      {/* KPI cards de pagos */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div
          style={{
            flex: 1,
            minWidth: '160px',
            background: '#ffffff',
            border: '1px solid #e7e2d8',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#78716c',
            }}
          >
            Total facturado
          </p>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1c1917',
              lineHeight: 1,
            }}
          >
            {fmt(total_facturado)}
          </p>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: '160px',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#16a34a',
            }}
          >
            Cobrado
          </p>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#16a34a',
              lineHeight: 1,
            }}
          >
            {fmt(cobrado)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#4ade80' }}>
            {pctCobrado}% del total
          </p>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: '160px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#d97706',
            }}
          >
            Pendiente
          </p>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#d97706',
              lineHeight: 1,
            }}
          >
            {fmt(total_pendiente)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fb923c' }}>
            {100 - pctCobrado}% pendiente
          </p>
        </div>
      </div>

      {/* Barra de progreso global */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            height: '8px',
            background: '#e7e2d8',
            borderRadius: '99px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pctCobrado}%`,
              background: '#16a34a',
              borderRadius: '99px',
              transition: 'width 600ms ease',
            }}
          />
        </div>
      </div>

      {/* Tabla de candidatos con pagos */}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Nombre</th>
                <th style={TH_STYLE}>Promo</th>
                <th style={TH_STYLE}>Profesión</th>
                <th style={TH_STYLE}>Empresa</th>
                <th style={TH_STYLE}>Modalidad</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Total</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pendientePct =
                  (row.importe_total ?? 0) > 0
                    ? ((row.importe_pendiente ?? 0) / (row.importe_total ?? 1)) * 100
                    : 0
                const hasPendiente = (row.importe_pendiente ?? 0) > 0

                return (
                  <tr
                    key={`${row.nombre}-${i}`}
                    style={{ transition: 'background 150ms' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = '#faf9f7'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                    }}
                  >
                    <td style={{ ...TD_STYLE, fontWeight: 500 }}>
                      {row.nombre ?? '—'}
                    </td>
                    <td style={TD_STYLE}>
                      {row.promo_numero !== null ? (
                        <span style={{ fontWeight: 600, color: '#1e4b9e', fontSize: '12px' }}>
                          #{row.promo_numero}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...TD_STYLE, color: '#57534e' }}>
                      {row.profesion ?? '—'}
                    </td>
                    <td style={{ ...TD_STYLE, color: '#57534e' }}>
                      {row.empresa ?? '—'}
                    </td>
                    <td style={TD_STYLE}>
                      {row.modalidad ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#eff6ff',
                            color: '#1e4b9e',
                          }}
                        >
                          {row.modalidad}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'right', fontWeight: 600 }}>
                      {fmt(row.importe_total ?? 0)}
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'right' }}>
                      {hasPendiente ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color: pendientePct > 50 ? '#dc2626' : '#d97706',
                          }}
                        >
                          {fmt(row.importe_pendiente ?? 0)}
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Pagado</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <p style={{ color: '#78716c', fontSize: '13px', margin: 0 }}>
          No hay datos de pagos disponibles.
        </p>
      )}
    </div>
  )
}
