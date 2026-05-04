import { getResumenVacantesPrincipales } from '@/lib/queries/atraccion'
import { PROFESION_LABELS } from '@/lib/utils/vacancy-profession'

// ─── Paleta warm-light ────────────────────────────────────────────────────────
const P = {
  bg: '#f9f7f4',
  card: '#ffffff',
  border: '#e7e2d8',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#1e4b9e',
  badgeBg: '#eef2fb',
  badgeColor: '#1e4b9e',
}

export default async function VacantesPrincipalesStrip() {
  const vacantes = await getResumenVacantesPrincipales()

  if (vacantes.length === 0) return null

  return (
    <section>
      {/* Encabezado de sección */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 2,
            background: P.accent,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 700, color: P.accent }}>
          Vacantes principales
        </span>
        <span style={{ fontSize: 12, color: P.muted, marginLeft: 4 }}>
          Una por tipo de profesional
        </span>
      </div>

      {/* Strip de tarjetas */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 4,
          // Scrollbar discreta
          scrollbarWidth: 'thin',
          scrollbarColor: `${P.border} transparent`,
        }}
      >
        {vacantes.map((v) => {
          const label = PROFESION_LABELS[v.tipo_profesional] ?? v.tipo_profesional

          const successPct =
            v.success_rate !== null ? `${v.success_rate}%` : '—'

          return (
            <article
              key={v.id}
              style={{
                flex: '0 0 auto',
                minWidth: 200,
                maxWidth: 240,
                background: P.card,
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(28,25,23,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Badge tipo profesional */}
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: P.badgeBg,
                    color: P.badgeColor,
                    borderRadius: 99,
                    padding: '2px 8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Título */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: P.text,
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title={v.title}
              >
                {v.zoho_job_number != null ? `#${v.zoho_job_number} — ` : ''}
                {v.title}
              </div>

              {/* KPIs */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 2,
                  borderTop: `1px solid ${P.border}`,
                  paddingTop: 8,
                }}
              >
                <KpiPill label="CVs" value={String(v.total_candidates)} />
                <KpiPill label="Contrat." value={String(v.hired_count)} />
                <KpiPill label="Éxito" value={successPct} highlight={v.success_rate !== null && v.success_rate >= 10} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function KpiPill({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, color: P.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: highlight ? P.accent : P.text,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}
