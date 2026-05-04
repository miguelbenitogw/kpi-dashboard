import type { GermanyKpis } from '@/lib/queries/germany'

interface Props {
  kpis: GermanyKpis
}

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  success?: boolean
}

function KpiCard({ label, value, sub, accent, success }: KpiCardProps) {
  const borderColor = success ? '#86efac' : accent ? '#bfdbfe' : '#e7e2d8'
  const bgColor = success ? '#f0fdf4' : accent ? '#eff6ff' : '#ffffff'
  const valueColor = success ? '#16a34a' : accent ? '#1e4b9e' : '#1c1917'

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '16px 20px',
        flex: 1,
        minWidth: 0,
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
        {label}
      </p>
      <p
        style={{
          margin: '8px 0 2px',
          fontSize: '1.875rem',
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: 0, fontSize: '12px', color: '#a8a29e' }}>{sub}</p>
      )}
    </div>
  )
}

export default function GermanyKpiStrip({ kpis }: Props) {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <KpiCard
        label="Total candidatos"
        value={kpis.total_candidatos}
        sub="en la base de datos"
      />
      <KpiCard
        label="Hired"
        value={kpis.hired}
        sub={`de ${kpis.total_candidatos} totales`}
        success
      />
      <KpiCard
        label="Tasa de éxito"
        value={`${kpis.tasa_exito}%`}
        sub="hired / total"
        accent
      />
      <KpiCard
        label="Promos activas"
        value={kpis.promos_activas}
        sub="con candidatos en curso"
      />
    </div>
  )
}
