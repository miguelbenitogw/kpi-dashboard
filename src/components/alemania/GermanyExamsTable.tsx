import type { GermanyExamRow } from '@/lib/queries/germany'

interface Props {
  rows: GermanyExamRow[]
}

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

export default function GermanyExamsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p style={{ color: '#78716c', fontSize: '13px', margin: 0 }}>
        No hay datos de exámenes disponibles.
      </p>
    )
  }

  return (
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
          {rows.map((row) => (
            <tr
              key={row.promo_numero}
              style={{ transition: 'background 150ms' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background = '#faf9f7'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
              }}
            >
              <td style={TD_STYLE}>
                <span
                  style={{
                    fontWeight: 700,
                    color: '#1e4b9e',
                    fontSize: '14px',
                  }}
                >
                  #{row.promo_numero}
                </span>
              </td>
              <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                <span style={{ fontWeight: 600 }}>{row.num_total ?? 0}</span>
              </td>
              <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                <Badge
                  value={row.num_in_training ?? 0}
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
